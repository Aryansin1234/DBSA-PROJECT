# 03 · Data Model

## Entity-Relationship Overview

```
PERSON ──────────────────────────────────────────────────────────────────
  │ (ISA / generalisation)
  ├── PATIENT              (patient_id → person_id)
  │     └──────────── APPOINTMENT ──── HEALTHCARE_PROFESSIONAL
  │                        │                │
  │              ┌─────────┼─────────┐      └── DEPARTMENT
  │              ▼         ▼         ▼
  │         DIAGNOSIS  PRESCRIPTION  LAB_INVESTIGATION
  │              │         │              │
  │       DIAGNOSIS_  PRESCRIPTION_   LAB_RESULT
  │          CODE       ITEM
  │              │         │
  │       (ICD-10)    MEDICINE
  │                        │
  │                 MEDICINE_CATEGORY
  │
  └── CLINICAL_RECORD   (one SOAP note per appointment)
  └── REFERRAL           (from_doctor → to_doctor, powers recursive CTE)
  └── AUDIT_LOG          (trigger-populated, JSONB old/new)
```

## Tables at a Glance

| Table | Purpose | Key columns |
|---|---|---|
| `person` | Shared human fields (generalisation supertype) | person_id (UUID PK), first_name, last_name, date_of_birth, gender (ENUM), email |
| `patient` | Patients receiving care | patient_id (UUID PK/FK → person), mrn (unique), blood_group (ENUM), emergency_contact, insurance_number |
| `department` | Clinical units | department_id (UUID PK), name |
| `healthcare_professional` | All staff + login credentials | professional_id (UUID PK/FK → person), role (ENUM), department_id FK, license_number, password_hash |
| `appointment` | Scheduled visits | appointment_id (UUID PK), patient_id FK, doctor_id FK, start_time, end_time, status (ENUM), reason |
| `diagnosis_code` | ICD-10 reference — 97 codes | icd10_code (VARCHAR PK), description |
| `diagnosis` | Per-visit coded condition | diagnosis_id (UUID PK), appointment_id FK, icd10_code FK, severity (ENUM), notes |
| `medicine_category` | Drug groups | category_id (UUID PK), name |
| `medicine` | Drug catalogue with stock | medicine_id (UUID PK), name, category_id FK, stock_count (CHECK ≥ 0) |
| `prescription` | Rx header per visit | prescription_id (UUID PK), appointment_id FK, issued_at |
| `prescription_item` | Rx line (weak entity) | (prescription_id + medicine_id) composite PK, dosage, frequency, duration_days (CHECK > 0) |
| `lab_test` | Test catalogue — 36 tests | test_id (UUID PK), name, unit, ref_low, ref_high |
| `lab_investigation` | Ordered test | investigation_id (UUID PK), appointment_id FK, test_id FK, ordered_by FK, ordered_at |
| `lab_result` | Measured value + auto-flag | result_id (UUID PK), investigation_id FK, value (NUMERIC CHECK ≥ 0), flag (ENUM), recorded_by FK |
| `clinical_record` | SOAP encounter summary | record_id (UUID PK), appointment_id FK, subjective, objective, assessment, plan, version (optimistic lock) |
| `referral` | Doctor→doctor referral | referral_id (UUID PK), from_doctor_id FK, to_doctor_id FK, patient_id FK |
| `audit_log` | All change history | audit_id (BIGINT PK), table_name, operation, user_id, old_data (JSONB), new_data (JSONB), changed_at |

## ENUMs

| ENUM | Values |
|---|---|
| `gender_enum` | MALE, FEMALE, OTHER |
| `blood_group_enum` | A+, A−, B+, B−, AB+, AB−, O+, O− |
| `professional_role` | ADMIN, DOCTOR, NURSE, LAB_TECHNICIAN, RECEPTIONIST |
| `appointment_status` | SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW |
| `severity_enum` | MILD, MODERATE, SEVERE, CRITICAL |
| `lab_flag_enum` | NORMAL, LOW, HIGH, CRITICAL |

## Key Design Decisions

### 1. Generalisation: `Person` supertype
A patient and a doctor share common fields (name, DOB, gender, email). `person`
holds those shared attributes; `patient` and `healthcare_professional` extend it
with a **shared UUID primary key** (ISA hierarchy). No data duplication.

