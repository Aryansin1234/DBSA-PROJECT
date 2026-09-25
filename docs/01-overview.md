# 01 · Project Overview

## What is MediTrack?

MediTrack is a **full-stack clinical record management system** built for
BITS Pilani WILP SESAP ZC337. It manages the complete lifecycle of patient care
in a single, secure, role-aware platform — replacing paper registers and
disconnected spreadsheets.

```
┌────────────┐   ┌─────────────┐   ┌────────────────┐   ┌──────────────┐
│  Register  │──▶│    Book     │──▶│   Diagnose     │──▶│  Prescribe   │
│  Patient   │   │ Appointment │   │  (97 ICD-10)   │   │ (8 medicines)│
└────────────┘   └─────────────┘   └────────────────┘   └──────────────┘
                                                                 │
                         ┌───────────────────────────────────────┘
                         ▼
              ┌─────────────────────┐   ┌─────────────────┐
              │   Order Lab Test    │──▶│  Enter Result   │
              │   (36 test types)   │   │  (auto-flagged) │
              └─────────────────────┘   └─────────────────┘
                         │
                         ▼
              ┌─────────────────────┐   ┌──────────────────┐
              │   SOAP Clinical     │──▶│   Audit Log      │
              │   Note (versioned)  │   │  (every change)  │
              └─────────────────────┘   └──────────────────┘
```

## The Problem It Solves

| Problem in a paper/spreadsheet clinic | How MediTrack fixes it |
|---|---|
| Same patient re-entered in many registers | One `patient` record, referenced everywhere via FK |
| Prescriptions with no traceable patient | Foreign keys guarantee valid links; stock auto-decrements |
| No record of who changed what | `audit_log` PostgreSQL trigger captures every change (old + new JSONB) |
| Doctors double-booked | Appointment conflict trigger + `SELECT FOR UPDATE` row locking |
| Abnormal lab values missed | Auto-flagging: `NORMAL / LOW / HIGH / CRITICAL` vs reference range |
| Anyone can see anything | 5 roles, backend `require_role()` + frontend `RoleRoute` guards |
| No clinical workflow for doctors | Full modal forms: diagnose → prescribe → order lab → SOAP note |
| Lab results lost | Work queue dashboard for lab technician with pending-test notifications |

## Core Entities

| Entity | Meaning | Key fields |
|---|---|---|
| **Person** | Base record for any human | name, DOB, gender, email |
| **Patient** | A person receiving care | MRN (auto-generated), blood group, insurance |
| **Healthcare Professional** | A staff member | role, license number, department, password hash |
| **Department** | Clinical unit | Cardiology, Neurology, Orthopaedics, Paediatrics, General Medicine |
| **Appointment** | A scheduled visit | doctor + patient + time window + status workflow |
| **DiagnosisCode** | ICD-10 lookup table | 97 codes across 12 clinical categories |
| **Diagnosis** | A coded condition on a visit | ICD-10 code, severity (MILD/MODERATE/SEVERE/CRITICAL), notes |
| **Medicine** | Drug catalogue entry | name, category, stock count |
| **Prescription** | Medicines issued per visit | items with dosage, frequency, duration |
| **LabTest** | Test catalogue | 36 tests with reference ranges (ref_low, ref_high, unit) |
| **LabInvestigation** | An ordered test | links appointment + test + ordering doctor |
| **LabResult** | Measured value + flag | auto-classified against reference range |
| **ClinicalRecord** | SOAP encounter summary | Subjective/Objective/Assessment/Plan + version |
| **Referral** | Doctor-to-doctor referral | powers the recursive CTE in SQL Insights |
| **AuditLog** | Change trail | trigger-generated, JSONB old/new, table + operation + user |

## Who Uses It (Actors)

| Role | Real-world person | What they do in MediTrack |
|---|---|---|
| **Admin** | System administrator | Full access, SQL Insights, Audit Log, Simulation Engine |
| **Receptionist** | Front desk staff | Register patients, book appointments |
| **Doctor** | Physician | Diagnose, prescribe, order lab tests, write SOAP notes |
| **Lab Technician** | Lab staff | Enter lab test results via work queue |
| **Nurse** | Nursing staff | View patient clinical data, update appointment status |

See [`04-roles-and-access.md`](./04-roles-and-access.md) for the exact permission matrix.

## How Data is Generated

MediTrack ships with a **live simulation engine** — not a one-shot seed script.

- The platform starts **completely blank** (0 patients, 0 appointments).
- The simulation engine runs as a background thread, generating realistic hospital
  activity: patient registrations, bookings, diagnoses, prescriptions, lab orders
  and results — continuously.
- An Admin can **start, stop, and tune** the engine from the dashboard.
- Without the engine running, users enter data manually via the UI.

See [`09-simulation-engine.md`](./09-simulation-engine.md) for full details.

## Term 1 vs Term 2 Scope

| Term 1 — Delivered ✅ | Term 2 — Planned 🔲 |
|---|---|
| Full relational schema (15 tables) | DICOM Viewer — medical image upload + Cornerstone.js |
| JWT auth, 5-role RBAC | AI Summaries — SOAP note summarisation + drug-interaction checker |
| Appointment lifecycle (5 states) | Demand Forecasting — Prophet time-series + TimescaleDB vitals |
| Diagnosis (97 ICD-10 codes) | |
| Prescription (ACID transaction) | |
| Lab investigation (36 tests, auto-flag) | |
| SOAP clinical notes (optimistic locking) | |
| PostgreSQL triggers, views, indexes | |
| Advanced SQL (Window / CTE / Recursive / LATERAL) | |
| Live simulation engine | |
| Lab tech work queue dashboard | |
| Full role-gated UI per role | |
