-- =====================================================================
-- MediTrack — Views (analytical + operational)
-- =====================================================================

-- Patient summary: demographics + last visit + active prescription count
CREATE OR REPLACE VIEW vw_patient_summary AS
SELECT p.patient_id,
       pr.first_name || ' ' || pr.last_name       AS full_name,
       p.mrn,
       fn_calculate_age(pr.date_of_birth)          AS age,
       p.blood_group,
       COUNT(DISTINCT a.appointment_id)            AS total_appointments,
       COUNT(DISTINCT rx.prescription_id)          AS total_prescriptions,
       MAX(a.start_time)                           AS last_visit
FROM patient p
JOIN person pr ON pr.person_id = p.patient_id
LEFT JOIN appointment a ON a.patient_id = p.patient_id
LEFT JOIN prescription rx ON rx.appointment_id = a.appointment_id
GROUP BY p.patient_id, pr.first_name, pr.last_name, p.mrn, pr.date_of_birth, p.blood_group;

-- Today's doctor schedule
CREATE OR REPLACE VIEW vw_doctor_schedule_today AS
SELECT a.appointment_id,
       a.doctor_id,
       dpr.first_name || ' ' || dpr.last_name AS doctor_name,
       a.patient_id,
       ppr.first_name || ' ' || ppr.last_name AS patient_name,
       a.start_time, a.end_time, a.status, a.reason
FROM appointment a
JOIN person dpr ON dpr.person_id = a.doctor_id
JOIN person ppr ON ppr.person_id = a.patient_id
WHERE a.start_time::date = CURRENT_DATE
ORDER BY a.doctor_id, a.start_time;

-- Lab investigations ordered but not yet resulted
CREATE OR REPLACE VIEW vw_pending_lab_results AS
SELECT i.investigation_id, i.appointment_id, t.name AS test_name, i.ordered_at
FROM lab_investigation i
JOIN lab_test t ON t.test_id = i.test_id
LEFT JOIN lab_result r ON r.investigation_id = i.investigation_id
WHERE r.result_id IS NULL
ORDER BY i.ordered_at;

-- Recent audit entries (human-readable)
CREATE OR REPLACE VIEW vw_audit_recent AS
SELECT audit_id, table_name, operation, user_id, changed_at
FROM audit_log
ORDER BY changed_at DESC
LIMIT 100;
