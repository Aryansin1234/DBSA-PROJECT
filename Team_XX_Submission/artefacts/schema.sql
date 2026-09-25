-- =====================================================================
-- MediTrack — Core Database Schema (Term 1)
-- SESAP ZC337 Database Systems and Applications — Team_XX
-- PostgreSQL 16
-- Status as on 26-Sep-2026: Core DDL complete (Phase 2, ~80%)
-- =====================================================================

-- ---------- Extensions ----------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";      -- gen_random_uuid()

-- ---------- ENUM Types ----------
CREATE TYPE gender_enum            AS ENUM ('MALE', 'FEMALE', 'OTHER');
CREATE TYPE blood_group_enum       AS ENUM ('A+','A-','B+','B-','AB+','AB-','O+','O-');
CREATE TYPE appointment_status     AS ENUM ('SCHEDULED','IN_PROGRESS','COMPLETED','CANCELLED','NO_SHOW');
CREATE TYPE severity_enum          AS ENUM ('MILD','MODERATE','SEVERE','CRITICAL');
CREATE TYPE professional_role      AS ENUM ('DOCTOR','NURSE','LAB_TECHNICIAN','RECEPTIONIST','ADMIN');
CREATE TYPE lab_flag_enum          AS ENUM ('NORMAL','LOW','HIGH','CRITICAL');

-- =====================================================================
-- PEOPLE (Generalisation: Person -> Patient / HealthcareProfessional)
-- =====================================================================
CREATE TABLE person (
    person_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name    VARCHAR(80)  NOT NULL,
    last_name     VARCHAR(80)  NOT NULL,
    date_of_birth DATE         NOT NULL,
    gender        gender_enum  NOT NULL,
    phone         VARCHAR(20),
    email         VARCHAR(120) UNIQUE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_dob CHECK (date_of_birth < CURRENT_DATE)
);

