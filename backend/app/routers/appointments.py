"""Appointment routes with database-level conflict detection."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import CurrentUser, get_current_user, require_role
from app.models import Appointment, AppointmentStatus, HealthcareProfessional, Patient, Person
from app.schemas import AppointmentCreate, AppointmentOut, StatusUpdate

router = APIRouter(prefix="/appointments", tags=["appointments"])


def _enrich(appt: Appointment, db: Session) -> AppointmentOut:
    """Attach patient_name and doctor_name to an appointment."""
    patient_person = db.execute(
        select(Person).join(Patient, Patient.patient_id == Person.person_id)
        .where(Patient.patient_id == appt.patient_id)
    ).scalar_one_or_none()
    doctor_person = db.execute(
        select(Person).join(HealthcareProfessional, HealthcareProfessional.professional_id == Person.person_id)
        .where(HealthcareProfessional.professional_id == appt.doctor_id)
    ).scalar_one_or_none()
    return AppointmentOut(
        appointment_id=appt.appointment_id,
        patient_id=appt.patient_id,
        doctor_id=appt.doctor_id,
        start_time=appt.start_time,
        end_time=appt.end_time,
        status=appt.status.value,
        reason=appt.reason,
        patient_name=f"{patient_person.first_name} {patient_person.last_name}" if patient_person else None,
        doctor_name=f"Dr. {doctor_person.first_name} {doctor_person.last_name}" if doctor_person else None,
    )


@router.get("", response_model=list[AppointmentOut])
def list_appointments(
    doctor_id: uuid.UUID | None = None,
    patient_id: uuid.UUID | None = None,
    status_filter: str | None = Query(None, alias="status"),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    stmt = select(Appointment)
    # Doctors only see their own appointments.
    if user.role == "DOCTOR":
        stmt = stmt.where(Appointment.doctor_id == uuid.UUID(user.user_id))
    elif doctor_id:
        stmt = stmt.where(Appointment.doctor_id == doctor_id)
    if patient_id:
        stmt = stmt.where(Appointment.patient_id == patient_id)
    if status_filter:
        stmt = stmt.where(Appointment.status == AppointmentStatus(status_filter))
    stmt = stmt.order_by(Appointment.start_time.desc())
    appts = db.execute(stmt).scalars().all()
    return [_enrich(a, db) for a in appts]


@router.post("", response_model=AppointmentOut, status_code=status.HTTP_201_CREATED)
def create_appointment(
    body: AppointmentCreate,
    db: Session = Depends(get_db),
    _=Depends(require_role("ADMIN", "RECEPTIONIST", "DOCTOR")),
):
    if body.end_time <= body.start_time:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "end_time must be after start_time")

    conflict = db.execute(
        select(Appointment)
        .where(
            and_(
                Appointment.doctor_id == body.doctor_id,
                Appointment.status == AppointmentStatus.SCHEDULED,
                Appointment.start_time < body.end_time,
                Appointment.end_time > body.start_time,
            )
        )
        .with_for_update()
    ).scalar_one_or_none()
    if conflict:
        raise HTTPException(status.HTTP_409_CONFLICT, "Doctor already booked in this time window")

    appt = Appointment(
        patient_id=body.patient_id,
        doctor_id=body.doctor_id,
        start_time=body.start_time,
        end_time=body.end_time,
        reason=body.reason,
    )
    db.add(appt)
    db.commit()
    db.refresh(appt)
    return _enrich(appt, db)


# Valid status transitions: current → allowed next statuses
_TRANSITIONS: dict[AppointmentStatus, list[AppointmentStatus]] = {
    AppointmentStatus.SCHEDULED: [
        AppointmentStatus.IN_PROGRESS,
        AppointmentStatus.CANCELLED,
        AppointmentStatus.NO_SHOW,
    ],
    AppointmentStatus.IN_PROGRESS: [
        AppointmentStatus.COMPLETED,
        AppointmentStatus.CANCELLED,
    ],
    # Terminal states — no further transitions allowed
    AppointmentStatus.COMPLETED:  [],
    AppointmentStatus.CANCELLED:  [],
    AppointmentStatus.NO_SHOW:    [],
}

# Some transitions are restricted by role even within the valid set
_ROLE_ALLOWED: dict[str, set[AppointmentStatus]] = {
    "ADMIN":        set(AppointmentStatus),
    "DOCTOR":       {AppointmentStatus.IN_PROGRESS, AppointmentStatus.COMPLETED,
                     AppointmentStatus.CANCELLED,   AppointmentStatus.NO_SHOW},
    "NURSE":        {AppointmentStatus.IN_PROGRESS, AppointmentStatus.COMPLETED,
                     AppointmentStatus.NO_SHOW},
    "RECEPTIONIST": {AppointmentStatus.CANCELLED},
}


@router.put("/{appointment_id}/status", response_model=AppointmentOut)
def update_status(
    appointment_id: uuid.UUID,
    body: StatusUpdate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_role("ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST")),
):
    appt = db.get(Appointment, appointment_id)
    if not appt:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Appointment not found")

    try:
        new_status = AppointmentStatus(body.status)
    except ValueError:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Unknown status: {body.status}")

    # Enforce state-machine transitions
    allowed_next = _TRANSITIONS.get(appt.status, [])
    if new_status not in allowed_next:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Cannot move from {appt.status.value} to {new_status.value}",
        )

    # Enforce role permissions
    role_allowed = _ROLE_ALLOWED.get(user.role, set())
    if new_status not in role_allowed:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            f"Your role cannot set status to {new_status.value}",
        )

    # Doctors can only update their own appointments
    if user.role == "DOCTOR" and str(appt.doctor_id) != user.user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your appointment")

    appt.status = new_status
    db.commit()
    db.refresh(appt)
    return _enrich(appt, db)
