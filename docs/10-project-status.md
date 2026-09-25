# 10 · Project Status

> Live checklist — what is built, what is Term 2.
> *Last updated: 25 September 2026 · v1.4.0*

---

## ✅ Term 1 — Complete

### Database (PostgreSQL 16)
- [x] 15 ORM tables — UUID PKs, TIMESTAMPTZ, ENUMs, CHECK constraints
- [x] Generalisation hierarchy: `person` → `patient` / `healthcare_professional`
- [x] Weak entity: `prescription_item` (composite PK)
- [x] CHECK constraints: DOB < today, end_time > start_time, value ≥ 0, stock ≥ 0, duration > 0
- [x] 6 ENUM types: gender, blood_group, professional_role, appointment_status, severity, lab_flag
- [x] `created_at` / `updated_at` on all mutable tables (trigger-managed)
- [x] Trigger `trg_set_updated_at` — BEFORE UPDATE on 7 tables
- [x] Trigger `trg_write_audit` — AFTER INSERT/UPDATE/DELETE on 7 tables → `audit_log` (JSONB old/new)
- [x] Trigger `trg_appointment_conflict` — BEFORE INSERT on `appointment`, raises EXCEPTION on overlap
- [x] Function `fn_calculate_age(dob DATE) RETURNS INT`
- [x] Function `fn_flag_abnormal_lab_result(test_id, value)` — CRITICAL/HIGH/LOW/NORMAL
- [x] View `vw_patient_summary` — demographics + visit/prescription counts
- [x] View `vw_doctor_schedule_today` — today's appointments per doctor
- [x] View `vw_pending_lab_results` — ordered tests with no result
- [x] View `vw_audit_recent` — last 100 audit entries
- [x] 15 indexes: FK B-trees, composite, partial (`WHERE status='SCHEDULED'`), GIN (JSONB)
- [x] PostgreSQL RBAC roles: `app_admin`, `app_doctor`, `app_nurse`, `app_lab_tech`, `app_receptionist`
- [x] 97 ICD-10 codes across 12 clinical categories (upsert on restart)
- [x] 36 lab tests with clinical reference ranges across 8 categories (upsert on restart)
- [x] 8 medicines in 5 categories with stock management

### Backend API (FastAPI + SQLAlchemy 2.0)
- [x] JWT auth: login (OAuth2 password flow), refresh, /me
- [x] `require_role()` dependency factory — 5 roles, 14 routers
- [x] `GET /patients` — scoped (Doctor sees own; `?all=true` for booking)
- [x] `POST /patients` — Admin/Receptionist only; MRN auto-generated
- [x] `GET /patients/{id}/detail` — 360° view, role-gated sections in backend
- [x] `GET /appointments` — Doctor-scoped, enriched with patient_name + doctor_name
- [x] `POST /appointments` — conflict detection (app FOR UPDATE + DB trigger)
- [x] `PUT /appointments/{id}/status` — state-machine transitions + role enforcement
- [x] `GET /icd10/search` — server search across 97 codes
- [x] `POST /diagnoses` — Doctor/Admin
- [x] `POST /prescriptions` — ACID: prescription + items + stock decrement in one commit
- [x] `GET /lab/tests` — all 36 tests
- [x] `GET /lab/medicines` — medicines with stock + category
- [x] `GET /lab/pending` — enriched pending queue (patient, test, doctor, timestamp)
- [x] `POST /lab/orders` — Doctor/Admin
- [x] `PUT /lab/results/{id}` — Lab Technician/Admin, auto-flag, duplicate-result guard
- [x] `POST /records` + `GET /records/{appointment_id}` — SOAP with optimistic locking
- [x] `/analytics/kpis`, `weekly-trend`, `status-breakdown`, `diagnoses/top`, `appointments/stats` — all role-scoped
- [x] `/insights/*` — Window, CTE, Recursive CTE, LATERAL, EXPLAIN ANALYZE (Admin only)
- [x] `GET /audit` — Admin only, trigger-populated
- [x] `/simulator/*` — start, stop, config, status, events

