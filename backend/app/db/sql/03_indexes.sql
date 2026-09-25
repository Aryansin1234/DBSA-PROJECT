-- =====================================================================
-- MediTrack — Indexes (query optimisation)
-- PostgreSQL does NOT auto-create indexes on foreign keys, so we add them
-- explicitly, plus composite / partial / GIN indexes for hot paths.
-- All are IF NOT EXISTS so this file is safe to run repeatedly.
-- =====================================================================

-- --- Foreign-key B-tree indexes ---
CREATE INDEX IF NOT EXISTS idx_appointment_patient        ON appointment(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointment_doctor         ON appointment(doctor_id);
CREATE INDEX IF NOT EXISTS idx_diagnosis_appointment      ON diagnosis(appointment_id);
CREATE INDEX IF NOT EXISTS idx_diagnosis_code             ON diagnosis(icd10_code);
CREATE INDEX IF NOT EXISTS idx_prescription_appointment   ON prescription(appointment_id);
CREATE INDEX IF NOT EXISTS idx_presc_item_medicine        ON prescription_item(medicine_id);
CREATE INDEX IF NOT EXISTS idx_lab_inv_appointment        ON lab_investigation(appointment_id);
CREATE INDEX IF NOT EXISTS idx_lab_inv_test               ON lab_investigation(test_id);
CREATE INDEX IF NOT EXISTS idx_lab_result_investigation   ON lab_result(investigation_id);

-- --- Composite indexes for common query patterns ---
-- Doctor's schedule for a day / range
CREATE INDEX IF NOT EXISTS idx_appointment_doctor_time    ON appointment(doctor_id, start_time);
-- Patient history by status
CREATE INDEX IF NOT EXISTS idx_appointment_patient_status ON appointment(patient_id, status);

-- --- Partial index: only currently scheduled appointments (hot path) ---
CREATE INDEX IF NOT EXISTS idx_appointment_scheduled
    ON appointment(doctor_id, start_time)
    WHERE status = 'SCHEDULED';

-- --- GIN indexes for JSONB audit search ---
CREATE INDEX IF NOT EXISTS idx_audit_new_data_gin  ON audit_log USING GIN (new_data);
CREATE INDEX IF NOT EXISTS idx_audit_table_time    ON audit_log(table_name, changed_at DESC);

-- --- Patient MRN lookup (unique already, but explicit for search) ---
CREATE INDEX IF NOT EXISTS idx_person_name ON person(last_name, first_name);