```
person (person_id, first_name, last_name, date_of_birth, gender, email)
    │
    ├── patient (patient_id = person_id, mrn, blood_group, ...)
    └── healthcare_professional (professional_id = person_id, role, password_hash, ...)
```

### 2. Weak entity: `prescription_item`
A prescription line cannot exist without its parent prescription. Its PK is
**composite**: `(prescription_id, medicine_id)`. This enforces that a medicine
appears at most once per prescription.

### 3. ICD-10 as a lookup table (97 codes)
`diagnosis_code` is a reference table with 97 ICD-10 codes across 12 clinical
categories (Endocrine, Cardiovascular, Respiratory, GI, Renal, Musculoskeletal,
Neurological/Mental Health, Dermatology, Infections, Eyes/ENT, Oncology,
Haematological). `diagnosis.icd10_code` has a FOREIGN KEY `RESTRICT` to it.

### 4. Lab test catalogue (36 tests with reference ranges)
`lab_test` stores `ref_low` and `ref_high` for each test. `fn_flag_abnormal_lab_result()`
compares the entered value against these to produce `NORMAL / LOW / HIGH / CRITICAL`:
- `value < ref_low × 0.5` or `value > ref_high × 1.5` → **CRITICAL**
- `value < ref_low` → **LOW**
- `value > ref_high` → **HIGH**
- otherwise → **NORMAL**

### 5. Appointment status state machine
Valid transitions enforced at **both** backend and frontend:

```
SCHEDULED ──▶ IN_PROGRESS ──▶ COMPLETED
     │               │
     ├──▶ CANCELLED  └──▶ CANCELLED
     └──▶ NO_SHOW
```
Terminal states (COMPLETED, CANCELLED, NO_SHOW) cannot be changed. Each role
is restricted to specific transitions (see `04-roles-and-access.md`).

### 6. Optimistic locking on `clinical_record`
`version` is an integer incremented on every save. The client must send back the
version it last read; a mismatch returns `409 Conflict` ("Record was modified by
someone else — reload and retry").

### 7. UUID primary keys everywhere
No auto-increment integers. UUIDs prevent enumeration attacks (`/patients/1`, `/patients/2`)
and work in distributed / multi-tenant setups.

### 8. `created_at` / `updated_at` on every mutable table
Set by a PostgreSQL trigger (`trg_set_updated_at`) — never by application code.

## Prescription Data Model (detailed)

A single `prescription` has one or more `prescription_item` rows. Each item
links to a `medicine` and carries dosage, frequency, and duration. When a
prescription is created:

1. `Prescription` row inserted (appointment_id, issued_at)
2. For each item: `SELECT medicine FOR UPDATE` → validate `stock_count > 0` → `stock_count -= 1`
3. `PrescriptionItem` row inserted
4. **Single `db.commit()`** — all or nothing (ACID)

Frequency values: `OD` (once daily), `BID` (twice), `TID` (three times),
`QID` (four times), `HS` (at bedtime), `SOS` (as needed).

## Lab Investigation Data Model (detailed)

```
lab_test (catalogue)
    └── lab_investigation (ordered test, per appointment)
              └── lab_result (entered by lab tech, auto-flagged)
```

A `lab_investigation` is created by a Doctor via `POST /lab/orders`. It has no
result until a Lab Technician enters one via `PUT /lab/results/{investigation_id}`.
The pending investigations (no result yet) appear in the **Lab Queue** page and
dashboard notification widget for lab technicians.

## Referral (Recursive CTE source)

```
REFERRAL (referral_id, from_doctor_id → professional, to_doctor_id → professional,
          patient_id → patient, reason)
```

Referrals are created by the simulation engine and demonstrated in SQL Insights
via a `WITH RECURSIVE` CTE that walks referral chains up to depth 8.

## Normalisation

All tables are in **3NF**; `prescription_item`, `lab_result`, and `diagnosis`
are in **BCNF**:
- `prescription_item`: PK is `(prescription_id, medicine_id)` — no non-key
  attributes depend on only part of the PK.
- `lab_result`: `value` and `flag` depend on the full PK (`result_id`) which
  points to one `investigation_id`.
- `diagnosis`: `severity` and `notes` depend on `diagnosis_id` alone; no
  transitive dependencies.
