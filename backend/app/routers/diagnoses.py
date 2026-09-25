"""Diagnosis + ICD-10 search routes."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models import Diagnosis, DiagnosisCode, Severity
from app.schemas import DiagnosisCreate, DiagnosisOut, ICD10Out

router = APIRouter(tags=["diagnoses"])


@router.get("/icd10/search", response_model=list[ICD10Out])
def search_icd10(
    q: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    like = f"%{q}%"
    stmt = (
        select(DiagnosisCode)
        .where(DiagnosisCode.description.ilike(like) | DiagnosisCode.icd10_code.ilike(like))
        .limit(20)
    )
    return db.execute(stmt).scalars().all()


@router.post("/diagnoses", response_model=DiagnosisOut, status_code=status.HTTP_201_CREATED)
def create_diagnosis(
    body: DiagnosisCreate,
    db: Session = Depends(get_db),
    _=Depends(require_role("DOCTOR", "ADMIN")),
):
    if not db.get(DiagnosisCode, body.icd10_code):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "ICD-10 code not found")
    dx = Diagnosis(
        appointment_id=body.appointment_id,
        icd10_code=body.icd10_code,
        severity=Severity(body.severity),
        notes=body.notes,
    )
    db.add(dx)
    db.commit()
    db.refresh(dx)
    return dx


@router.get("/diagnoses/{appointment_id}", response_model=list[DiagnosisOut])
def list_for_appointment(
    appointment_id: uuid.UUID, db: Session = Depends(get_db), _=Depends(get_current_user)
):
    stmt = select(Diagnosis).where(Diagnosis.appointment_id == appointment_id)
    return db.execute(stmt).scalars().all()
