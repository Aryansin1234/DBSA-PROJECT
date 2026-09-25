# 07 · Setup & Run

## Prerequisites

- **Docker Desktop** (recommended — runs everything with one command)
- *Or* for local dev: Python 3.11+, Node.js 20+, PostgreSQL 16, Redis 7

---

## Option A — One Command (Docker) ✅ Recommended

```bash
# From the project root
./start.sh
```

This script:
1. Detects `docker compose` vs legacy `docker-compose`
2. Checks Docker daemon is running
3. Builds and starts all 4 services (`db`, `redis`, `backend`, `frontend`)
4. Waits for PostgreSQL to be healthy and backend `/health` to respond
5. Backend **auto-bootstraps baseline data** on startup:
   - 5 departments, 5 demo accounts (Indian names), 97 ICD-10 codes, 36 lab tests, 8 medicines
   - **No patients, no appointments** — platform starts blank
6. **Streams live logs** with colour-coded service prefixes
7. Press **Ctrl-C** to stop all containers cleanly (`docker compose stop --timeout 5`)

**Then open:**
| What | URL |
|---|---|
| Frontend | http://localhost:5173 |
| API docs (Swagger) | http://localhost:8000/docs |
| Health check | http://localhost:8000/health |

**Demo login:** `admin@meditrack.dev` / `Admin@123`

### All demo accounts
| Role | Email | Password |
|---|---|---|
| Admin | admin@meditrack.dev | Admin@123 |
| Doctor | doctor@meditrack.dev | Doctor@123 |
| Nurse | nurse@meditrack.dev | Staff@123 |
| Lab Technician | lab@meditrack.dev | Staff@123 |
| Receptionist | reception@meditrack.dev | Staff@123 |

---

## Starting with Data (Simulation Engine)

The platform starts **completely blank**. To generate data:

**Option 1 — Start the simulation engine from the dashboard:**
Log in as Admin → Dashboard → Simulation Engine panel → "Start engine".
The engine registers patients, books appointments, adds diagnoses, prescriptions,
lab orders and results continuously. Use speed controls (Slow/Normal/Fast/Turbo).

**Option 2 — Run the deterministic seed script:**
```bash
docker compose exec backend python -m app.seed
```
This creates 10 doctors, 3 support staff, 50 patients, and 200 appointments using
Indian Faker data. Drops and recreates all tables (wipes existing data).

---

## Useful Docker Commands

```bash
# Follow all service logs (same as what start.sh shows)
docker compose logs -f

# Follow one service
docker compose logs -f backend

# Rebuild and restart just the backend after code changes
docker compose up -d --build backend

# Stop everything (keeps data)
docker compose down

# Wipe everything including the database volume (fresh start)
docker compose down -v

# Re-run baseline bootstrap (non-destructive)
docker compose exec backend python -c "from app.services.simulator import simulator; simulator.ensure_baseline()"
```

---

## Fresh Start Procedure

If the database has stale data and you want to reset completely:

```bash
docker compose down -v       # wipe pgdata volume + containers
docker compose up -d --build  # rebuild and start fresh
```

The platform will boot with 0 patients, 0 appointments, just the 5 demo accounts
and reference data.

---

## Option B — Local Development (no Docker)

### Backend

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp env.sample .env
# Edit .env: set DATABASE_URL to your local PostgreSQL
# Example: postgresql+psycopg2://postgres:password@localhost:5432/meditrack

uvicorn app.main:app --reload
```

Backend runs at http://localhost:8000. The startup sequence bootstraps
baseline data automatically (departments, demo accounts, reference data).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at http://localhost:5173. The Vite dev server proxies `/api` to
`http://localhost:8000` (configured in `vite.config.ts`).

---

## Running Tests

```bash
cd backend
source .venv/bin/activate
pytest
```

Current tests cover domain helpers (`calculate_age`, `flag_lab_result`).
See `backend/tests/`.

---

## Environment Variables

**Backend** (`backend/env.sample` → copy to `.env`):

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgresql+psycopg2://meditrack:meditrack@localhost:5432/meditrack` | SQLAlchemy connection string |
| `JWT_SECRET` | `change-me-in-production` | JWT signing secret |
| `JWT_ALGORITHM` | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `15` | Access token lifetime |
| `REFRESH_TOKEN_EXPIRE_MINUTES` | `10080` (7 days) | Refresh token lifetime |
| `REDIS_URL` | `redis://localhost:6379/0` | Cache/session store |
| `SIMULATOR_AUTOSTART` | `false` | Start engine on boot (set `true` to auto-start) |
| `SIMULATOR_INTERVAL_SECONDS` | `3.0` | Seconds between simulation ticks |

**Frontend** (set in `docker-compose.yml`, not `.env`):

| Variable | Value | Purpose |
|---|---|---|
| `VITE_API_PROXY` | `http://backend:8000` | Proxy target inside Docker |

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `ECONNREFUSED` errors in frontend logs | Backend still starting — wait ~10s or check `docker compose logs backend` |
| `DependentObjectsStillExist` on seed | Views exist from a previous run. `seed.py` now drops them first — rebuild backend: `docker compose up -d --build backend` |
| `IntegrityError: APPOINTMENT_CONFLICT` on startup | Old bug — fixed. If it recurs, run `docker compose down -v` for a clean volume |
| Port 5432 / 5173 / 8000 already in use | `docker compose down`, or change the port mappings in `docker-compose.yml` |
| Pylance import errors in VS Code | Point VS Code Python interpreter to `backend/.venv/bin/python` |
| `bcrypt` error on first install | Requires GCC. The Dockerfile has `gcc libpq-dev`. For local dev: `pip install bcrypt` after installing system build tools |
| Frontend shows old data after code change | Vite HMR updates automatically. If stale: hard refresh `Cmd+Shift+R` |
