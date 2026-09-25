-- =====================================================================
-- MediTrack — Database-level RBAC (defence in depth)
-- Creates PostgreSQL roles mirroring the application roles and grants
-- least-privilege access. These are NOT login roles (the app connects as
-- its own user); they document and can enforce privilege boundaries, and
-- demonstrate GRANT / REVOKE for the DBSA rubric.
-- Wrapped in DO blocks so re-running is safe.
-- =====================================================================

DO $$
BEGIN
    -- Create group roles if they don't exist
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_admin')        THEN CREATE ROLE app_admin        NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_doctor')       THEN CREATE ROLE app_doctor       NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_nurse')        THEN CREATE ROLE app_nurse        NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_lab_tech')     THEN CREATE ROLE app_lab_tech     NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_receptionist') THEN CREATE ROLE app_receptionist NOLOGIN; END IF;
END $$;

-- Least-privilege grants (illustrative; app connects as owner) ------------

-- Admin: full access to everything
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_admin;

-- Receptionist: manage patients & appointments; read-only clinical data
GRANT SELECT, INSERT, UPDATE ON patient, person, appointment TO app_receptionist;
GRANT SELECT ON diagnosis, prescription, lab_result TO app_receptionist;

-- Doctor: read patients; write diagnoses, prescriptions, lab orders, records
GRANT SELECT ON patient, person, appointment TO app_doctor;
GRANT SELECT, INSERT, UPDATE ON diagnosis, prescription, prescription_item,
      lab_investigation, clinical_record TO app_doctor;
GRANT SELECT ON diagnosis_code, medicine, lab_test TO app_doctor;

-- Nurse: read-only clinical view
GRANT SELECT ON patient, person, appointment, diagnosis, prescription,
      lab_result, clinical_record TO app_nurse;

-- Lab technician: read investigations, write results
GRANT SELECT ON lab_investigation, lab_test, appointment, patient TO app_lab_tech;
GRANT SELECT, INSERT, UPDATE ON lab_result TO app_lab_tech;

-- Everyone can read reference/lookup data
GRANT SELECT ON diagnosis_code, medicine, medicine_category, lab_test, department
    TO app_doctor, app_nurse, app_lab_tech, app_receptionist;
