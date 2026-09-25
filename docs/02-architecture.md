# 02 · Architecture & Data Flow

## The Big Picture

```
┌──────────────────────────────────────────────────────────────────────┐
│                          Docker Compose                               │
│                                                                       │
│  ┌──────────────┐  /api/*   ┌──────────────┐  SQL   ┌─────────────┐ │
│  │  frontend    │ ────────▶ │   backend    │ ──────▶ │ PostgreSQL  │ │
│  │ React+Vite   │  (proxy)  │   FastAPI    │        │     16      │ │
│  │   :5173      │ ◀──────── │   :8000      │ ◀───── │    :5432    │ │
│  └──────────────┘   JSON    └──────────────┘        └─────────────┘ │
│         │                         │                                  │
│  Zustand store              cache / sessions                         │
│  (localStorage)                   │                                  │
│                             ┌───────────┐                            │
│                             │   Redis   │ :6379                      │
│                             └───────────┘                            │
└──────────────────────────────────────────────────────────────────────┘
```

| Service | Image | Port | Role |
|---|---|---|---|
| `db` | postgres:16 | 5432 | Primary datastore |
| `redis` | redis:7 | 6379 | Token store / cache |
| `backend` | built from `backend/Dockerfile` | 8000 | REST API + simulation engine |
| `frontend` | node:20-alpine (Vite dev) | 5173 | UI |

## Request Lifecycle (Login example)

```
1. Browser → axios.post("/api/auth/login", formData)
           ↓
2. Vite proxies /api → http://backend:8000 (Docker network)
           ↓
3. FastAPI routers/auth.py:
   • JOIN healthcare_professional + person ON email
   • bcrypt.checkpw(plain, hash)
   • create_access_token(sub=uuid, role="ADMIN")
   • create_refresh_token(sub=uuid, role="ADMIN")
           ↓
4. Response: { access_token, refresh_token, token_type, role }
           ↓
5. Zustand store → persisted to localStorage (meditrack-auth)
           ↓
6. Every subsequent request:
   Axios interceptor → Authorization: Bearer <access_token>
           ↓
7. FastAPI deps.py → get_current_user() → decodes JWT
   require_role("ADMIN") → allows or raises 403
```

## Token Refresh Flow

```
Request → 401 Unauthorized
       ↓
axios interceptor (lib/api.ts):
  if (!_retry && refreshToken && !refreshing):
    refreshing = true
    POST /auth/refresh { refresh_token }
    → new access_token + refresh_token
    → setTokens() in Zustand
    → retry original request
  else:
    logout() → clear store → redirect to /login
```

## Backend Layer Structure

```
backend/app/
├── main.py              FastAPI app, CORS, router registration, lifespan
├── core/
│   ├── config.py        Settings from .env (pydantic-settings)
│   ├── database.py      SQLAlchemy engine, SessionLocal, get_db()
│   ├── security.py      bcrypt hash/verify + JWT create/decode
│   └── deps.py          get_current_user(), require_role() factory
├── models/              SQLAlchemy ORM (15 tables, ENUMs, constraints)
├── schemas/             Pydantic v2 request/response shapes
├── routers/             14 modules: auth, patients, appointments,
│                        diagnoses, prescriptions, lab, analytics,
│                        audit, records, insights, simulator, professionals
├── services/
│   ├── domain.py        calculate_age(), flag_lab_result()
│   └── simulator.py     HospitalSimulator background thread
├── db/
│   ├── bootstrap.py     Applies SQL layer on startup (idempotent)
│   └── sql/             01_functions_triggers.sql, 02_views.sql,
│                        03_indexes.sql, 04_roles.sql
└── seed.py              Manual seed script (Faker en_IN, deterministic)
```

**Why the separation?**
- `models` = shape of data **in the DB**
- `schemas` = shape of data **over the wire** (never expose raw ORM rows)
- `routers` = thin HTTP layer (delegates to services/DB)
- `services` = business rules (testable without HTTP or DB)
- `db/sql/` = the real database layer (triggers, views, indexes)

## Data Integrity — Where Rules Live

| Rule | Enforced by |
|---|---|
| `date_of_birth < CURRENT_DATE` | `CHECK` constraint |
| `appointment.end_time > start_time` | `CHECK` constraint |
| `lab_result.value >= 0` | `CHECK` constraint |
| `medicine.stock_count >= 0` | `CHECK` constraint |
| `prescription_item.duration_days > 0` | `CHECK` constraint |
| Doctor cannot be double-booked | DB trigger `trg_appointment_conflict` + app `SELECT FOR UPDATE` |
| Every data change is recorded | DB trigger `trg_write_audit` → `audit_log` (JSONB old/new) |
| Prescription + stock decrement are atomic | Single `db.commit()` (ACID transaction) |
| SOAP note concurrent edit detected | Optimistic locking — version mismatch → 409 |
| Role-appropriate data access | Backend `require_role()` + frontend `RoleRoute` |

## Startup Sequence

```
FastAPI lifespan:
  1. Base.metadata.create_all()        ORM tables
  2. apply_database_layer()            Triggers, views, indexes, DB roles
  3. simulator.ensure_baseline()       Departments, 5 demo accounts,
                                       97 ICD-10 codes, 36 lab tests,
                                       8 medicines — upsert, never duplicate
  4. simulator.start()                 Background thread starts IF
                                       SIMULATOR_AUTOSTART=true
                                       (default: false → platform starts blank)
```

## Technology Choices

| Choice | Reason |
|---|---|
| PostgreSQL 16 | Full SQL, constraints, triggers, JSONB, future PostGIS/TimescaleDB |
| FastAPI | Auto-generated OpenAPI docs at `/docs`, Pydantic validation, async-ready |
| SQLAlchemy 2.0 | Powerful ORM + raw `text()` SQL escape hatch for advanced queries |
| React 18 + TypeScript | Type-safe, component-based, large ecosystem |
| TanStack Query | Automatic cache, background refetch, loading/error states |
| Zustand | Tiny global state (auth) with `persist` middleware for localStorage |
| JWT | Stateless auth — no server-side session table needed |
| Docker Compose | One command spins up the entire stack identically anywhere |
| Faker(`en_IN`) | Indian locale for all generated names and phone numbers |
