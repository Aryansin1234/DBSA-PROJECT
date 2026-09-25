# 11 · Database Layer

MediTrack applies a full **PostgreSQL database layer** on top of the ORM tables
at every startup. This is where the DBSA rubric lives: triggers, functions, views,
indexes, DB roles, and advanced SQL.

Applied idempotently by `backend/app/db/bootstrap.py` from SQL files in
`backend/app/db/sql/`.

---

## Startup Sequence

```python
# main.py lifespan
Base.metadata.create_all(bind=engine)    # 1. ORM creates tables
apply_database_layer()                    # 2. SQL layer (below)
simulator.ensure_baseline()              # 3. Reference data upsert
simulator.start()                        # 4. Engine (if AUTOSTART=true)
```

`apply_database_layer()` executes in order:
1. `01_functions_triggers.sql` — creates/replaces SQL functions
2. `_attach_triggers()` — attaches triggers to ORM-created tables
3. `02_views.sql` — creates/replaces 4 views
4. `03_indexes.sql` — creates 15 indexes (IF NOT EXISTS)
5. `04_roles.sql` — best-effort DB roles (skips on privilege error)

---

## 1. SQL Functions (`01_functions_triggers.sql`)

### `fn_calculate_age(dob DATE) RETURNS INT`
```sql
SELECT EXTRACT(YEAR FROM AGE(CURRENT_DATE, dob))::INT;
```
`IMMUTABLE` — safe to index on.

### `fn_flag_abnormal_lab_result(p_test_id UUID, p_value NUMERIC) RETURNS lab_flag_enum`
```sql
-- Looks up ref_low, ref_high from lab_test
-- Returns CRITICAL if value < ref_low*0.5 OR value > ref_high*1.5
-- Returns LOW     if value < ref_low
-- Returns HIGH    if value > ref_high
-- Returns NORMAL  otherwise
-- Returns NORMAL  if ref ranges are NULL (e.g. Urine Routine)
```
`STABLE` — same inputs → same output within a transaction.
Called by both the backend (`services/domain.py`) and available for direct SQL use.

### Trigger functions
| Function | Fires on | Purpose |
|---|---|---|
| `trg_set_updated_at()` | BEFORE UPDATE | Sets `NEW.updated_at = NOW()` |
| `trg_write_audit()` | AFTER INSERT/UPDATE/DELETE | Writes to `audit_log` with `to_jsonb(OLD)` and `to_jsonb(NEW)` |
| `trg_appointment_conflict()` | BEFORE INSERT on `appointment` | Queries for overlapping SCHEDULED appointments for the same doctor; raises `APPOINTMENT_CONFLICT` exception if found |

---

## 2. Attached Triggers (`bootstrap.py`)

Using PG16 `CREATE OR REPLACE TRIGGER` — idempotent on every restart.

### `updated_at` triggers (7 tables)
```
set_updated_at_person
set_updated_at_patient
set_updated_at_healthcare_professional
set_updated_at_appointment
set_updated_at_diagnosis
set_updated_at_prescription
set_updated_at_clinical_record
```
BEFORE UPDATE → `trg_set_updated_at()`

### Audit triggers (7 tables)
```
audit_patient
audit_appointment
audit_diagnosis
audit_prescription
audit_prescription_item
audit_lab_result
audit_clinical_record
```
AFTER INSERT/UPDATE/DELETE → `trg_write_audit()`

Every write by the app **or** the simulation engine is captured, including:
- `old_data`: `to_jsonb(OLD)` — null on INSERT
- `new_data`: `to_jsonb(NEW)` — null on DELETE
- `user_id`: extracted from `current_setting('meditrack.user_id', true)` when set

This is why the Audit Log page fills up automatically as the simulation engine runs.

### Conflict trigger (1 table)
```
check_appointment_conflict
```
BEFORE INSERT on `appointment` → `trg_appointment_conflict()`

Works alongside the application-level `SELECT ... FOR UPDATE` check:
- **App layer** prevents race conditions (row lock acquired before check)
- **DB trigger** is a second, database-enforced safety net

---

## 3. Views (`02_views.sql`)

