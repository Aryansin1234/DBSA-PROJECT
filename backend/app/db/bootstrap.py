"""Apply the raw-SQL database layer (functions, triggers, views, indexes, roles).

Runs once at startup AFTER SQLAlchemy has created the tables. Everything here is
idempotent so it is safe to run on every boot.

This is what turns MediTrack from "an ORM with a UI" into a real database system:
DB-enforced auditing, conflict prevention, analytical views and tuned indexes.
"""
from __future__ import annotations

from pathlib import Path

from sqlalchemy import text

from app.core.database import engine

SQL_DIR = Path(__file__).parent / "sql"

# Tables that get an automatic updated_at bump on UPDATE.
_UPDATED_AT_TABLES = [
    "person", "patient", "healthcare_professional", "appointment",
    "diagnosis", "prescription", "clinical_record",
]

# Tables whose every change is written to audit_log.
_AUDITED_TABLES = [
    "patient", "appointment", "diagnosis", "prescription",
    "prescription_item", "lab_result", "clinical_record",
]


def _run_sql_file(conn, path: Path) -> None:
    sql = path.read_text()
    conn.execute(text(sql))


def _attach_triggers(conn) -> None:
    """Attach updated_at / audit / conflict triggers (PG16 CREATE OR REPLACE)."""
    for tbl in _UPDATED_AT_TABLES:
        conn.execute(text(
            f"CREATE OR REPLACE TRIGGER set_updated_at_{tbl} "
            f"BEFORE UPDATE ON {tbl} "
            f"FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();"
        ))

    for tbl in _AUDITED_TABLES:
        conn.execute(text(
            f"CREATE OR REPLACE TRIGGER audit_{tbl} "
            f"AFTER INSERT OR UPDATE OR DELETE ON {tbl} "
            f"FOR EACH ROW EXECUTE FUNCTION trg_write_audit();"
        ))

    # Appointment conflict guard — INSERT only (status updates must not trip it).
    conn.execute(text(
        "CREATE OR REPLACE TRIGGER check_appointment_conflict "
        "BEFORE INSERT ON appointment "
        "FOR EACH ROW EXECUTE FUNCTION trg_appointment_conflict();"
    ))


def apply_database_layer() -> None:
    """Apply functions/triggers/views/indexes/roles. Best-effort & idempotent."""
    with engine.begin() as conn:
        # 1) functions + trigger functions
        _run_sql_file(conn, SQL_DIR / "01_functions_triggers.sql")
        # 2) attach triggers to the ORM-created tables
        _attach_triggers(conn)
        # 3) analytical / operational views
        _run_sql_file(conn, SQL_DIR / "02_views.sql")
        # 4) indexes
        _run_sql_file(conn, SQL_DIR / "03_indexes.sql")

    # 5) DB roles + grants — separate transaction; ignore if insufficient privs
    try:
        with engine.begin() as conn:
            _run_sql_file(conn, SQL_DIR / "04_roles.sql")
    except Exception as exc:  # noqa: BLE001 - roles are optional/defence-in-depth
        print(f"[db-bootstrap] roles skipped: {exc}")

    print("[db-bootstrap] database layer applied (functions, triggers, views, indexes).")
