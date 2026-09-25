# 09 · Live Simulation Engine

MediTrack ships with a built-in **Hospital Simulation Engine** — a background
thread that continuously generates realistic clinical activity so the entire
platform behaves like a **live, operating hospital** rather than a static demo.

The platform starts **completely blank** (0 patients, 0 appointments). The
simulation engine is the only source of live data unless users enter it manually.

---

## Why This Approach

| Old approach (one-shot seed) | Live engine |
|---|---|
| Runs once — data is frozen at startup | Runs continuously — data grows forever |
| Dashboard is a static snapshot | Dashboard is a **live monitor** |
| No clinical workflow is exercised | Every role's workflow is exercised in real time |
| Nothing to demonstrate at a viva | Start/stop/tune it live on stage |

This turns MediTrack from *"a database with a UI"* into *"a running system
you can observe, query, and analyse in real time"* — the core DBSA showcase.

---

## What `ensure_baseline()` Creates (startup only)

Before the engine starts ticking, `ensure_baseline()` idempotently seeds the
minimum reference data required for the system to function. It is **safe on
every restart** — uses upsert logic, never duplicates.

| What | Count | Detail |
|---|---|---|
| Departments | 5 | Cardiology, Neurology, Orthopaedics, Paediatrics, General Medicine |
| Demo accounts | 5 | System Admin, Arjun Sharma (Doctor), Priya Nair (Nurse), Rohan Desai (Lab Tech), Kavya Reddy (Receptionist) |
| ICD-10 codes | 97 | 12 clinical categories (Endocrine, Cardiovascular, Respiratory, GI, Renal, Musculoskeletal, Neurological, Dermatology, Infections, Eyes/ENT, Oncology, Haematological) |
| Lab tests | 36 | 8 categories with reference ranges (Metabolic, Lipid, Renal/Liver, Haematology, Thyroid, Cardiac, Electrolytes, Other) |
| Medicines | 8 | 5 categories with initial stock 60–200 |

**No patients, no appointments** are created here.

---

## What the Engine Generates (per tick)

Each **tick** (default every 3 s) performs 1–3 weighted random actions:

| Action | Weight | Effect on DB |
|---|---:|---|
| Register patient | 18 | New `person` + `patient` (Faker `en_IN` names, phone, email) |
| Book appointment | 26 | New `appointment` (conflict-checked, mirrors the real API rule) |
| Progress appointment | 24 | `SCHEDULED → IN_PROGRESS` (80%) / `NO_SHOW` (12%) / `CANCELLED` (8%); `IN_PROGRESS → COMPLETED` |
| Add diagnosis | 12 | Random ICD-10 + severity on an active/completed appointment |
| Issue prescription | 10 | `prescription` + 1–3 items, **decrements medicine stock** |
| Order lab test | 6 | New `lab_investigation` on an active appointment |
| Enter lab result | 6 | Generates a realistic value ± span, auto-flags as NORMAL/LOW/HIGH/CRITICAL |
| Restock pharmacy | 2 | Adds 50–150 stock to any medicine below 40 units |
| Write SOAP note | 6 | Creates a `clinical_record` for an appointment without one |
| Refer patient | 4 | Creates a `referral` (feeds the recursive CTE in SQL Insights) |

Every action pushes an event to a thread-safe ring buffer (max 100 events)
that powers the **Live Activity** feed on the dashboard.

---

## How It Is Implemented

```
HospitalSimulator (singleton, backend/app/services/simulator.py)
│
├── _state: SimState          (running, interval, ticks, counters — protected by Lock)
├── _events: deque(maxlen=100) (ring buffer — protected by Lock)
├── _stop: threading.Event    (clean shutdown signal)
└── _thread: Thread(daemon=True, name="hospital-sim")
         │
         └── _loop():
               while not _stop.is_set():
                 db = SessionLocal()
                 _tick(db)             1–3 weighted random actions, each commits
                 db.close()
                 _stop.wait(interval)  interruptible sleep
```

- **Daemon thread** — dies automatically when the main process exits.
- **Thread-safe** — `threading.Lock` guards state and event buffer.
- **Resilient** — any exception in a single tick is caught and logged as a
  `system` event; the engine keeps running.
- **Own DB session per tick** — avoids session leaks across ticks.

Source: `backend/app/services/simulator.py`

---

## Configuration

`backend/app/core/config.py` reads from `.env`:

| Setting | Default | Meaning |
|---|---|---|
| `SIMULATOR_AUTOSTART` | `false` | Auto-start the engine on boot |
| `SIMULATOR_INTERVAL_SECONDS` | `3.0` | Seconds between ticks |

Set `SIMULATOR_AUTOSTART=true` in `.env` or `docker-compose.yml` to have the
engine start automatically on every boot. Default is `false` — the platform
starts blank and an Admin must start it from the dashboard.

---

## Control API

All endpoints under `/api/simulator`. **Read endpoints** are open to any
authenticated user. **Mutation endpoints** are Admin-only.

| Endpoint | Auth | Description |
|---|---|---|
| `GET /simulator/status` | 🔓 any | `running`, `interval`, `ticks`, `started_at`, per-type `counters` |
| `GET /simulator/events?limit=N` | 🔓 any | Most-recent-first activity feed (max 100) |
| `POST /simulator/start` | 🟢 Admin | Start engine. Optional `{ "interval": 1.2 }` |
| `POST /simulator/stop` | 🟢 Admin | Pause engine |
| `POST /simulator/config` | 🟢 Admin | Change tick rate `{ "interval": 0.5 }` without restart |

Speed presets on the dashboard (maps to `interval` seconds):

| Label | Interval |
|---|---|
| Slow | 5.0 s |
| Normal | 3.0 s |
| Fast | 1.2 s |
| Turbo | 0.5 s |

---

## Dashboard Integration

The **Simulation Panel** (Admin only) shows:
- **Live Activity feed** — animated list of recent events (colour-coded by type), pulsing `LIVE` badge
- **Engine control card** — tick count, per-type generation totals, Start/Pause button, Speed selector

All analytics queries use `refetchInterval: 3000` so KPI cards, trend chart,
status donut, and top-diagnoses bars all update in real time as the engine runs.

The **Lab Technician dashboard** shows a notification queue widget that refetches
`/lab/pending` every 10 seconds — pending test cards appear as the engine orders
lab tests and the count badge updates live.

---

## Relationship to `seed.py`

`seed.py` is a **separate, destructive, deterministic** script:
```bash
docker compose exec backend python -m app.seed
```
- Drops all views, drops all tables, recreates them, inserts fixed data.
- Creates 10 doctors, 3 support staff, 50 Indian-named patients, 200 appointments.
- Use this when you want a **reproducible, offline dataset** without running the engine.

The simulation engine and `seed.py` are independent — you can use either or both.
For the live demo, use the engine. For a submission snapshot, use `seed.py`.