CREATE TABLE patient (
    patient_id        UUID PRIMARY KEY REFERENCES person(person_id) ON DELETE CASCADE,
    mrn               VARCHAR(20) UNIQUE NOT NULL,     -- medical record number
    blood_group       blood_group_enum,
    emergency_contact VARCHAR(20),
    insurance_number  VARCHAR(60),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE department (
    department_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE healthcare_professional (
    professional_id UUID PRIMARY KEY REFERENCES person(person_id) ON DELETE CASCADE,
    role            professional_role NOT NULL,
    department_id   UUID REFERENCES department(department_id) ON DELETE SET NULL,
    license_number  VARCHAR(60) UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,             -- bcrypt
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- APPOINTMENTS
-- =====================================================================
CREATE TABLE appointment (
    appointment_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      UUID NOT NULL REFERENCES patient(patient_id) ON DELETE CASCADE,
    doctor_id       UUID NOT NULL REFERENCES healthcare_professional(professional_id) ON DELETE RESTRICT,
    start_time      TIMESTAMPTZ NOT NULL,
    end_time        TIMESTAMPTZ NOT NULL,
    status          appointment_status NOT NULL DEFAULT 'SCHEDULED',
    reason          VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_time CHECK (end_time > start_time)
);

-- =====================================================================
-- DIAGNOSIS  (ICD-10 lookup + per-appointment diagnosis)
-- =====================================================================
CREATE TABLE diagnosis_code (
    icd10_code   VARCHAR(10) PRIMARY KEY,
    description  VARCHAR(255) NOT NULL,
    search_vec   tsvector
);

CREATE TABLE diagnosis (
    diagnosis_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES appointment(appointment_id) ON DELETE CASCADE,
    icd10_code     VARCHAR(10) NOT NULL REFERENCES diagnosis_code(icd10_code) ON DELETE RESTRICT,
    severity       severity_enum NOT NULL DEFAULT 'MILD',
    notes          TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- MEDICINES & PRESCRIPTIONS
-- =====================================================================
CREATE TABLE medicine_category (
    category_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE medicine (
    medicine_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         VARCHAR(150) NOT NULL,
    category_id  UUID REFERENCES medicine_category(category_id) ON DELETE SET NULL,
    stock_count  INT NOT NULL DEFAULT 0,
    CONSTRAINT chk_stock CHECK (stock_count >= 0)
);

CREATE TABLE prescription (
    prescription_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id  UUID NOT NULL REFERENCES appointment(appointment_id) ON DELETE CASCADE,
    issued_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Weak entity: depends on prescription
CREATE TABLE prescription_item (
    prescription_id UUID NOT NULL REFERENCES prescription(prescription_id) ON DELETE CASCADE,
    medicine_id     UUID NOT NULL REFERENCES medicine(medicine_id) ON DELETE RESTRICT,
    dosage          VARCHAR(60)  NOT NULL,
    frequency       VARCHAR(60)  NOT NULL,
    duration_days   INT NOT NULL,
    PRIMARY KEY (prescription_id, medicine_id),
    CONSTRAINT chk_duration CHECK (duration_days > 0)
);

-- =====================================================================
-- LAB INVESTIGATIONS
-- =====================================================================
CREATE TABLE lab_test (
    test_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(120) NOT NULL,
    unit          VARCHAR(20),
    ref_low       NUMERIC(10,2),
    ref_high      NUMERIC(10,2)
);

CREATE TABLE lab_investigation (
    investigation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id   UUID NOT NULL REFERENCES appointment(appointment_id) ON DELETE CASCADE,
    test_id          UUID NOT NULL REFERENCES lab_test(test_id) ON DELETE RESTRICT,
    ordered_by       UUID NOT NULL REFERENCES healthcare_professional(professional_id),
    ordered_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE lab_result (
    result_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investigation_id UUID NOT NULL REFERENCES lab_investigation(investigation_id) ON DELETE CASCADE,
    value            NUMERIC(10,2) NOT NULL,
    flag             lab_flag_enum NOT NULL DEFAULT 'NORMAL',
    recorded_by      UUID REFERENCES healthcare_professional(professional_id),
    recorded_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_value CHECK (value >= 0)
);

-- =====================================================================
-- CLINICAL RECORD (SOAP encounter summary)
-- =====================================================================
CREATE TABLE clinical_record (
    record_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appointment_id UUID NOT NULL REFERENCES appointment(appointment_id) ON DELETE CASCADE,
    subjective     TEXT,
    objective      TEXT,
    assessment     TEXT,
    plan           TEXT,
    soap_search    tsvector,
    version        INT NOT NULL DEFAULT 1,             -- optimistic locking
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- AUDIT LOG (standout feature)
-- =====================================================================
CREATE TABLE audit_log (
    audit_id    BIGSERIAL PRIMARY KEY,
    table_name  VARCHAR(80) NOT NULL,
    operation   VARCHAR(10) NOT NULL,
    user_id     UUID,
    old_data    JSONB,
    new_data    JSONB,
    changed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- TRIGGER: auto-update updated_at
-- =====================================================================
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_appointment
    BEFORE UPDATE ON appointment
    FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
-- (applied similarly to all mutable tables)

-- =====================================================================
-- TRIGGER: appointment conflict prevention
-- =====================================================================
CREATE OR REPLACE FUNCTION trg_appointment_conflict()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM appointment a
        WHERE a.doctor_id = NEW.doctor_id
          AND a.status = 'SCHEDULED'
          AND tstzrange(a.start_time, a.end_time) && tstzrange(NEW.start_time, NEW.end_time)
    ) THEN
        RAISE EXCEPTION 'Appointment conflict: doctor % already booked in this window', NEW.doctor_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_appointment_conflict
    BEFORE INSERT ON appointment
    FOR EACH ROW EXECUTE FUNCTION trg_appointment_conflict();

-- =====================================================================
-- FUNCTION: calculate age
-- =====================================================================
CREATE OR REPLACE FUNCTION fn_calculate_age(dob DATE)
RETURNS INT AS $$
    SELECT EXTRACT(YEAR FROM AGE(CURRENT_DATE, dob))::INT;
$$ LANGUAGE sql IMMUTABLE;

-- =====================================================================
-- FUNCTION: flag abnormal lab result
-- =====================================================================
CREATE OR REPLACE FUNCTION fn_flag_abnormal_lab_result(p_test_id UUID, p_value NUMERIC)
RETURNS lab_flag_enum AS $$
DECLARE lo NUMERIC; hi NUMERIC;
BEGIN
    SELECT ref_low, ref_high INTO lo, hi FROM lab_test WHERE test_id = p_test_id;
    IF lo IS NULL OR hi IS NULL THEN RETURN 'NORMAL'; END IF;
    IF p_value < lo * 0.5 OR p_value > hi * 1.5 THEN RETURN 'CRITICAL';
    ELSIF p_value < lo THEN RETURN 'LOW';
    ELSIF p_value > hi THEN RETURN 'HIGH';
    ELSE RETURN 'NORMAL';
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================================
-- VIEW: patient summary
-- =====================================================================
CREATE OR REPLACE VIEW vw_patient_summary AS
SELECT p.patient_id,
       pr.first_name || ' ' || pr.last_name AS full_name,
       fn_calculate_age(pr.date_of_birth)   AS age,
       p.blood_group,
       MAX(a.start_time)                    AS last_visit
FROM patient p
JOIN person pr ON pr.person_id = p.patient_id
LEFT JOIN appointment a ON a.patient_id = p.patient_id
GROUP BY p.patient_id, pr.first_name, pr.last_name, pr.date_of_birth, p.blood_group;
