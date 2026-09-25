"""Clinical Record (SOAP) routes with optimistic-locking version control."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models import ClinicalRecord
from app.schemas import ClinicalRecordIn, ClinicalRecordOut

router = APIRouter(prefix="/records", tags=["clinical-records"])


@router.get("/{appointment_id}", response_model=ClinicalRecordOut | None)
def get_record(
    appointment_id: uuid.UUID, db: Session = Depends(get_db), _=Depends(get_current_user)
):
    """Return the SOAP record for an appointment (or null if none yet)."""
    rec = db.execute(
        select(ClinicalRecord).where(ClinicalRecord.appointment_id == appointment_id)
    ).scalar_one_or_none()
    return rec


@router.post("", response_model=ClinicalRecordOut)
def upsert_record(
    body: ClinicalRecordIn,
    db: Session = Depends(get_db),
    _=Depends(require_role("DOCTOR", "ADMIN")),
):
    """Create or update the SOAP note for an appointment.

    Uses **optimistic locking**: on update the client must send the `version`
    it last read; a mismatch means someone else edited it first → 409.
    """
    rec = db.execute(
        select(ClinicalRecord).where(ClinicalRecord.appointment_id == body.appointment_id)
    ).scalar_one_or_none()

    if rec is None:
        rec = ClinicalRecord(
            appointment_id=body.appointment_id,
            subjective=body.subjective,
            objective=body.objective,
            assessment=body.assessment,
            plan=body.plan,
            version=1,
        )
        db.add(rec)
    else:
        if body.version is not None and body.version != rec.version:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"Record was modified by someone else (your v{body.version}, "
                f"current v{rec.version}). Reload and try again.",
            )
        rec.subjective = body.subjective
        rec.objective = body.objective
        rec.assessment = body.assessment
        rec.plan = body.plan
        rec.version += 1

    db.commit()
    db.refresh(rec)
    return rec
