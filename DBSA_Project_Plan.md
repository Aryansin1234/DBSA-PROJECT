# Smart Patient & Clinical Record Management System
### BITS Pilani WILP — DBSA Capstone Project (SESAP ZC337)
> **Course:** Database Systems and Applications | **Term:** 1 + 2 (Progressive Build)
> **Bloom's Level Target:** 5 (Evaluate) + 6 (Create)
> **Last Updated:** 25 September 2026 | **Version:** 1.4.0

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Development Timeline](#development-timeline)
4. [Phase 0 — Setup & Requirements](#phase-0--setup--requirements)
5. [Phase 1 — Database Design](#phase-1--database-design)
6. [Phase 2 — Core Database Implementation](#phase-2--core-database-implementation)
7. [Phase 3 — Application Development](#phase-3--application-development)
8. [Phase 4 — Query Optimisation & Indexing](#phase-4--query-optimisation--indexing)
9. [Phase 5 — Security, Transactions & Recovery](#phase-5--security-transactions--recovery)
10. [Phase 6 — Multimodal Extension (Term 2)](#phase-6--multimodal-extension-term-2)
11. [Phase 7 — AI Capabilities](#phase-7--ai-capabilities)
12. [Phase 8 — Testing & Documentation](#phase-8--testing--documentation)
13. [Phase 9 — Final Viva & Submission](#phase-9--final-viva--submission)
14. [Features Summary](#features-summary)
15. [Best Practices](#best-practices)
16. [Future Improvements](#future-improvements)

---

## Project Overview

**System Name:** MediTrack — Smart Patient & Clinical Record Management System

A full-stack, multimodal database application for managing the complete lifecycle of patient care — from registration and appointment booking to diagnosis, prescription, laboratory investigation, and clinical record storage. The system is designed to be production-grade in structure, with clean separation of concerns, role-based access, and an extensible schema that grows from a relational core (Term 1) to a multimodal clinical data platform (Term 2).

### Core Entities at a Glance
| Entity | Description |
|---|---|
| Patient | Demographics, contact, insurance |
| Healthcare Professional | Doctors, nurses, lab techs, roles |
| Appointment | Scheduling, status workflow, conflict detection |
| Diagnosis | 97 ICD-10 codes, severity, clinical notes |
| Prescription | Medicines, dosage, frequency, duration, stock control |
| Lab Investigation | 36 test types, result entry, reference range flagging |
| Clinical Record | SOAP notes per encounter, optimistic locking |
| Referral | Doctor-to-doctor patient referrals (powers recursive CTE) |
| Audit Log | DB-trigger-generated change history |
| Medical Image | DICOM metadata, file references *(Term 2)* |
| ECG / Vitals | Time-series sensor data *(Term 2)* |
| Lab Report Document | PDF/document storage *(Term 2)* |

---

## Tech Stack

### Backend
| Layer | Technology | Status |
|---|---|---|
| Runtime | Python 3.11 | ✅ Implemented |
| Web Framework | FastAPI | ✅ Implemented |
| ORM | SQLAlchemy 2.0 | ✅ Implemented |
| Migration Tool | Alembic | ⏳ Planned — using `create_all` for now |
| Auth | JWT (python-jose) + bcrypt (rounds=12) | ✅ Implemented |
| Task Queue | Celery + Redis | ⏳ Term 2 |

### Database
| Layer | Technology | Status |
|---|---|---|
| Primary RDBMS | PostgreSQL 16 | ✅ Implemented |
| Full-Text Search | PostgreSQL ilike / tsvector | ✅ Basic ilike; GIN → Term 2 |
| Caching | Redis | ✅ Running (session/token store) |
| Time-Series | TimescaleDB | ⏳ Term 2 |
| Spatial | PostGIS | ⏳ Term 2 |

### Frontend
| Layer | Technology | Status |
|---|---|---|
| Framework | React 18 + TypeScript | ✅ Implemented |
| Styling | Tailwind CSS | ✅ Implemented |
| State | Zustand + persist middleware | ✅ Implemented |
| Data Fetching | TanStack Query v5 | ✅ Implemented |
| Charts | Recharts | ✅ Implemented |
| Animations | Framer Motion + GSAP | ✅ Implemented |
| Routing | React Router v6 | ✅ Implemented |
| PDF Viewer | react-pdf | ⏳ Term 2 |
| DICOM Viewer | Cornerstone.js | ⏳ Term 2 |

### DevOps
| Tool | Status |
|---|---|
| Docker Compose (all services) | ✅ Implemented |
| One-command start with live logs + Ctrl-C stop | ✅ Implemented |
| pytest (backend) | ✅ Scaffold present |
| GitHub Actions CI | ⏳ Planned |

---

## Development Timeline

### Term 1 — 3-Week Build

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WEEK 1  │  01 Sep – 11 Sep 2026  │  Foundation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ✅ Docker Compose stack (PostgreSQL 16, Redis, FastAPI, React/Vite)
 ✅ Full PostgreSQL schema — 15 tables, UUIDs, ENUMs, CHECK constraints
 ✅ JWT auth (login / refresh / me), bcrypt rounds=12
 ✅ SQL database layer: triggers (audit, updated_at, conflict),
    4 views, composite + partial + GIN indexes, PostgreSQL RBAC roles
 ✅ Hospital simulation engine (background thread, runtime controls)
 ✅ Core CRUD: patients, professionals, appointments, diagnoses,
    prescriptions (ACID), lab orders + results, SOAP notes
 ✅ React frontend shell: Layout, sidebar, Zustand auth store,
    Axios JWT interceptor with auto-refresh on 401

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WEEK 2  │  12 Sep – 20 Sep 2026  │  UI + SQL Showcase
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ✅ LoginPage — GSAP orb animations, quick demo role buttons
 ✅ Dashboard — KPI cards, area chart, donut chart, top-diagnoses bar
 ✅ PatientListPage — search, gender/blood filters, stat cards
 ✅ PatientDetailPage — 360° clinical view (appointments, diagnoses,
    prescriptions, labs, SOAP notes)
 ✅ AppointmentPage — booking form with 409 conflict handling
 ✅ AuditLogPage (Admin only) — trigger-populated change history
 ✅ SQL Insights page — Window func / CTE / Recursive CTE / LATERAL JOIN
    demos against live data + EXPLAIN ANALYZE query plan viewer
 ✅ SimulationPanel — live activity feed, start/stop/speed (Admin only)
 ✅ SOAP editor with optimistic locking (version field, 409 on conflict)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 WEEK 3  │  21 Sep – 25 Sep 2026  │  RBAC + Full Clinical Workflow
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ✅ Complete role-based access control overhaul:
    • RoleRoute guards in App.tsx (audit/insights/appointments/lab-queue)
    • Doctor scoped to own patients + appointments + KPIs (backend)
    • PatientDetail sections gated: clinical (Doctor/Admin/Nurse),
      labs (+ Lab Tech), diagnoses/Rx/SOAP (Doctor/Admin only)
    • SQL Insights: Admin only
    • Appointment status: state-machine transitions + role enforcement
 ✅ Indian names for all demo accounts (Arjun Sharma, Priya Nair,
    Rohan Desai, Kavya Reddy) — Faker("en_IN") for all generated data
 ✅ Blank platform on fresh start (simulator_autostart=False)
 ✅ Full clinical workflow modals for Doctor:
    • AddDiagnosisForm — debounced ICD-10 server search, selected code
      card, severity grid with clinical descriptions, char-counted notes
    • AddPrescriptionForm — searchable medicine picker per item,
      category groups, stock badges, full frequency labels (OD/BID/…)
    • OrderLabForm — search + browse-toggle, 8 test categories,
      reference range preview
    • EnterLabResultForm — numeric entry, live flag preview before save
 ✅ Lab Technician work queue:
    • /lab/pending enriched (patient name, MRN, test, doctor, time)
    • LabQueuePage (/lab-queue) — full table, search, Enter Result inline
    • Dashboard notification widget — pending count badge, pulsing dot,
      click any item → navigate to that patient's detail
 ✅ ICD-10 codes: 10 → 97 across 12 clinical categories (upsert logic)
 ✅ Lab tests: 5 → 36 across 8 clinical categories (upsert logic)
 ✅ Appointment rows clickable → navigate to patient detail
 ✅ Patient name + Doctor name columns in appointments table
 ✅ AppointmentPage: 6 stat cards (Total/Scheduled/In Progress/
    Completed/Cancelled/No Show)
 ✅ start.sh: live log streaming + Ctrl-C clean shutdown
 ✅ seed.py: drop views before drop_all (DependentObjectsStillExist fix)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Term 2 — Coming Next
```
 🔲 DICOM Viewer        — Medical image upload, metadata storage,
                           Cornerstone.js in-browser viewer
 🔲 ECG / Vitals        — TimescaleDB hypertable, time-range API,
                           vital sign trend charts + waveform display
 🔲 Lab Report PDFs     — Upload, PyMuPDF text extraction,
                           full-text search, react-pdf in-browser render
 🔲 Spatial (PostGIS)   — Patient/hospital location, ST_DWithin nearby search
 🔲 AI Summaries        — Clinical notes summarisation (GPT-4o / Ollama),
                           drug-interaction checker (OpenFDA API)
 🔲 Diagnosis AI        — Symptom → ICD-10 suggestion (scikit-learn classifier)
 🔲 Demand Forecasting  — Appointment demand by department (Prophet),
                           30-day forecast chart with confidence intervals
 🔲 Critical Alerts     — WebSocket push to doctor on CRITICAL lab result,
                           GET /alerts/active unacknowledged alert list
 🔲 MONAI Imaging AI    — Chest X-ray classification (normal vs. abnormal)
```

---

## Phase 0 — Setup & Requirements

### 0.1 Project Initialisation
- [x] Set up Docker Compose with PostgreSQL 16, Redis, FastAPI and React containers
- [x] Initialise FastAPI project with folder structure: `app/models`, `app/routers`, `app/services`, `app/schemas`
- [x] Initialise React + TypeScript frontend with Vite
- [x] Install and configure Tailwind CSS
- [x] Configure `.env` for secrets (DB URL, JWT secret, Redis URL)
- [x] Add `.gitignore` (exclude `.env`, `__pycache__`, `node_modules`)
- [ ] Create GitHub repository with branch structure: `main`, `dev`, `phase/1-db-design`
- [ ] Set up Alembic for database migrations *(using `create_all` for now)*

### 0.2 Software Requirements Specification (SRS)
- [ ] Write SRS Document covering purpose, functional requirements (FR-001 to FR-040+)
- [ ] Use case diagrams (5 actors, 20+ use cases)
- [ ] Data flow diagrams (Level 0 and Level 1)
- [ ] Normalisation proofs for 3 tables

### 0.3 Domain Research
- [x] ICD-10 coding system — 97 codes implemented across 12 categories
- [x] Lab test reference ranges — 36 tests with clinical reference ranges
- [ ] HIPAA/DISHA data privacy principles documentation

---

## Phase 1 — Database Design

### 1.1 Entity-Relationship Modelling
- [x] `Patient`, `Person` (generalisation supertype — shared UUID PK)
- [x] `HealthcareProfessional` (specialisation — Doctor, Nurse, LabTechnician, Receptionist, Admin)
- [x] `Appointment`, `AppointmentStatus` (ENUM: SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW)
- [x] `Diagnosis`, `DiagnosisCode` (ICD-10 lookup — 97 codes)
- [x] `Prescription`, `PrescriptionItem` (weak entity — composite PK)
- [x] `Medicine`, `MedicineCategory`
- [x] `LabInvestigation`, `LabTest` (36 tests), `LabResult`
- [x] `ClinicalRecord` (SOAP encounter summary, version column for optimistic locking)
- [x] `Department`
- [x] `Referral` (doctor-to-doctor, powers recursive CTE)
- [x] `AuditLog` (trigger-populated, JSONB old/new data)
- [ ] ER diagram drawn in draw.io / dbdiagram.io *(Term 2 submission)*
- [ ] `Ward`, `Bed` entities *(Term 2)*
- [ ] `InsuranceClaim` entity *(Term 2)*

### 1.2 EER Enhancements
- [x] Specialisation/generalisation for HealthcareProfessional subtypes (single-table with role ENUM)
- [x] Temporal aspect of ClinicalRecord (one per appointment, versioned)
- [x] Recursive relationship: Doctor → Referral → Doctor (with recursive CTE query)
- [x] Ternary relationship: LabTechnician records LabResult for LabInvestigation on Appointment

### 1.3 Relational Schema Derivation
- [x] All ER entities converted to relational tables
- [x] M:N relationships resolved: `PrescriptionItem` (Prescription × Medicine)
- [x] All primary keys (UUID), foreign keys with explicit ON DELETE behaviour
- [ ] Formal functional dependency documentation *(Term 2 submission)*

### 1.4 Normalisation
- [x] All tables verified in 1NF (atomic values, no repeating groups)
- [x] All tables verified in 2NF (no partial dependencies — UUID PKs ensure this)
- [x] All tables verified in 3NF (no transitive dependencies)
- [x] BCNF for `Prescription`, `LabResult`, `Diagnosis`
- [ ] Written normalisation proof document *(Term 2 submission)*

---

## Phase 2 — Core Database Implementation

### 2.1 Schema Creation (DDL)
- [x] All tables with correct data types:
  - [x] `UUID` as primary key (not auto-increment integers)
  - [x] `TIMESTAMPTZ` for all timestamps (timezone-aware)
  - [x] `NUMERIC(10,2)` for lab result values and reference ranges
  - [x] `VARCHAR` with limits (first_name: 80, phone: 20, license_number: 60)
- [x] All `PRIMARY KEY`, `FOREIGN KEY`, `UNIQUE`, `NOT NULL`, `CHECK` constraints applied
- [x] CHECK constraints:
  - [x] `patient.date_of_birth < CURRENT_DATE`
  - [x] `appointment.end_time > appointment.start_time`
  - [x] `lab_result.value >= 0`
  - [x] `medicine.stock_count >= 0`
  - [x] `prescription_item.duration_days > 0`
- [x] ENUM types: `appointment_status`, `gender`, `blood_group`, `severity`, `lab_flag`, `professional_role`
- [x] `created_at` and `updated_at` on all tables (auto-managed by trigger)

### 2.2 Triggers
- [x] `trg_set_updated_at` — auto-update `updated_at` on row change (7 tables)
- [x] `trg_write_audit` — INSERT/UPDATE/DELETE on 7 sensitive tables → writes to `audit_log` with JSONB old/new data
- [x] `trg_appointment_conflict` — BEFORE INSERT on `appointment`, raises exception if doctor double-booked
- [x] `trg_prescription_item_stock` — stock decrement is handled in application transaction (SELECT FOR UPDATE + decrement)

### 2.3 Stored Procedures & Functions
- [x] `fn_calculate_age(dob DATE) RETURNS INT` — SQL function using `AGE()`
- [x] `fn_flag_abnormal_lab_result(test_id UUID, value NUMERIC)` — CRITICAL/LOW/HIGH/NORMAL classification
- [ ] `fn_get_active_prescriptions(patient_id UUID)` *(Term 2)*
- [ ] `sp_complete_encounter(appointment_id, soap, icd_codes[])` *(Term 2)*

### 2.4 Views
- [x] `vw_patient_summary` — demographics + last visit + prescription count
- [x] `vw_doctor_schedule_today` — today's appointments by doctor
- [x] `vw_pending_lab_results` — investigations without results
- [x] `vw_audit_recent` — last 100 audit entries

### 2.5 Seed / Baseline Data
- [x] 5 departments (Cardiology, Neurology, Orthopaedics, Paediatrics, General Medicine)
- [x] 5 demo accounts with Indian names (Arjun Sharma/Doctor, Priya Nair/Nurse, Rohan Desai/Lab Tech, Kavya Reddy/Receptionist, System Admin)
- [x] 97 ICD-10 diagnostic codes across 12 clinical categories
- [x] 36 lab tests with clinical reference ranges across 8 categories
- [x] 8 medicines in 5 categories with stock management
- [x] Faker("en_IN") locale — all generated names are Indian
- [x] Platform starts completely blank (no patients, no appointments) — SIMULATOR_AUTOSTART=False
- [ ] Medicine catalogue expansion to 100+ entries *(Term 2)*
- [ ] 10 named doctors seeded *(currently 1 demo + simulator generates extras)*

---

## Phase 3 — Application Development

### 3.1 Backend API (FastAPI)

#### Auth Module
- [x] `POST /auth/login` — OAuth2 password flow, returns JWT access + refresh tokens + role
- [x] `POST /auth/refresh` — validates refresh token, issues new token pair
- [x] `GET /auth/me` — returns UserProfile for sidebar (name, role, department)
- [x] Role-based route guards: `Depends(require_role("DOCTOR", "ADMIN"))`
- [ ] `POST /auth/logout` — Redis token blacklist *(Term 2)*

#### Patient Module
- [x] `GET /patients` — search by name/MRN/phone, doctor-scoped, `?all=true` for booking
- [x] `POST /patients` — register patient (ADMIN/RECEPTIONIST only)
- [x] `GET /patients/{id}` — single patient with doctor scope check
- [x] `GET /patients/{id}/detail` — 360° view with role-gated sections (dx/rx/labs)
- [ ] `PUT /patients/{id}` — update demographics *(Term 2)*

#### Appointment Module
- [x] `GET /appointments` — filtered list, doctor-scoped, enriched with patient + doctor names
- [x] `POST /appointments` — conflict detection (app-level FOR UPDATE + DB trigger)
- [x] `PUT /appointments/{id}/status` — state-machine validation + role enforcement
- [ ] `GET /doctors/{id}/availability` — free slots for a date *(Term 2)*

#### Diagnosis & Prescription Module
- [x] `GET /icd10/search?q=` — server search across 97 codes (ilike)
- [x] `POST /diagnoses` — attach ICD-10 + severity + notes to appointment (DOCTOR/ADMIN)
- [x] `GET /diagnoses/{appointment_id}` — list diagnoses for appointment
- [x] `POST /prescriptions` — ACID transaction: prescription + items + stock decrement
- [x] `GET /prescriptions/{id}` — retrieve with medicine details

#### Lab Module
- [x] `GET /lab/tests` — all 36 tests for order dropdown
- [x] `GET /lab/medicines` — medicines with stock + category for prescription dropdown
- [x] `GET /lab/pending` — enriched pending queue (patient name, MRN, test, doctor, timestamp)
- [x] `POST /lab/orders` — order investigation (DOCTOR/ADMIN)
- [x] `PUT /lab/results/{id}` — enter result with auto-flag (LAB_TECHNICIAN/ADMIN)
- [x] `GET /lab/results/{appointment_id}` — results for an appointment

#### Clinical Records Module
- [x] `POST /records` — SOAP note upsert with optimistic locking (DOCTOR/ADMIN)
- [x] `GET /records/{appointment_id}` — retrieve SOAP note or null

#### Analytics Module
- [x] `GET /analytics/kpis` — 4 KPIs, role-scoped for doctor
- [x] `GET /analytics/diagnoses/top` — top 5 ICD-10, role-scoped
- [x] `GET /analytics/appointments/status-breakdown` — per-status counts, role-scoped
- [x] `GET /analytics/appointments/weekly-trend` — 7-day area chart data, role-scoped
- [x] `GET /analytics/appointments/stats` — 6-status counts for appointments page
- [ ] `GET /analytics/lab/turnaround` — average result entry time *(Term 2)*

#### Insights Module (SQL Showcase — ADMIN only)
- [x] `GET /insights/patient-ranking` — WINDOW function RANK() over visit count
- [x] `GET /insights/appointment-volume` — CTE: daily total vs completed
- [x] `GET /insights/referral-chains` — RECURSIVE CTE: doctor referral chains up to depth 8
- [x] `GET /insights/latest-lab-per-test` — LATERAL JOIN: most recent result per test
- [x] `GET /insights/performance` — EXPLAIN (ANALYZE, BUFFERS) on 3 representative queries

#### Audit Module
- [x] `GET /audit` — ADMIN only, trigger-populated, max 500 rows

#### Simulator Module
- [x] `GET /simulator/status` — running state, tick count, counters
- [x] `GET /simulator/events?limit=N` — recent activity feed
- [x] `POST /simulator/start` — ADMIN only
- [x] `POST /simulator/stop` — ADMIN only
- [x] `POST /simulator/config` — update interval without restart

### 3.2 Frontend Implementation

#### Core Infrastructure
- [x] Axios instance with JWT interceptor — auto-attach Bearer, single refresh on 401, logout on failure
- [x] Role-based routing — `ProtectedRoute` (auth check) + `RoleRoute` (role check)
- [x] Reusable components: `Modal`, `PageHeader`, `StatusBadge`, `SearchSelect`, `Toast`, `AppointmentStatusControl`
- [x] Global toast notifications (success/error/info, auto-dismiss 4s)
- [x] `cn()` utility for conditional class names

#### Pages — Completed
- [x] `LoginPage` — GSAP floating orbs, quick demo role buttons, OAuth2 form
- [x] `DashboardPage` — role-aware KPIs, charts, quick actions, lab queue widget for LAB_TECH, sim panel for ADMIN
- [x] `PatientListPage` — search, gender/blood filters, stat cards, clickable rows (role-gated), register button (ADMIN/RECEPTIONIST)
- [x] `PatientDetailPage` — 360° view, role-gated sections, action buttons per role:
  - DOCTOR/ADMIN: Note (SOAP), Dx (diagnosis), Rx (prescription), Lab (order)
  - LAB_TECH/ADMIN: Enter result on pending labs
  - ADMIN/DOCTOR/RECEPTIONIST: Book Appointment button
- [x] `AppointmentPage` — 6 stat cards, Patient+Doctor columns, clickable rows → patient detail, inline status change (portal dropdown)
- [x] `InsightsPage` — 4 SQL showcase cards + EXPLAIN ANALYZE panel (ADMIN only)
- [x] `AuditLogPage` — operation badges, table names, timestamps, user IDs (ADMIN only)
- [x] `LabQueuePage` — pending work queue with search, category grouping, Enter Result button, auto-refresh

#### Clinical Forms — Completed
- [x] `BookAppointmentForm` — doctor auto-filled + locked, conflict detection (409)
- [x] `RegisterPatientForm` — full demographics with MRN auto-generated
- [x] `SoapEditor` — SOAP fields, version display, optimistic locking
- [x] `AddDiagnosisForm` — debounced ICD-10 server search, selected code card, severity grid with descriptions, notes with char count
- [x] `AddPrescriptionForm` — per-item searchable medicine picker, category groups, stock badges, full frequency labels
- [x] `OrderLabForm` — searchable + browse-toggle, 8 test categories, reference range preview
- [x] `EnterLabResultForm` — numeric entry, live flag preview (CRITICAL/HIGH/LOW/NORMAL), onSuccess callback

#### Role Permission Matrix — Implemented
| Action | ADMIN | DOCTOR | NURSE | LAB TECH | RECEPTIONIST |
|---|:---:|:---:|:---:|:---:|:---:|
| Register patient | ✅ | — | — | — | ✅ |
| View patient list | ✅ All | ✅ Own | ✅ All | ✅ All | ✅ List only |
| View patient detail | ✅ | ✅ Own | ✅ | ✅ Labs only | ❌ |
| Book appointment | ✅ | ✅ | — | — | ✅ |
| Write SOAP note | ✅ | ✅ | — | — | — |
| Add diagnosis | ✅ | ✅ | — | — | — |
| Issue prescription | ✅ | ✅ | — | — | — |
| Order lab test | ✅ | ✅ | — | — | — |
| Enter lab result | ✅ | — | — | ✅ | — |
| Change appt status | ✅ All | ✅ Own | IN_PROG/DONE/NS | — | CANCEL only |
| SQL Insights | ✅ | — | — | — | — |
| Audit Log | ✅ | — | — | — | — |
| Lab Queue page | ✅ | — | — | ✅ | — |
| Sim engine controls | ✅ | — | — | — | — |

---

## Phase 4 — Query Optimisation & Indexing

### 4.1 Index Design
- [x] B-tree indexes on all foreign keys (`idx_appointment_patient`, `idx_appointment_doctor`, etc.)
- [x] Composite index on `appointment(doctor_id, start_time)` — supports schedule queries
- [x] Composite index on `appointment(patient_id, status)` — supports patient history
- [x] Partial index on `appointment(doctor_id) WHERE status = 'SCHEDULED'` — active schedule lookup
- [x] Index on `lab_result(investigation_id)` — join performance
- [x] GIN index on `audit_log.old_data` and `new_data` (JSONB columns)
- [ ] GIN index on `clinical_record` using `tsvector` for full-text note search *(Term 2)*
- [ ] Index on `lab_result(recorded_at DESC)` for trend queries *(Term 2)*

### 4.2 Query Analysis
- [x] EXPLAIN (ANALYZE, BUFFERS) running on 3 representative queries via `/insights/performance`
- [x] Index usage detection (scans output for "Index" string)
- [x] Execution time extracted and displayed in UI
- [ ] Formal before/after optimisation report *(Term 2 submission)*

### 4.3 Advanced SQL Showcase
- [x] **WINDOW function** — `RANK() OVER (ORDER BY COUNT(appointment_id) DESC)` for patient visit ranking
- [x] **CTE** — daily appointment volume with completion rate
- [x] **RECURSIVE CTE** — doctor referral chains (anchor + recursive step, depth ≤ 8)
- [x] **LATERAL JOIN** — most recent lab result per test type per patient

---

## Phase 5 — Security, Transactions & Recovery

### 5.1 Role-Based Access Control (RBAC)
- [x] PostgreSQL roles defined: `app_admin`, `app_doctor`, `app_nurse`, `app_lab_tech`, `app_receptionist` (04_roles.sql)
- [x] Application-level `require_role()` dependency factory on all sensitive routes
- [x] Frontend route guards: `ProtectedRoute` (auth) + `RoleRoute` (role)
- [x] Nav items filtered by `navForRole()` — role-specific sidebar
- [x] Data scoping: doctor sees only own patients/appointments/KPIs
- [ ] Column-level masking via views for non-clinical roles *(Term 2)*
- [ ] `patient_consent` table *(Term 2)*

### 5.2 Data Security
- [x] Passwords hashed with bcrypt, work factor 12
- [x] JWT: access token 15 min, refresh token 7 days
- [x] Separate "access" vs "refresh" token type claim — prevents refresh token use as access
- [x] Auto-refresh on 401: single retry with lock flag (no concurrent refresh loops)
- [ ] pgcrypto column encryption for insurance_number *(Term 2)*
- [ ] Rate limiting on auth endpoints *(Term 2)*

### 5.3 Transaction Management
- [x] Prescription creation: atomic — `Prescription` + `PrescriptionItem` rows + `Medicine.stock_count` decrements in one `db.commit()`
- [x] `SELECT ... FOR UPDATE` on medicine rows during prescription (concurrent booking safety)
- [x] Appointment conflict: application-level `SELECT FOR UPDATE` + DB trigger (double enforcement)
- [x] SOAP note upsert: optimistic locking — version mismatch returns 409 with clear message
- [ ] `sp_complete_encounter` stored procedure *(Term 2)*
- [ ] ACID demo test case with rollback *(Term 2)*

### 5.4 Concurrency Control
- [x] `SELECT FOR UPDATE` on appointment conflict check — prevents race condition under concurrent booking
- [x] Optimistic locking on `clinical_record.version` — concurrent edit detection
- [ ] Deadlock demonstration and documentation *(Term 2)*

### 5.5 Backup & Recovery
- [ ] `pg_dump` backup script *(Term 2)*
- [ ] PITR plan documentation *(Term 2)*
- [ ] Recovery test *(Term 2)*

---

## Phase 6 — Multimodal Extension (Term 2)

### 6.1 Medical Image Management (DICOM)
- [ ] Design `MedicalImage` table
- [ ] `POST /images/upload` endpoint
- [ ] Cornerstone.js DICOM viewer integration
- [ ] Image search by modality, body part, date

### 6.2 ECG & Vitals Time-Series (TimescaleDB)
- [ ] Enable TimescaleDB extension
- [ ] `VitalReading` hypertable design
- [ ] Time-range vitals API
- [ ] ECG waveform visualisation

### 6.3 Lab Report Document Storage
- [ ] `LabReportDocument` table
- [ ] PDF upload + PyMuPDF text extraction
- [ ] Full-text search on extracted content
- [ ] react-pdf in-browser rendering

### 6.4 Spatial Data (PostGIS)
- [ ] Enable PostGIS extension
- [ ] Patient / Hospital location columns
- [ ] `GET /hospitals/nearby` with `ST_DWithin`

---

## Phase 7 — AI Capabilities

### 7.1 Drug Interaction Checker
- [ ] OpenFDA API integration on prescription save
- [ ] Warning banner in Prescription UI
- [ ] `DrugInteractionLog` table

### 7.2 Clinical Notes Auto-Summarisation
- [ ] OpenAI / Ollama integration
- [ ] `POST /ai/summarise-notes` endpoint
- [ ] AI summary panel on Clinical Record page

### 7.3 Diagnosis Suggestion
- [ ] Symptom → ICD-10 classifier (scikit-learn)
- [ ] `POST /ai/suggest-diagnosis` endpoint
- [ ] Helper panel in Diagnosis form

### 7.4 Abnormal Lab Result Alerting
- [x] `fn_flag_abnormal_lab_result` function implemented (CRITICAL/HIGH/LOW/NORMAL)
- [x] Flag preview shown live in EnterLabResultForm before save
- [ ] WebSocket push to doctor on CRITICAL result *(Term 2)*
- [ ] `GET /alerts/active` endpoint *(Term 2)*
- [ ] Alert banner on Doctor dashboard *(Term 2)*

### 7.5 Appointment Demand Forecasting
- [ ] Prophet time-series forecasting
- [ ] 30-day demand forecast by department
- [ ] Forecast chart on Analytics dashboard

---

## Phase 8 — Testing & Documentation

### 8.1 Backend Testing
- [x] pytest scaffold present (`backend/tests/`)
- [ ] Unit tests for all service functions
- [ ] Integration tests for all API endpoints
- [ ] Trigger tests (conflict, audit, stock)
- [ ] Transaction rollback test
- [ ] ≥ 80% code coverage

### 8.2 Frontend Testing
- [ ] Vitest + React Testing Library component tests
- [ ] Playwright E2E: Login → Register → Appointment → Diagnose → Prescribe

### 8.3 Database Testing
- [ ] FK constraint enforcement tests
- [ ] CHECK constraint rejection tests
- [ ] Trigger correctness tests
- [ ] Edge input tests (null DOB, zero-day prescription)

### 8.4 Documentation
- [x] FastAPI auto-generated Swagger UI at `/docs`
- [x] `README.md` with architecture, setup, demo accounts
- [x] `DBSA_Project_Plan.md` (this document) — live progress tracker
- [ ] Database Design Document (ER diagram, DDL, normalisation proofs)
- [ ] 5-minute demo video
- [ ] API documentation export (Postman collection)

---

## Phase 9 — Final Viva & Submission

### 9.1 Submission Checklist
- [ ] SRS document (finalised)
- [ ] ER/EER diagram (draw.io / PDF export)
- [ ] Relational schema (DDL file)
- [ ] Normalisation report
- [ ] Database source files (bootstrap SQL, seed scripts)
- [ ] Full application source code
- [ ] API documentation link or Postman export
- [ ] Test coverage report
- [ ] Demo video (5 minutes)
- [ ] Term 2 multimodal extension documentation

### 9.2 Viva Preparation
- [x] Can explain every table in the ER model and design decisions
- [x] Can demonstrate ACID: prescription creation (atomic stock decrement + items)
- [x] Can demonstrate trigger: `trg_appointment_conflict` raises exception on double-book
- [x] Can demonstrate optimistic locking: SOAP note version conflict (409 response)
- [x] Can explain RBAC: `require_role()` factory, `navForRole()`, `RoleRoute`
- [x] Can explain all 4 advanced SQL patterns (Window, CTE, Recursive CTE, LATERAL)
- [x] Can explain index strategy: composite, partial, GIN
- [ ] Prepare live SQL query demonstrations
- [ ] Explain PITR recovery plan
- [ ] Explain one AI feature in detail

---

## Features Summary

### Term 1 Core Features
| Feature | Status |
|---|---|
| Patient registration and profile management | ✅ Complete |
| Role-based login and access control | ✅ Complete |
| Appointment scheduling with conflict detection | ✅ Complete |
| Appointment status workflow (5 states, role-gated transitions) | ✅ Complete |
| ICD-10 diagnosis coding and entry (97 codes, server search) | ✅ Complete |
| Prescription management (8 medicines, searchable picker, ACID) | ✅ Complete |
| Lab investigation ordering (36 tests, searchable + grouped) | ✅ Complete |
| Abnormal lab result flagging (CRITICAL/HIGH/LOW/NORMAL) | ✅ Complete |
| Lab technician work queue with notifications | ✅ Complete |
| Clinical record / SOAP note creation with optimistic locking | ✅ Complete |
| Audit trail for all sensitive operations (PostgreSQL trigger) | ✅ Complete |
| Analytics dashboard — KPIs, charts, role-scoped data | ✅ Complete |
| Advanced SQL showcase (Window / CTE / Recursive / LATERAL) | ✅ Complete |
| EXPLAIN ANALYZE query plan viewer | ✅ Complete |
| Live hospital simulation engine | ✅ Complete |
| Full-text search on clinical notes (tsvector/GIN) | ⏳ Term 2 |
| PUT /patients/{id} — edit demographics | ⏳ Term 2 |
| sp_complete_encounter stored procedure | ⏳ Term 2 |
| Drug interaction check via OpenFDA | ⏳ Term 2 |
| CRITICAL result WebSocket push alerts | ⏳ Term 2 |

### Term 2 Multimodal Features
| Feature | Status |
|---|---|
| DICOM medical image upload and metadata storage | 🔲 Term 2 |
| In-browser DICOM image viewer (Cornerstone.js) | 🔲 Term 2 |
| ECG / vitals time-series storage (TimescaleDB) | 🔲 Term 2 |
| Vital sign trend charts and waveform display | 🔲 Term 2 |
| Lab report PDF upload and storage | 🔲 Term 2 |
| PDF text extraction and full-text search | 🔲 Term 2 |
| Spatial patient-to-hospital proximity search (PostGIS) | 🔲 Term 2 |
| AI clinical notes summarisation (GPT-4o / Ollama) | 🔲 Term 2 |
| AI diagnosis suggestion from symptoms (scikit-learn) | 🔲 Term 2 |
| AI appointment demand forecasting (Prophet) | 🔲 Term 2 |
| MONAI chest X-ray AI classification | 🔲 Term 2 |

---

## Best Practices

### Database Design
- Use **UUIDs** as primary keys — avoids enumeration attacks, works in distributed setups
- Every table has `created_at` and `updated_at` — managed by trigger, never by application code
- Use `ENUM` types for status fields — ensures integrity and self-documents allowed values
- Always define `ON DELETE` behaviour explicitly on every foreign key
- Keep lookup/reference tables separate (`DiagnosisCode`, `Medicine`, `LabTest`) — never hardcode

### SQL & Query Writing
- Prefer **explicit JOINs** over implicit (comma-separated FROM)
- Always use **parameterised queries** — SQLAlchemy ORM/text() prevents SQL injection
- Use `EXPLAIN ANALYSE` before and after adding indexes — never guess, measure
- Use `SELECT FOR UPDATE` for concurrent booking to prevent race conditions

### Application Code
- Never log sensitive patient data — log event types and UUIDs only
- All secrets in `.env` — never committed to Git
- API responses never expose raw passwords or internal error traces
- Validate all inputs server-side (Pydantic schemas enforce types + constraints)
- Frontend role checks are UX only — real enforcement is always on the backend

### Security
- bcrypt work factor 12 on all passwords
- JWT access token 15 min, refresh 7 days, separate `type` claim
- Auto-refresh: single retry with `refreshing` lock flag prevents concurrent loops
- Backend `require_role()` is the authoritative access gate — frontend nav is convenience only

---

## Future Improvements

### Short-Term (Post-Submission)
- **Mobile App** — React Native (shared API) for patient self-service
- **Telemedicine Module** — WebRTC video consultation linked to appointment
- **Patient Portal** — separate frontend for patients to view results and book
- **Insurance Claim Automation** — generate claim documents from clinical data

### Medium-Term
- **HL7 FHIR Compliance** — FHIR R4 standard API for interoperability
- **Real-Time ICU Monitoring** — WebSocket vitals streamed to nurse board
- **Automated Report Generation** — LLM-powered discharge summaries
- **Multi-Hospital Support** — multi-tenant schema with `hospital_id` isolation

### Long-Term / Research-Grade
- **Federated Learning** — train diagnosis models across hospitals without sharing raw data
- **Genomics Integration** — patient genomic markers linked to diagnosis and treatment
- **Blockchain Audit Log** — immutable, verifiable audit trail via permissioned blockchain
- **Natural Language Query Interface** — "Show all diabetic patients over 60 with HbA1c > 8"

---

*Last Updated: 25 September 2026 | MediTrack v1.4.0*
*Built for BITS Pilani WILP — SESAP ZC337 Database Systems and Applications*
*Term 1 Core: ✅ Complete | Term 2 Multimodal + AI: 🔲 Planned*
