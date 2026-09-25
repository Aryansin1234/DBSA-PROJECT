# 05 · API Reference

**Base URL:** `http://localhost:8000/api`
**Interactive docs (Swagger UI):** `http://localhost:8000/docs`

All endpoints except `/auth/login` and `/auth/refresh` require:
```
Authorization: Bearer <access_token>
```

Role annotations: 🔓 any authenticated · 🟢 specific roles listed

---

## Auth

### `POST /auth/login`
OAuth2 password flow (form-encoded).

**Request** (`application/x-www-form-urlencoded`):
```
username=admin@meditrack.dev&password=Admin@123
```
**Response** `200`:
```json
{ "access_token": "eyJ...", "refresh_token": "eyJ...", "token_type": "bearer", "role": "ADMIN" }
```

### `POST /auth/refresh`
```json
{ "refresh_token": "eyJ..." }
```
Returns a fresh token pair with the same role.

### `GET /auth/me` 🔓
Returns the signed-in user's profile (name, role, department) for the sidebar.
```json
{ "id": "uuid", "name": "Arjun Sharma", "email": "doctor@meditrack.dev", "role": "DOCTOR", "department": "Cardiology", "license_number": "DOC-0001" }
```

---

## Patients

### `GET /patients` 🔓
List/search patients. Doctor role auto-scoped to own patients (unless `?all=true`).

| Query param | Type | Description |
|---|---|---|
| `q` | string | Search name / MRN / phone (ilike) |
| `limit` | int | Page size (max 200, default 50) |
| `offset` | int | Skip N records |
| `all` | bool | `true` to bypass doctor scoping (for booking form) |

**Response** `200`:
```json
[{ "patient_id": "uuid", "mrn": "MRN3A1B2C3D", "first_name": "Vikram", "last_name": "Mehta", "age": 42, "gender": "MALE", "phone": "9876543210", "blood_group": "B+" }]
```

### `POST /patients` 🟢 Admin, Receptionist
```json
{ "first_name": "Vikram", "last_name": "Mehta", "date_of_birth": "1984-03-12", "gender": "MALE", "phone": "9876543210", "email": "vikram@example.com", "blood_group": "B+", "emergency_contact": "9123456789", "insurance_number": "INS-001" }
```
MRN is auto-generated (`"MRN" + 8 hex chars`). Returns `201`.

### `GET /patients/{id}` 🔓
Single patient demographics. Doctor restricted to own patients (403 otherwise).

### `GET /patients/{id}/detail` 🔓
360° clinical view. **Role-gated sections:**
- Appointments — all roles (except Receptionist who is blocked entirely)
- Diagnoses + Prescriptions — Doctor, Admin, Nurse
- Lab results — Doctor, Admin, Nurse, Lab Technician
- Doctor scoped to own appointments within the detail view

**Response** `200`:
```json
{
  "patient": { "patient_id": "uuid", "mrn": "MRN3A1B2C3D", "first_name": "Vikram", "age": 42, "gender": "MALE", "blood_group": "B+" },
  "email": "vikram@example.com",
  "insurance_number": "INS-001",
  "emergency_contact": "9123456789",
  "stats": { "appointments": 4, "diagnoses": 2, "prescriptions": 1, "labs": 3 },
  "appointments": [{ "appointment_id": "uuid", "start_time": "2026-09-20T10:00:00Z", "status": "COMPLETED", "reason": "Diabetes management", "doctor_name": "Dr. Arjun Sharma" }],
  "diagnoses": [{ "icd10_code": "E11.9", "description": "Type 2 diabetes mellitus without complications", "severity": "MODERATE", "notes": "Newly diagnosed" }],
  "prescriptions": [{ "prescription_id": "uuid", "issued_at": "2026-09-20T10:30:00Z", "items": ["Metformin 500mg — 500mg, BID"] }],
  "labs": [{ "investigation_id": "uuid", "test_name": "HbA1c", "value": 8.2, "flag": "HIGH", "ordered_at": "2026-09-20T10:15:00Z" }]
}
```

---

## Professionals

### `GET /professionals` 🔓
List staff. Used to populate doctor dropdowns.

| Query param | Description |
|---|---|
| `role` | Filter by role e.g. `DOCTOR` |

---

## Appointments

### `GET /appointments` 🔓
Doctor-scoped automatically. Sorted by `start_time DESC`. Enriched with `patient_name` and `doctor_name`.

| Query param | Description |
|---|---|
| `doctor_id` | Filter by doctor (Admin/Nurse/Receptionist only — ignored for DOCTOR role) |
| `patient_id` | Filter by patient |
| `status` | Filter by status e.g. `SCHEDULED` |

