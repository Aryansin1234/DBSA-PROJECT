# MediTrack — Smart Patient & Clinical Record Management System

Full-stack clinical records platform for **SESAP ZC337 Database Systems and Applications**
(BITS Pilani WILP). PostgreSQL 16 + FastAPI + React 18 + TypeScript.

> **Term 1 status:** ~85% complete — all core clinical workflows implemented.
> **Term 2** (multimodal: DICOM / TimescaleDB / PostGIS / AI) planned next.
> Full plan: [`DBSA_Project_Plan.md`](./DBSA_Project_Plan.md)

---

## Architecture

```
┌──────────────────┐    REST / JSON     ┌─────────────────┐     SQL      ┌──────────────┐
│  React 18 +      │  ───────────────►  │  FastAPI 0.111  │  ──────────► │ PostgreSQL16 │
│  TypeScript      │   JWT Bearer       │  SQLAlchemy 2.0 │  psycopg2   │              │
│  Vite + Tailwind │  ◄───────────────  │  Pydantic v2    │             │  + Redis 7   │
└──────────────────┘                    └─────────────────┘             └──────────────┘
```

| Layer | Tech |
|---|---|
| Backend | Python 3.11, FastAPI, SQLAlchemy 2.0, python-jose, bcrypt |
| Database | PostgreSQL 16, Redis 7 |
| Frontend | React 18, TypeScript, Vite, TanStack Query v5, Zustand, Recharts, Framer Motion |
| DevOps | Docker Compose, pytest |

---

## Quick Start

```bash
./start.sh
```

The script builds all containers, waits for health checks, and then **streams live logs**.
Press **Ctrl-C** to stop everything cleanly.

- **Frontend:** http://localhost:5173
- **API docs (Swagger):** http://localhost:8000/docs
- **Health:** http://localhost:8000/health

> **Fresh database?** Run `docker compose down -v && docker compose up -d --build`
> to wipe the volume and start completely blank.

---

## Demo Accounts

| Role | Email | Password | What they can do |
|---|---|---|---|
| Admin | admin@meditrack.dev | Admin@123 | Everything — SQL Insights, Audit Log, Sim Engine |
| Doctor | doctor@meditrack.dev | Doctor@123 | Own patients, diagnose, prescribe, order labs, SOAP notes |
| Nurse | nurse@meditrack.dev | Staff@123 | View patients + appointments, update status |
| Lab Technician | lab@meditrack.dev | Staff@123 | Enter lab results, lab work queue |
| Receptionist | reception@meditrack.dev | Staff@123 | Register patients, book appointments |

---

## What's Built (Term 1)

### Database Layer
| Feature | Implementation |
|---|---|
| 15 ORM tables | UUID PKs, TIMESTAMPTZ, CHECK constraints, ENUMs |
| 3 triggers | `trg_set_updated_at`, `trg_write_audit` (JSONB), `trg_appointment_conflict` |
| 2 SQL functions | `fn_calculate_age()`, `fn_flag_abnormal_lab_result()` |
| 4 views | `vw_patient_summary`, `vw_doctor_schedule_today`, `vw_pending_lab_results`, `vw_audit_recent` |
| Indexes | Composite, partial (scheduled), GIN on JSONB audit columns |
| PostgreSQL RBAC | 5 roles with minimum privileges |

### Backend API (FastAPI)
| Module | Endpoints |
|---|---|
| Auth | login, refresh, me |
| Patients | list (doctor-scoped), create, get, detail (role-gated sections) |
| Appointments | list (doctor-scoped + enriched), create (conflict detection), status update (state machine) |
| Diagnoses | ICD-10 search (97 codes), create |
| Prescriptions | create (ACID: stock decrement), get |
| Lab | 36 tests, order, enter result, pending queue (enriched), medicines list |
| Clinical Records | SOAP upsert (optimistic locking) |
| Analytics | KPIs, trends, status breakdown — all role-scoped |
| Insights | Window func, CTE, Recursive CTE, LATERAL JOIN, EXPLAIN ANALYZE |
| Audit | trigger-populated change log |
| Simulator | start/stop/config/status/events |

### Frontend
| Page | Description |
|---|---|
| Login | GSAP animations, quick role selector, OAuth2 form |
| Dashboard | Role-aware KPIs + charts; Lab Tech gets pending queue widget; Admin gets sim panel |
| Patients | Search + filters, stat cards, clickable rows (role-gated) |
| Patient Detail | 360° clinical view — diagnose, prescribe, order lab, SOAP note, enter result; all role-gated |
| Appointments | 6 stat cards, Patient + Doctor columns, clickable rows, inline status change (portal dropdown) |
| Lab Queue | Work queue for Lab Tech — search, grouped, Enter Result, 10s auto-refresh |
| SQL Insights | 4 advanced query demos + EXPLAIN ANALYZE (Admin only) |
| Audit Log | Full change history (Admin only) |

### Role-Based Access Control
Full enforcement at 3 levels: PostgreSQL roles → FastAPI `require_role()` → React `RoleRoute`.
Doctors see only their own patients/appointments/KPIs. Lab techs see only labs. Receptionists cannot access clinical detail.

---

## Project Structure

```
DBSA PROJECT/
├── backend/
│   ├── app/
│   │   ├── core/           config, database, security, deps
│   │   ├── db/
│   │   │   ├── bootstrap.py   applies SQL layer on startup
│   │   │   └── sql/           functions, triggers, views, indexes, roles
│   │   ├── models/         SQLAlchemy ORM (15 tables)
│   │   ├── schemas/        Pydantic request/response models
│   │   ├── routers/        14 router modules
│   │   ├── services/
│   │   │   ├── domain.py      age calc, lab flagging
│   │   │   └── simulator.py   background hospital simulation engine
│   │   ├── seed.py         deterministic seed (Faker en_IN)
│   │   └── main.py         FastAPI entry point + lifespan
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/     Layout, Modal, StatusBadge, AppointmentStatusControl,
│   │   │                   AddDiagnosisForm, AddPrescriptionForm, OrderLabForm,
│   │   │                   EnterLabResultForm, SoapEditor, SimulationPanel, ...
│   │   ├── pages/          Dashboard, Patients, PatientDetail, Appointments,
│   │   │                   LabQueue, Insights, Audit, Login
│   │   ├── lib/            api.ts (Axios + JWT interceptor), roles.ts, cn.ts
│   │   ├── store/          auth.ts (Zustand + persist)
│   │   └── App.tsx         routing + ProtectedRoute + RoleRoute
│   └── vite.config.ts
├── docker-compose.yml
├── start.sh                one-command launch with live logs + Ctrl-C shutdown
├── DBSA_Project_Plan.md    complete phase-by-phase plan with progress tracking
└── README.md
```

---

## Running Tests

```bash
cd backend
pytest
```

---

## Resetting to Blank

```bash
# Wipe all data and restart fresh
docker compose down -v
docker compose up -d --build
```

The platform starts with 0 patients, 0 appointments. Only the 5 demo accounts and
reference data (97 ICD-10 codes, 36 lab tests, 8 medicines) are pre-loaded.
The simulation engine is **off by default** — an Admin must start it from the dashboard.

---

*MediTrack v1.4.0 — BITS Pilani WILP SESAP ZC337 | Term 1 Core: ~85% Complete*