### Frontend (React 18 + TypeScript)
- [x] JWT auto-refresh interceptor (single retry with lock, logout on failure)
- [x] `ProtectedRoute` (auth) + `RoleRoute` (role) guards
- [x] Role-filtered sidebar nav (`navForRole`)
- [x] `LoginPage` — GSAP orbs, Framer Motion form, quick role picker
- [x] `DashboardPage` — role-specific KPIs, charts, widgets (Lab Queue for Lab Tech, Sim Panel for Admin)
- [x] `PatientListPage` — search, filters, stat cards, clickable rows (role-gated)
- [x] `PatientDetailPage` — 360° view, all action modals wired (Dx, Rx, Lab, Note, Enter Result, Book)
- [x] `AppointmentPage` — 6 stat cards, Patient+Doctor columns, inline status control, row→patient navigation
- [x] `LabQueuePage` — pending work queue, search, stats, Enter Result, 10s auto-refresh
- [x] `InsightsPage` — 4 SQL showcase cards + EXPLAIN ANALYZE panel (Admin only)
- [x] `AuditLogPage` — operation badges, change history (Admin only)
- [x] `AppointmentStatusControl` — portal-rendered dropdown, state-machine, role-restricted
- [x] `AddDiagnosisForm` — debounced ICD-10 server search, selected code card, severity grid
- [x] `AddPrescriptionForm` — per-item `MedicinePicker` with category groups + stock badges
- [x] `OrderLabForm` — search + browse-toggle, 8 test categories, reference range preview
- [x] `EnterLabResultForm` — numeric entry, live flag preview, `onSuccess` callback
- [x] `SoapEditor` — SOAP fields, version display, 409 conflict handled
- [x] `BookAppointmentForm` — doctor pre-filled, conflict 409 toast, `?all=true` patient list
- [x] `RegisterPatientForm` — full demographics, MRN in success toast
- [x] Toast notifications (success/error/info, 4s auto-dismiss)
- [x] Simulation engine — blank start (`SIMULATOR_AUTOSTART=false`), Admin controls start/stop/speed

### DevOps
- [x] Docker Compose: db, redis, backend, frontend
- [x] `start.sh` — one-command launch, live log streaming, clean Ctrl-C shutdown
- [x] `docker compose stop --timeout 5` — prevents redis/node stop errors
- [x] `seed.py` — drops views before `drop_all` (fixes `DependentObjectsStillExist`)
- [x] `SIMULATOR_AUTOSTART=false` — blank platform on restart
- [x] `docker compose down -v` procedure documented for full reset

---

## 🔲 Term 2 — Planned

### DICOM Viewer
- [ ] `medical_image` table (metadata: modality, body_part, file_path, resolution)
- [ ] `POST /images/upload` multipart endpoint
- [ ] Composite index on `(patient_id, modality, acquisition_date DESC)`
- [ ] Cornerstone.js in-browser DICOM viewer
- [ ] "Images" section on patient detail page

### AI Summaries
- [ ] `POST /ai/summarise-notes` — SOAP note → structured summary (GPT-4o / Ollama)
- [ ] AI summary panel on patient detail page
- [ ] Drug-interaction checker on prescription save (OpenFDA API)
- [ ] `DrugInteractionLog` table for audit
- [ ] `POST /ai/suggest-diagnosis` — symptom → ICD-10 suggestion (scikit-learn)
- [ ] Suggestion helper panel in diagnosis form

### Demand Forecasting
- [ ] `POST /forecasts/appointments` — 30-day demand by department (Prophet)
- [ ] Forecast chart on analytics dashboard
- [ ] `vital_reading` TimescaleDB hypertable (HR/BP/SpO2/Temp)
- [ ] `GET /vitals/{patient_id}` time-range query
- [ ] Vital sign trend charts on patient detail
- [ ] WebSocket push to doctor on CRITICAL lab result
- [ ] `GET /alerts/active` — unacknowledged critical results
- [ ] Alert banner on Doctor dashboard

### Other
- [ ] pgcrypto column encryption (insurance_number)
- [ ] Alembic migrations (replacing `create_all`)
- [ ] Full-text search on SOAP notes (tsvector + GIN)
- [ ] ≥ 80% backend test coverage (integration + trigger tests)
- [ ] PostGIS hospital proximity search
- [ ] Lab report PDF upload + OCR