**Response** `200`:
```json
[{ "appointment_id": "uuid", "patient_id": "uuid", "doctor_id": "uuid", "patient_name": "Vikram Mehta", "doctor_name": "Dr. Arjun Sharma", "start_time": "2026-09-25T09:00:00Z", "end_time": "2026-09-25T09:30:00Z", "status": "SCHEDULED", "reason": "Follow-up" }]
```

### `POST /appointments` 🟢 Admin, Receptionist, Doctor
```json
{ "patient_id": "uuid", "doctor_id": "uuid", "start_time": "2026-10-01T09:00:00Z", "end_time": "2026-10-01T09:30:00Z", "reason": "Routine check-up" }
```
Returns `409 Conflict` if the doctor already has a `SCHEDULED` appointment overlapping that window.
Returns `422` if `end_time <= start_time`.

### `PUT /appointments/{id}/status` 🟢 Admin, Doctor, Nurse, Receptionist
```json
{ "status": "IN_PROGRESS" }
```
State-machine validated. Returns `422` for invalid transitions (e.g. COMPLETED → SCHEDULED).
Returns `403` if the role is not permitted for that target status.

---

## Diagnoses

### `GET /icd10/search?q=diab` 🔓
Server-side search across 97 ICD-10 codes by description or code (ilike, max 20 results).
```json
[{ "icd10_code": "E11.9", "description": "Type 2 diabetes mellitus without complications" }]
```

### `POST /diagnoses` 🟢 Doctor, Admin
```json
{ "appointment_id": "uuid", "icd10_code": "E11.9", "severity": "MODERATE", "notes": "Newly diagnosed, refer dietitian" }
```
Returns `404` if the ICD-10 code doesn't exist in the catalogue. Returns `201`.

### `GET /diagnoses/{appointment_id}` 🔓
All diagnoses for an appointment.

---

## Prescriptions

### `POST /prescriptions` 🟢 Doctor, Admin
Creates prescription + items + decrements stock — **all in one atomic transaction**.
```json
{
  "appointment_id": "uuid",
  "items": [
    { "medicine_id": "uuid", "dosage": "500mg", "frequency": "BID", "duration_days": 14 },
    { "medicine_id": "uuid", "dosage": "40mg",  "frequency": "OD",  "duration_days": 30 }
  ]
}
```
Returns `409` if any medicine is out of stock (entire transaction rolls back).
Returns `201` with the created prescription.

Frequency values: `OD`, `BID`, `TID`, `QID`, `HS`, `SOS`

### `GET /prescriptions/{id}` 🔓
```json
{ "prescription_id": "uuid", "appointment_id": "uuid", "issued_at": "...", "items": [{ "medicine_id": "uuid", "dosage": "500mg", "frequency": "BID", "duration_days": 14 }] }
```

---

## Lab

### `GET /lab/tests` 🔓
All 36 lab tests for the order-lab dropdown.
```json
[{ "test_id": "uuid", "name": "HbA1c", "unit": "%", "ref_low": 4.0, "ref_high": 5.6 }]
```

### `GET /lab/medicines` 🟢 Doctor, Admin
All medicines with stock and category, for the prescription picker.
```json
[{ "medicine_id": "uuid", "name": "Metformin 500mg", "stock_count": 142, "category": "Antidiabetic" }]
```

### `GET /lab/pending` 🟢 Lab Technician, Admin
Pending investigations (no result yet) — **enriched** with patient and test info.
```json
[{
  "investigation_id": "uuid",
  "appointment_id": "uuid",
  "patient_id": "uuid",
  "patient_name": "Vikram Mehta",
  "mrn": "MRN3A1B2C3D",
  "test_id": "uuid",
  "test_name": "HbA1c",
  "unit": "%",
  "ref_low": 4.0,
  "ref_high": 5.6,
  "ordered_by_name": "Dr. Arjun Sharma",
  "ordered_at": "2026-09-25T08:30:00Z"
}]
```

### `POST /lab/orders` 🟢 Doctor, Admin
```json
{ "appointment_id": "uuid", "test_id": "uuid" }
```
Creates a `lab_investigation`. Returns `404` if test_id doesn't exist.

### `PUT /lab/results/{investigation_id}` 🟢 Lab Technician, Admin
```json
{ "value": 8.2 }
```
Auto-computes flag against reference range:
- `value < ref_low × 0.5` or `value > ref_high × 1.5` → `CRITICAL`
- `value < ref_low` → `LOW` · `value > ref_high` → `HIGH` · otherwise → `NORMAL`

