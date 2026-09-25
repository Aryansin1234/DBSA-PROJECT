# Assignment 1 — Work Plan & Progress Report
### MediTrack — Smart Patient & Clinical Record Management System

---

## 1. Team & Submission Details

| Field | Detail |
|---|---|
| **Team Number** | Team_XX *(replace with your allotted number)* |
| **Team Members / IDs** | 1. `<Member 1 Name>` — `<ID>`  <br> 2. `<Member 2 Name>` — `<ID>`  <br> 3. `<Member 3 Name>` — `<ID>`  <br> 4. `<Member 4 Name>` — `<ID>` |
| **Course Name / Number** | Database Systems and Applications / **SESAP ZC337** |
| **Institution** | BITS Pilani — Work Integrated Learning Programmes (WILP) |
| **Assignment** | Assignment 1 — Work Plan and Progress |
| **Submission Date** | 26 September 2026 |
| **Work Commenced** | 12 September 2026 (2 weeks of effort as on submission date) |

---

## 2. Problem Statement

Healthcare facilities generate and consume large volumes of interrelated data — patient
demographics, appointments, diagnoses, prescriptions, laboratory investigations, and full
clinical encounter records. In many small and mid-sized clinics this information is still
maintained in disconnected spreadsheets or paper files, which leads to:

- **Data redundancy and inconsistency** — the same patient details re-entered across registers.
- **No referential integrity** — prescriptions and lab results that reference patients/visits that
  cannot be reliably traced.
- **Poor traceability / auditability** — no reliable record of *who* accessed or modified a
  sensitive clinical record and *when*.
- **Scheduling conflicts** — double-booking of doctors due to the absence of a validated,
  centralised appointment system.
- **Delayed clinical decisions** — abnormal lab values are not automatically flagged, and there
  is no consolidated clinical timeline per patient.

**Objective:** Design and implement a **production-grade, normalised relational database
application** — *MediTrack* — that manages the complete lifecycle of patient care (registration →
appointment → diagnosis → prescription → lab investigation → clinical record) with strong
integrity constraints, role-based access control, a full audit trail, and analytical reporting.
The system is architected so that a relational **Term 1 core** can be extended into a
**multimodal clinical data platform (Term 2)** — medical images (DICOM), time-series vitals,
document storage, spatial queries, and AI-assisted features.

This project targets **Bloom's Level 5 (Evaluate)** and **Level 6 (Create)** by requiring the team
to not only build the system but to justify and evaluate every design decision (normalisation
choices, indexing strategy, transaction isolation, and security model).

---

## 3. Planned Approach / Solution / Technology

### 3.1 Solution Approach
We follow an **incremental, phase-driven** methodology with a branch-per-phase Git strategy.
Each phase produces a reviewable deliverable, and later phases build strictly on validated
earlier ones. The database is treated as the **primary artefact** — the application layer is a
consumer of a well-designed schema, not the other way around.

1. **Design-first** — complete ER/EER modelling and normalisation (up to BCNF for critical
   tables) *before* writing any DDL.
2. **Constraint-driven integrity** — push data-quality rules into the database (CHECK, FK,
   ENUM, triggers) rather than relying only on application code.
3. **Least-privilege security** — PostgreSQL roles per application role; access through views and
   stored procedures where sensitive data is involved.
4. **Measure, don't guess** — every index is justified with `EXPLAIN ANALYZE` before/after.

### 3.2 Technology Stack

| Layer | Technology | Justification |
|---|---|---|
| **RDBMS** | PostgreSQL 16 | Full SQL compliance, JSONB, full-text search, PostGIS & TimescaleDB extensions for Term 2 |
| **Backend** | Python 3.11 + FastAPI | Async support, auto-generated OpenAPI docs |
| **ORM / Migrations** | SQLAlchemy 2.0 + Alembic | Mature ORM with raw-SQL fallback; version-controlled schema |
| **Auth** | JWT (PyJWT) + bcrypt | Stateless, secure, role-aware token auth |
| **Frontend** | React 18 + TypeScript + Tailwind / shadcn-ui | Type-safe, accessible, reusable components |
| **Cache / Queue** | Redis (+ Celery, Term 2) | Session store, query cache, async jobs |
| **DevOps** | Docker Compose, Git/GitHub, pytest, pgAdmin | One-command setup, CI, testing, DB inspection |