### `vw_patient_summary`
```sql
SELECT p.patient_id, pr.first_name || ' ' || pr.last_name AS full_name,
       p.mrn, fn_calculate_age(pr.date_of_birth) AS age, p.blood_group,
       COUNT(DISTINCT a.appointment_id) AS total_appointments,
       COUNT(DISTINCT rx.prescription_id) AS total_prescriptions,
       MAX(a.start_time) AS last_visit
FROM patient p
JOIN person pr ON pr.person_id = p.patient_id
LEFT JOIN appointment a ON a.patient_id = p.patient_id
LEFT JOIN prescription rx ON rx.appointment_id = a.appointment_id
GROUP BY p.patient_id, pr.first_name, pr.last_name, p.mrn, pr.date_of_birth, p.blood_group;
```

### `vw_doctor_schedule_today`
All appointments for today joined with doctor and patient names.
Ordered by `doctor_id, start_time`.

### `vw_pending_lab_results`
Lab investigations LEFT JOINed to `lab_result` where `result_id IS NULL`.
Shows `investigation_id`, `appointment_id`, `test_name`, `ordered_at`.

### `vw_audit_recent`
```sql
SELECT audit_id, table_name, operation, user_id, changed_at
FROM audit_log ORDER BY changed_at DESC LIMIT 100;
```

---

## 4. Indexes (`03_indexes.sql`)

PostgreSQL does **not** auto-index foreign keys. All 15 indexes are created
with `CREATE INDEX IF NOT EXISTS`.

| Index name | Table | Columns | Type | Purpose |
|---|---|---|---|---|
| `idx_patient_person` | patient | patient_id | B-tree | FK join |
| `idx_prof_person` | healthcare_professional | professional_id | B-tree | FK join |
| `idx_prof_role` | healthcare_professional | role | B-tree | role filter |
| `idx_appointment_patient` | appointment | patient_id | B-tree | patient history |
| `idx_appointment_doctor` | appointment | doctor_id | B-tree | doctor schedule |
| `idx_appointment_doctor_time` | appointment | (doctor_id, start_time) | Composite | schedule range query |
| `idx_appointment_patient_status` | appointment | (patient_id, status) | Composite | patient active visits |
| `idx_appointment_scheduled` | appointment | (doctor_id, start_time) WHERE status='SCHEDULED' | **Partial** | active schedule fast path |
| `idx_diagnosis_appointment` | diagnosis | appointment_id | B-tree | FK join |
| `idx_presc_appointment` | prescription | appointment_id | B-tree | FK join |
| `idx_presc_item_presc` | prescription_item | prescription_id | B-tree | FK join |
| `idx_lab_inv_appointment` | lab_investigation | appointment_id | B-tree | FK join |
| `idx_lab_inv_test` | lab_investigation | test_id | B-tree | FK join |
| `idx_lab_result_inv` | lab_result | investigation_id | B-tree | FK join |
| `idx_audit_table_time` | audit_log | (table_name, changed_at DESC) | Composite | filtered audit queries |
| `idx_audit_new_data` | audit_log | new_data | **GIN** | JSONB content search |

---

## 5. Database Roles (`04_roles.sql`)

Group roles mirror the application roles — a second security layer beyond
`require_role()`. Wrapped in `DO $$ ... $$` blocks so re-running is safe.

| DB role | Privileges |
|---|---|
| `app_admin` | All tables — SELECT, INSERT, UPDATE, DELETE |
| `app_doctor` | SELECT all clinical tables; INSERT diagnosis, prescription, lab_investigation, clinical_record |
| `app_nurse` | SELECT patient, appointment, diagnosis, prescription, lab_result |
| `app_lab_tech` | SELECT lab_investigation, lab_test; INSERT lab_result |
| `app_receptionist` | SELECT patient, appointment; INSERT patient, appointment |

Applied best-effort — skipped if the database user lacks `CREATEROLE` privileges
(e.g. cloud-managed PostgreSQL).

---

## 6. Advanced SQL — `/api/insights` (Admin only)

All in `backend/app/routers/insights.py` using SQLAlchemy `text()`.

### Window Function — `GET /insights/patient-ranking`
```sql
SELECT pr.first_name || ' ' || pr.last_name AS patient_name, p.mrn,
       COUNT(a.appointment_id) AS visits,
       RANK() OVER (ORDER BY COUNT(a.appointment_id) DESC) AS visit_rank
FROM patient p
JOIN person pr ON pr.person_id = p.patient_id
LEFT JOIN appointment a ON a.patient_id = p.patient_id
GROUP BY p.patient_id, pr.first_name, pr.last_name, p.mrn
ORDER BY visits DESC LIMIT 10;
```

