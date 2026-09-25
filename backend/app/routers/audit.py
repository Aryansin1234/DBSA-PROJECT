"""Audit log route: read-only view of database change history.

Surfaces the `audit_log` table populated by PostgreSQL triggers, so the UI
can demonstrate database-level auditing (INSERT / UPDATE / DELETE tracking).
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_role
from app.models import AuditLog
from app.schemas import AuditLogOut

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("", response_model=list[AuditLogOut])
def list_audit_log(
    table: str | None = Query(None, description="Filter by table name"),
    limit: int = Query(100, le=500),
    offset: int = 0,
    db: Session = Depends(get_db),
    _=Depends(require_role("ADMIN")),
):
    """Most-recent-first audit entries. Admin-only (sensitive change history)."""
    stmt = select(AuditLog)
    if table:
        stmt = stmt.where(AuditLog.table_name == table)
    stmt = stmt.order_by(AuditLog.changed_at.desc()).limit(limit).offset(offset)
    return db.execute(stmt).scalars().all()