### 3.3 Standout Features (differentiators)
- **Audit trail** via triggers capturing old/new row images as JSONB on every sensitive change.
- **Appointment conflict prevention** enforced at the database level (trigger + `SELECT FOR UPDATE`).
- **Abnormal lab-result flagging** function (`NORMAL / LOW / HIGH / CRITICAL`) against reference ranges.
- **Full-text search** on clinical SOAP notes using `tsvector` + GIN index.

---

## 4. Plan — Deliverables and Dates

> Timeline spans both terms. Assignment 1 covers the design and core-implementation deliverables;
> later phases (esp. AI and multimodal) are scheduled for Term 2.

| # | Deliverable | Phase | Planned Date | Term |
|---|---|---|---|---|
| D1 | Project setup, repo, Docker Compose, SRS draft | Phase 0 | 12–15 Sep 2026 | 1 |
| D2 | ER / EER diagram + relational schema | Phase 1 | 16–20 Sep 2026 | 1 |
| D3 | Normalisation report (1NF → BCNF proofs) | Phase 1 | 20–22 Sep 2026 | 1 |
| D4 | Core DDL, triggers, functions, views | Phase 2 | 22–26 Sep 2026 | 1 |
| D5 | Seed data (Faker) + reference catalogues | Phase 2 | 26–30 Sep 2026 | 1 |
| D6 | Backend REST API (auth, patient, appointment, dx, rx, lab) | Phase 3 | Oct 2026 | 1 |
| D7 | Frontend application (dashboards, forms, analytics) | Phase 3 | Oct 2026 | 1 |
| D8 | Query optimisation & indexing report | Phase 4 | Nov 2026 | 1 |
| D9 | Security, transactions, backup/recovery | Phase 5 | Nov 2026 | 1 |
| D10 | Testing suite + documentation | Phase 8 | Nov–Dec 2026 | 1 |
| D11 | **Multimodal extension** (DICOM, TimescaleDB, PostGIS, PDF) | Phase 6 | Term 2 | 2 |
| D12 | **AI capabilities** (drug interaction, summarisation, forecasting) | Phase 7 | Term 2 | 2 |
| D13 | Final viva & submission | Phase 9 | End Term 2 | 2 |

---

## 5. As on 26 September 2026 — Progress of Work

**Overall status:** Term 1 foundation (design + core database implementation) substantially
complete. Approximately **35% of the full two-term scope** and **~70% of the Term 1 core** done.

### 5.1 Completed ✅

| Area | Item | Status |
|---|---|---|
| Phase 0 | GitHub repo with `main` / `dev` / `phase/*` branches | ✅ Done |
| Phase 0 | Docker Compose (PostgreSQL 16 + Redis + FastAPI) running locally | ✅ Done |
| Phase 0 | FastAPI + React/Vite skeletons scaffolded | ✅ Done |
| Phase 0 | Alembic initialised; `.env` and `.gitignore` configured | ✅ Done |
| Phase 0 | SRS draft (purpose, scope, FRs, NFRs, use-case & DFD diagrams) | ✅ Done |
| Phase 1 | All 15+ entities identified with attributes & relationships | ✅ Done |
| Phase 1 | ER / EER diagram (with ISA hierarchy for HealthcareProfessional) | ✅ Done |
| Phase 1 | Relational schema derived; M:N resolved via bridge tables | ✅ Done |
| Phase 1 | Normalisation to 3NF (all tables) and BCNF (critical tables) | ✅ Done |
| Phase 1 | Functional-dependency documentation + 3 formal proofs | ✅ Done |
| Phase 2 | Core DDL (`schema.sql`) — 18 tables, ENUMs, CHECK/FK constraints | ✅ Done |
| Phase 2 | `trg_updated_at` and `trg_audit_log` triggers implemented | ✅ Done |
| Phase 2 | `trg_appointment_conflict` conflict-prevention trigger | ✅ Done |
| Phase 2 | `fn_calculate_age`, `fn_flag_abnormal_lab_result` functions | ✅ Done |
| Phase 2 | `vw_patient_summary`, `vw_pending_lab_results` views | ✅ Done |
| Phase 2 | Seed script (Faker) — 10 doctors, 50 patients, ICD-10 & drug catalogues | ✅ Done |

