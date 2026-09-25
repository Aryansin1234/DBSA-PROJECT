-- =====================================================================
-- MediTrack — Functions & Triggers (applied at startup, idempotent)
-- =====================================================================

-- ---------------------------------------------------------------------
-- FUNCTION: fn_calculate_age(dob) -> INT
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_calculate_age(dob DATE)
RETURNS INT AS $$
    SELECT EXTRACT(YEAR FROM AGE(CURRENT_DATE, dob))::INT;
$$ LANGUAGE sql IMMUTABLE;

-- ---------------------------------------------------------------------
-- FUNCTION: fn_flag_abnormal_lab_result(test_id, value) -> lab_flag_enum
-- Mirrors the Python domain helper so flagging can also be done in-DB.
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- TRIGGER FN: set updated_at = now() on every UPDATE
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- TRIGGER FN: audit_log writer (INSERT / UPDATE / DELETE)
-- Captures old/new row as JSONB. The application may set the current
-- user via  SET LOCAL meditrack.user_id = '<uuid>';  otherwise NULL.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_write_audit()
RETURNS TRIGGER AS $$
DECLARE
    v_user UUID;
    v_old  JSONB;
    v_new  JSONB;
BEGIN
    BEGIN
        v_user := NULLIF(current_setting('meditrack.user_id', true), '')::UUID;
    EXCEPTION WHEN OTHERS THEN
        v_user := NULL;
    END;

    IF (TG_OP = 'DELETE') THEN
        v_old := to_jsonb(OLD); v_new := NULL;
    ELSIF (TG_OP = 'UPDATE') THEN
        v_old := to_jsonb(OLD); v_new := to_jsonb(NEW);
    ELSE  -- INSERT
        v_old := NULL; v_new := to_jsonb(NEW);
    END IF;

    INSERT INTO audit_log(table_name, operation, user_id, old_data, new_data)
    VALUES (TG_TABLE_NAME, TG_OP, v_user, v_old, v_new);

    IF (TG_OP = 'DELETE') THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- TRIGGER FN: appointment conflict prevention (DB-level guard)
-- Uses tstzrange overlap for a robust interval check.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_appointment_conflict()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'SCHEDULED' AND EXISTS (
        SELECT 1 FROM appointment a
        WHERE a.doctor_id = NEW.doctor_id
          AND a.appointment_id <> NEW.appointment_id
          AND a.status = 'SCHEDULED'
          AND tstzrange(a.start_time, a.end_time) && tstzrange(NEW.start_time, NEW.end_time)
    ) THEN
        RAISE EXCEPTION 'APPOINTMENT_CONFLICT: doctor % already booked in this window', NEW.doctor_id
            USING ERRCODE = 'exclusion_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- TRIGGER FN: decrement medicine stock when a prescription item is added
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_decrement_stock()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE medicine
       SET stock_count = stock_count - 1
     WHERE medicine_id = NEW.medicine_id
       AND stock_count > 0;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'OUT_OF_STOCK: medicine % has no stock', NEW.medicine_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: the application already decrements stock inside its transaction, so
-- this trigger is intentionally NOT attached by default (would double-count).
-- It is provided to demonstrate the pattern and can be enabled if the app
-- stops doing it. See bootstrap.py.