### CTE — `GET /insights/appointment-volume`
```sql
WITH daily AS (
    SELECT date_trunc('day', start_time) AS day,
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE status = 'COMPLETED') AS completed
    FROM appointment GROUP BY 1
)
SELECT to_char(day, 'Mon DD') AS day, total, completed,
       ROUND(100.0 * completed / NULLIF(total, 0), 1) AS completion_rate
FROM daily ORDER BY day DESC LIMIT 14;
```

### Recursive CTE — `GET /insights/referral-chains`
```sql
WITH RECURSIVE chain AS (
    -- anchor: doctors who refer but were never referred to (roots)
    SELECT r.referral_id, r.from_doctor_id, r.to_doctor_id, 1 AS depth,
           (fp.first_name || ' → ' || tp.first_name) AS path
    FROM referral r
    JOIN person fp ON fp.person_id = r.from_doctor_id
    JOIN person tp ON tp.person_id = r.to_doctor_id
    WHERE r.from_doctor_id NOT IN (SELECT to_doctor_id FROM referral)
    UNION ALL
    -- recursive: extend the chain up to depth 8
    SELECT r.referral_id, r.from_doctor_id, r.to_doctor_id, c.depth + 1,
           (c.path || ' → ' || tp.first_name)
    FROM referral r
    JOIN chain c ON r.from_doctor_id = c.to_doctor_id
    JOIN person tp ON tp.person_id = r.to_doctor_id
    WHERE c.depth < 8
)
SELECT DISTINCT ON (path) path, depth FROM chain ORDER BY path, depth DESC LIMIT 10;
```

### LATERAL Join — `GET /insights/latest-lab-per-test`
```sql
SELECT t.name AS test_name, t.unit, latest.value, latest.flag, latest.recorded_at
FROM lab_test t
LEFT JOIN LATERAL (
    SELECT r.value, r.flag, r.recorded_at
    FROM lab_investigation i
    JOIN lab_result r ON r.investigation_id = i.investigation_id
    WHERE i.test_id = t.test_id
    ORDER BY r.recorded_at DESC LIMIT 1
) latest ON true
ORDER BY t.name;
```

### EXPLAIN ANALYZE — `GET /insights/performance`
Runs `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)` on three representative queries:
1. **`doctor_schedule`** — doctor's appointments in last 30 days (uses `idx_appointment_doctor_time`)
2. **`scheduled_partial_index`** — count of SCHEDULED appointments (uses partial index)
3. **`patient_history`** — all appointments for a specific patient (uses `idx_appointment_patient`)

Returns execution time, index usage flag, and the full plan text for display
in the collapsible EXPLAIN ANALYZE panel on the SQL Insights page.

---

## 7. Optimistic Locking — SOAP Notes

`clinical_record.version` is an integer (default 1) incremented on every save.

```
Client reads record:   { ..., version: 3 }
Client sends update:   { appointment_id, ..., version: 3 }
Server checks:         body.version == rec.version → OK → save, version = 4
                       body.version != rec.version → 409 "Record modified by someone else (v3 vs v4)"
```

This prevents two doctors from silently overwriting each other's SOAP note edits.

---

## 8. ACID Transaction — Prescription Creation

```python
# routers/prescriptions.py
rx = Prescription(appointment_id=body.appointment_id)
db.add(rx)
db.flush()                          # get prescription_id

for item in body.items:
    medicine = db.get(Medicine, item.medicine_id, with_for_update=True)
    if medicine.stock_count <= 0:
        db.rollback()
        raise HTTPException(409, f"{medicine.name} out of stock")
    medicine.stock_count -= 1
    db.add(PrescriptionItem(...))

db.commit()                         # ALL or NOTHING
```

- **Atomicity** — prescription + all items + all stock decrements commit together
- **Consistency** — `CHECK (stock_count >= 0)` enforced at DB level
- **Isolation** — `SELECT ... FOR UPDATE` prevents concurrent overselling
- **Durability** — PostgreSQL WAL ensures commit survives crashes