Returns `409` if a result already exists for this investigation.
```json
{ "investigation_id": "uuid", "test_id": "uuid", "value": 8.2, "flag": "HIGH", "ordered_at": "..." }
```

### `GET /lab/results/{appointment_id}` 🔓
All investigations + results for an appointment.

---

## Clinical Records (SOAP)

### `GET /records/{appointment_id}` 🔓
Returns the SOAP note for the appointment, or `null` if none exists.
```json
{ "record_id": "uuid", "appointment_id": "uuid", "subjective": "Patient reports headache", "objective": "BP 130/85", "assessment": "Tension headache", "plan": "Ibuprofen 400mg OD, review in 7 days", "version": 2, "updated_at": "..." }
```

### `POST /records` 🟢 Doctor, Admin
Create **or** update a SOAP note with **optimistic locking**. Send `version` you last read.
```json
{ "appointment_id": "uuid", "subjective": "...", "objective": "...", "assessment": "...", "plan": "...", "version": 2 }
```
Returns `409 Conflict` if `version` is stale — reload the note and retry.
Each successful save increments `version`.

---

## Analytics

All analytics endpoints are **role-scoped**: Doctor sees own data; Admin/Nurse/others see full hospital data.

### `GET /analytics/kpis` 🔓
```json
{ "total_patients": 23, "total_appointments": 87, "scheduled_appointments": 12, "active_prescriptions": 45 }
```

### `GET /analytics/appointments/stats` 🔓
6-status breakdown for appointments page stat cards.
```json
{ "total": 87, "scheduled": 12, "in_progress": 3, "completed": 61, "cancelled": 8, "no_show": 3 }
```

### `GET /analytics/appointments/weekly-trend` 🔓
Appointments per day for the last 7 days (fills gaps with 0).
```json
[{ "day": "Mon", "count": 5 }, { "day": "Tue", "count": 8 }, ...]
```

### `GET /analytics/appointments/status-breakdown` 🔓
```json
[{ "status": "SCHEDULED", "count": 12 }, { "status": "COMPLETED", "count": 61 }, ...]
```

### `GET /analytics/diagnoses/top` 🔓
Top 5 ICD-10 codes by frequency (doctor-scoped for doctors).
```json
[{ "icd10_code": "E11.9", "description": "Type 2 diabetes mellitus without complications", "count": 18 }]
```

---

## SQL Insights 🟢 Admin only

All insight endpoints require `ADMIN` role.

### `GET /insights/patient-ranking`
**WINDOW function** — patients ranked by visit count using `RANK() OVER (ORDER BY COUNT DESC)`.

### `GET /insights/appointment-volume`
**CTE** — daily appointment volume + completion rate using `FILTER`.

### `GET /insights/referral-chains`
**Recursive CTE** — doctor referral chains (anchor: root doctors never referred to; recursive: extend chain up to depth 8).

### `GET /insights/latest-lab-per-test`
**LATERAL join** — most recent lab result per test type.

### `GET /insights/performance`
**EXPLAIN (ANALYZE, BUFFERS)** on 3 representative queries. Returns execution time, index usage flag, and raw plan text.

---

## Audit

### `GET /audit` 🟢 Admin only
Trigger-populated change history. Most-recent-first.

| Query param | Description |
|---|---|
| `table` | Filter by table name |
| `limit` | Max 500, default 100 |

```json
[{ "audit_id": 142, "table_name": "prescription", "operation": "INSERT", "user_id": "uuid", "changed_at": "2026-09-25T09:15:00Z" }]
```

---

## Simulator

### `GET /simulator/status` 🔓
```json
{ "running": false, "interval": 3.0, "ticks": 0, "started_at": null, "counters": { "patients": 0, "appointments": 0, "diagnoses": 0, "prescriptions": 0, "labs": 0, "status_changes": 0, "restocks": 0, "records": 0, "referrals": 0 } }
```

### `GET /simulator/events?limit=20` 🔓
Recent activity feed (ring buffer, max 100).
```json
[{ "ts": "2026-09-25T09:10:00Z", "type": "patient", "message": "New patient registered: Kavita Rao (MRN4F2A1B3C)" }]
```

### `POST /simulator/start` 🟢 Admin
Optional body: `{ "interval": 1.2 }` (seconds per tick, min 0.2, max 60).

### `POST /simulator/stop` 🟢 Admin

### `POST /simulator/config` 🟢 Admin
`{ "interval": 0.5 }` — changes tick rate without restart.

---

## Health

### `GET /health`
```json
{ "status": "ok", "service": "MediTrack API" }
```
No auth required. Used by `start.sh` health check.
