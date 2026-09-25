"""Advanced-SQL insights + query-performance routes — ADMIN only.

Showcases the SQL techniques on the DBSA rubric against live data:
  • window functions   → patient visit ranking
  • CTEs               → daily appointment volume + completion rate
  • recursive CTEs     → doctor referral chains
  • LATERAL joins      → latest lab result per test
  • EXPLAIN ANALYZE    → query plan + index-usage report
"""
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role

router = APIRouter(prefix="/insights", tags=["insights"])

# All insight endpoints require ADMIN role.
_admin = Depends(require_role("ADMIN"))


@router.get("/patient-ranking")
def patient_ranking(db: Session = Depends(get_db), _=_admin):
    sql = text("""
        SELECT pr.first_name || ' ' || pr.last_name         AS patient_name,
               p.mrn,
               COUNT(a.appointment_id)                       AS visits,
               RANK() OVER (ORDER BY COUNT(a.appointment_id) DESC) AS visit_rank
        FROM patient p
        JOIN person pr ON pr.person_id = p.patient_id
        LEFT JOIN appointment a ON a.patient_id = p.patient_id
        GROUP BY p.patient_id, pr.first_name, pr.last_name, p.mrn
        ORDER BY visits DESC
        LIMIT 10;
    """)
    return [dict(r._mapping) for r in db.execute(sql)]


@router.get("/appointment-volume")
def appointment_volume(db: Session = Depends(get_db), _=_admin):
    sql = text("""
        WITH daily AS (
            SELECT date_trunc('day', start_time) AS day,
                   COUNT(*)                        AS total,
                   COUNT(*) FILTER (WHERE status = 'COMPLETED') AS completed
            FROM appointment
            GROUP BY 1
        )
        SELECT to_char(day, 'Mon DD')                          AS day,
               total,
               completed,
               ROUND(100.0 * completed / NULLIF(total, 0), 1)  AS completion_rate
        FROM daily
        ORDER BY day DESC
        LIMIT 14;
    """)
    return [dict(r._mapping) for r in db.execute(sql)]


@router.get("/referral-chains")
def referral_chains(db: Session = Depends(get_db), _=_admin):
    sql = text("""
        WITH RECURSIVE chain AS (
            SELECT r.referral_id,
                   r.from_doctor_id,
                   r.to_doctor_id,
                   1 AS depth,
                   (fp.first_name || ' → ' || tp.first_name) AS path
            FROM referral r
            JOIN person fp ON fp.person_id = r.from_doctor_id
            JOIN person tp ON tp.person_id = r.to_doctor_id
            WHERE r.from_doctor_id NOT IN (SELECT to_doctor_id FROM referral)

            UNION ALL

            SELECT r.referral_id,
                   r.from_doctor_id,
                   r.to_doctor_id,
                   c.depth + 1,
                   (c.path || ' → ' || tp.first_name)
            FROM referral r
            JOIN chain c  ON r.from_doctor_id = c.to_doctor_id
            JOIN person tp ON tp.person_id = r.to_doctor_id
            WHERE c.depth < 8
        )
        SELECT DISTINCT ON (path) path, depth
        FROM chain
        ORDER BY path, depth DESC
        LIMIT 10;
    """)
    rows = [dict(r._mapping) for r in db.execute(sql)]
    rows.sort(key=lambda x: x["depth"], reverse=True)
    return rows


@router.get("/latest-lab-per-test")
def latest_lab_per_test(db: Session = Depends(get_db), _=_admin):
    sql = text("""
        SELECT t.name AS test_name,
               t.unit,
               latest.value,
               latest.flag,
               latest.recorded_at
        FROM lab_test t
        LEFT JOIN LATERAL (
            SELECT r.value, r.flag, r.recorded_at
            FROM lab_investigation i
            JOIN lab_result r ON r.investigation_id = i.investigation_id
            WHERE i.test_id = t.test_id
            ORDER BY r.recorded_at DESC
            LIMIT 1
        ) latest ON true
        ORDER BY t.name;
    """)
    return [dict(r._mapping) for r in db.execute(sql)]


@router.get("/performance")
def performance_report(db: Session = Depends(get_db), _=_admin):
    queries = {
        "doctor_schedule": """
            SELECT a.appointment_id, a.start_time, a.status
            FROM appointment a
            WHERE a.doctor_id = (SELECT professional_id FROM healthcare_professional
                                 WHERE role = 'DOCTOR' LIMIT 1)
              AND a.start_time >= now() - interval '30 days'
            ORDER BY a.start_time;
        """,
        "scheduled_partial_index": """
            SELECT count(*) FROM appointment
            WHERE status = 'SCHEDULED';
        """,
        "patient_history": """
            SELECT a.appointment_id, a.status
            FROM appointment a
            WHERE a.patient_id = (SELECT patient_id FROM patient LIMIT 1);
        """,
    }

    report = []
    for name, q in queries.items():
        plan_rows = db.execute(text(f"EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) {q}")).all()
        plan = "\n".join(r[0] for r in plan_rows)
        exec_time = next((ln.split("Execution Time:")[1].strip()
                          for ln in plan.splitlines() if "Execution Time:" in ln), "n/a")
        uses_index = "Index" in plan
        report.append({
            "query": name,
            "execution_time": exec_time,
            "uses_index": uses_index,
            "plan": plan,
        })
    return report

