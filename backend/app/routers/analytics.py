"""Analytics routes: KPIs and simple aggregations for the dashboard."""
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import CurrentUser, get_current_user
from app.models import (
    Appointment,
    AppointmentStatus,
    Diagnosis,
    DiagnosisCode,
    Patient,
    Prescription,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _doctor_filter(stmt, doctor_id: uuid.UUID):
    """Scope an Appointment-based statement to a specific doctor."""
    return stmt.where(Appointment.doctor_id == doctor_id)


@router.get("/kpis")
def kpis(db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    is_doctor = user.role == "DOCTOR"
    doc_id = uuid.UUID(user.user_id) if is_doctor else None

    base_appt = select(func.count()).select_from(Appointment)
    if is_doctor:
        base_appt = base_appt.where(Appointment.doctor_id == doc_id)

    total_patients: int
    if is_doctor:
        total_patients = db.scalar(
            select(func.count(Appointment.patient_id.distinct()))
            .where(Appointment.doctor_id == doc_id)
        ) or 0
    else:
        total_patients = db.scalar(select(func.count()).select_from(Patient)) or 0

    total_appointments = db.scalar(base_appt) or 0

    sched_stmt = base_appt.where(Appointment.status == AppointmentStatus.SCHEDULED)
    if is_doctor:
        sched_stmt = (
            select(func.count()).select_from(Appointment)
            .where(Appointment.doctor_id == doc_id,
                   Appointment.status == AppointmentStatus.SCHEDULED)
        )
    scheduled = db.scalar(sched_stmt) or 0

    # Active prescriptions — doctors see only their own
    if is_doctor:
        active_prescriptions = db.scalar(
            select(func.count()).select_from(Prescription)
            .join(Appointment, Appointment.appointment_id == Prescription.appointment_id)
            .where(Appointment.doctor_id == doc_id)
        ) or 0
    else:
        active_prescriptions = db.scalar(select(func.count()).select_from(Prescription)) or 0

    return {
        "total_patients": total_patients,
        "total_appointments": total_appointments,
        "scheduled_appointments": scheduled,
        "active_prescriptions": active_prescriptions,
    }


@router.get("/diagnoses/top")
def top_diagnoses(db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    stmt = (
        select(
            Diagnosis.icd10_code,
            DiagnosisCode.description,
            func.count().label("count"),
        )
        .join(DiagnosisCode, DiagnosisCode.icd10_code == Diagnosis.icd10_code)
    )
    if user.role == "DOCTOR":
        stmt = stmt.join(Appointment, Appointment.appointment_id == Diagnosis.appointment_id).where(
            Appointment.doctor_id == uuid.UUID(user.user_id)
        )
    stmt = stmt.group_by(Diagnosis.icd10_code, DiagnosisCode.description).order_by(func.count().desc()).limit(5)
    return [
        {"icd10_code": code, "description": desc, "count": count}
        for code, desc, count in db.execute(stmt).all()
    ]


@router.get("/appointments/status-breakdown")
def status_breakdown(db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    stmt = select(Appointment.status, func.count()).group_by(Appointment.status)
    if user.role == "DOCTOR":
        stmt = stmt.where(Appointment.doctor_id == uuid.UUID(user.user_id))
    return [
        {"status": s.value, "count": count}
        for s, count in db.execute(stmt).all()
    ]


@router.get("/appointments/weekly-trend")
def weekly_trend(db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    since = datetime.now(timezone.utc) - timedelta(days=6)
    stmt = (
        select(
            func.date(Appointment.start_time).label("day"),
            func.count().label("count"),
        )
        .where(Appointment.start_time >= since)
        .group_by(func.date(Appointment.start_time))
        .order_by(func.date(Appointment.start_time))
    )
    if user.role == "DOCTOR":
        stmt = stmt.where(Appointment.doctor_id == uuid.UUID(user.user_id))
    rows = {str(day): count for day, count in db.execute(stmt).all()}

    out = []
    for i in range(7):
        d = (since + timedelta(days=i)).date()
        out.append({"day": d.strftime("%a"), "count": rows.get(str(d), 0)})
    return out


@router.get("/appointments/stats")
def appointment_stats(db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    """Counts for each status — used by the Appointments page stat cards."""
    stmt = select(Appointment.status, func.count()).group_by(Appointment.status)
    if user.role == "DOCTOR":
        stmt = stmt.where(Appointment.doctor_id == uuid.UUID(user.user_id))
    rows = {s.value: count for s, count in db.execute(stmt).all()}
    return {
        "total":       sum(rows.values()),
        "scheduled":   rows.get("SCHEDULED", 0),
        "in_progress": rows.get("IN_PROGRESS", 0),
        "completed":   rows.get("COMPLETED", 0),
        "cancelled":   rows.get("CANCELLED", 0),
        "no_show":     rows.get("NO_SHOW", 0),
    }

