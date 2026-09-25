# 04 · Roles & Access Control

MediTrack uses **Role-Based Access Control (RBAC)** enforced at three layers:
1. **PostgreSQL** — DB roles with `GRANT`/`REVOKE` (defence in depth)
2. **FastAPI backend** — `require_role()` dependency on every write endpoint
3. **React frontend** — `RoleRoute` guards + role-filtered nav + per-section UI gating

Every staff member has exactly one role baked into their JWT token at login.

---

## The 5 Roles

| Role | Indian demo account | Primary responsibility |
|---|---|---|
| `ADMIN` | System Admin · `admin@meditrack.dev` | Full system oversight, SQL Insights, Audit Log, Simulation Engine |
| `DOCTOR` | Arjun Sharma · `doctor@meditrack.dev` | Diagnose, prescribe, order lab tests, write SOAP notes (own patients only) |
| `NURSE` | Priya Nair · `nurse@meditrack.dev` | View patient clinical data, update appointment status |
| `LAB_TECHNICIAN` | Rohan Desai · `lab@meditrack.dev` | Enter lab test results, work queue dashboard |
| `RECEPTIONIST` | Kavya Reddy · `reception@meditrack.dev` | Register patients, book appointments |

Passwords: Admin@123 (admin), Doctor@123 (doctor), Staff@123 (all others).

---

## Full Permission Matrix

| Action | Admin | Doctor | Nurse | Lab Tech | Receptionist |
|---|:---:|:---:|:---:|:---:|:---:|
| **Log in** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Register patient** | ✅ | ❌ | ❌ | ❌ | ✅ |
| **View patient list** | ✅ All | ✅ Own only | ✅ All | ✅ All | ✅ List only* |
| **View patient detail** | ✅ | ✅ Own only | ✅ | ✅ Labs only | ❌ |
| **View diagnoses / prescriptions** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **View lab results** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Book appointment** | ✅ | ✅ | ❌ | ❌ | ✅ |
| **View appointments** | ✅ All | ✅ Own only | ✅ All | ❌ | ✅ All |
| **Change appt status → IN_PROGRESS** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Change appt status → COMPLETED** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Change appt status → CANCELLED** | ✅ | ✅ | ❌ | ❌ | ✅** |
| **Change appt status → NO_SHOW** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Add diagnosis** (ICD-10) | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Issue prescription** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Order lab test** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Enter lab result** | ✅ | ❌ | ❌ | ✅ | ❌ |
| **Write SOAP note** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **View SQL Insights** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **View Audit Log** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **View Lab Queue page** | ✅ | ❌ | ❌ | ✅ | ❌ |
| **Control Simulation Engine** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **View simulation events feed** | ✅ | ❌ | ❌ | ❌ | ❌ |

\* Receptionist sees patient list (name, MRN, phone) but **cannot** click into patient detail.
\** Receptionist can only cancel a `SCHEDULED` appointment (not other transitions).

---

## Data Scoping (Doctor)

Doctors are scoped to **their own patients and appointments** at the backend level:

- `GET /patients` — returns only patients who have at least one appointment with this doctor
- `GET /patients?all=true` — returns all patients (used by booking form to create new associations)
- `GET /appointments` — returns only this doctor's appointments
- `GET /patients/{id}/detail` — returns 403 if the patient has no appointment with this doctor
- All KPIs (`/analytics/kpis`, weekly trend, status breakdown) — scoped to this doctor's data

---

## Appointment Status State Machine (by role)

```
            SCHEDULED
           /    |    \
Doctor ✅  /  Nurse✅  \ Receptionist✅
          ▼     |     ▼
    IN_PROGRESS  |  CANCELLED
        |        |
 Doctor ✅        |
 Nurse  ✅        | NO_SHOW
        ▼        | (Doctor/Nurse/Admin only)
    COMPLETED ◀──┘
```

Terminal states — **COMPLETED, CANCELLED, NO_SHOW** — cannot be changed further by anyone.

---

## How Enforcement Works

### Layer 1 — PostgreSQL roles (`04_roles.sql`)
```sql
CREATE ROLE app_doctor;
GRANT SELECT ON patient, appointment, diagnosis, prescription, lab_result TO app_doctor;
GRANT INSERT ON diagnosis, prescription, lab_investigation, clinical_record TO app_doctor;
-- No GRANT on audit_log (read), insights views (admin only), etc.
```

### Layer 2 — FastAPI `require_role()` (`core/deps.py`)
```python
def require_role(*roles: str):
    def _guard(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in roles:
            raise HTTPException(403, "Insufficient privileges")
        return user
    return _guard

# Usage on endpoints:
@router.post("/diagnoses")
def create_diagnosis(..., _=Depends(require_role("DOCTOR", "ADMIN"))):
    ...
```

### Layer 3 — React frontend (`App.tsx` + `PatientDetailPage.tsx`)
```tsx
// Route guard — redirects to "/" if wrong role
<RoleRoute roles={["ADMIN"]}>
  <AuditLogPage />
</RoleRoute>

// Page section gate
{canSeeClinical && (
  <Section title="Diagnoses" icon={Stethoscope}>...</Section>
)}
{canEnterResult && (
  <button onClick={() => setLabResult(l)}>Enter Result</button>
)}
```

Frontend role checks are **UX only** — they never replace backend enforcement.
A missing frontend guard is a display bug; a missing backend guard is a security bug.

---

## Role-specific Dashboard Experience

| Role | Dashboard shows |
|---|---|
| **Admin** | All-hospital KPIs, charts, simulation engine panel with start/stop/speed controls |
| **Doctor** | Own patient KPIs ("My Patients", "My Appointments"), own top diagnoses, quick actions to own patients/appointments |
| **Nurse** | All-hospital KPIs, appointments quick access |
| **Lab Technician** | Pending test queue widget with notification cards (patient name, test, ordering doctor), badge with count |
| **Receptionist** | All-hospital KPIs, quick actions: Register Patient, Book Appointment |