### 5.2 In Progress 🚧

| Area | Item | Status |
|---|---|---|
| Phase 2 | `sp_complete_encounter` stored procedure (transaction wrapping) | 🚧 ~60% |
| Phase 3 | Backend auth module (JWT login/refresh + role guards) | 🚧 ~50% |
| Phase 3 | Patient & Appointment API endpoints | 🚧 ~40% |
| Phase 8 | pytest scaffolding for trigger/constraint tests | 🚧 Started |

### 5.3 Not Yet Started ⬜ (planned Term 1 / Term 2)

| Area | Item | Planned |
|---|---|---|
| Phase 3 | Full frontend React application (dashboards, forms) | Term 1 (Oct) |
| Phase 4 | Query optimisation & indexing report | Term 1 (Nov) |
| Phase 5 | RBAC roles, pgcrypto encryption, backup/recovery | Term 1 (Nov) |
| Phase 6 | **Multimodal:** DICOM, TimescaleDB vitals, PostGIS, PDF OCR | **Term 2** |
| Phase 7 | **AI capabilities** — see note below | **Term 2** |

> **Note on AI capabilities (Phase 7):** All AI features — drug-interaction checking via
> OpenFDA, clinical-note summarisation, diagnosis suggestion, appointment demand forecasting,
> and medical-image analysis — are **deliberately deferred to Term 2**. They depend on a
> populated, stable core database and the multimodal data layer (Phase 6). These are documented
> in the project plan but are **intentionally out of scope for the current submission**.

### 5.4 Progress Snapshot (by phase)

| Phase | Description | Completion |
|---|---|---|
| Phase 0 | Setup & Requirements | ▓▓▓▓▓▓▓▓▓▓ 100% |
| Phase 1 | Database Design | ▓▓▓▓▓▓▓▓▓▓ 100% |
| Phase 2 | Core DB Implementation | ▓▓▓▓▓▓▓▓░░ 80% |
| Phase 3 | Application Development | ▓▓▓░░░░░░░ 30% |
| Phase 4 | Query Optimisation | ░░░░░░░░░░ 0% |
| Phase 5 | Security & Transactions | ░░░░░░░░░░ 0% |
| Phase 6 | Multimodal (Term 2) | ░░░░░░░░░░ 0% |
| Phase 7 | AI Capabilities (Term 2) | ░░░░░░░░░░ 0% |

---

## 6. Issues to Inform Lab / Course Faculty

| # | Issue / Query | Impact | Requested Guidance |
|---|---|---|---|
| I1 | **UUID vs. serial PKs** — we chose `UUID` primary keys (production standard, avoids enumeration attacks). We would like confirmation this is acceptable for the course rubric. | Design | Please confirm acceptability. |
| I2 | **Scope of Term 2 features** — multimodal (DICOM/TimescaleDB/PostGIS) and all AI features are planned for Term 2. We want to confirm they are **not** expected in the Assignment 1 / Term 1 evaluation. | Scope | Confirm Term-2 deferral is acceptable. |
| I3 | **Extension availability** — TimescaleDB and PostGIS are required in Term 2. We need confirmation that the lab PostgreSQL environment permits installing these extensions, or whether we should host our own container. | Environment | Advise on lab DB extension policy. |
| I4 | **Dataset for AI diagnosis suggestion** — we plan to use a public Kaggle Symptom–Disease dataset. Please advise whether external public datasets are permitted for the AI module. | Data / Ethics | Confirm dataset usage policy. |
| I5 | **Team size vs. workload** — given the two-term breadth, we request guidance on the minimum mandatory feature set for Term 1 grading so we can prioritise correctly. | Planning | Advise on Term 1 minimum deliverables. |

---

*Prepared by Team_XX — SESAP ZC337 Database Systems and Applications*
*BITS Pilani WILP | Submission Date: 26 September 2026*
