"""Patient routes: list, create, retrieve, 360° detail."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import CurrentUser, get_current_user, require_role
from app.models import (
    Appointment,
    Diagnosis,
    DiagnosisCode,
    Gender,
    HealthcareProfessional,
    LabInvestigation,
    LabResult,
    LabTest,
    Patient,
    Person,
    Prescription,
    PrescriptionItem,
    Medicine,
)
from app.schemas import (
    AppointmentSummary,
    DiagnosisSummary,
    LabSummary,
    PatientCreate,
    PatientDetailOut,
    PatientOut,
    PrescriptionSummary,
)
from app.services.domain import calculate_age

router = APIRouter(prefix="/patients", tags=["patients"])


def _to_out(patient: Patient) -> PatientOut:
    p = patient.person
    return PatientOut(
        patient_id=patient.patient_id,
        mrn=patient.mrn,
        first_name=p.first_name,
        last_name=p.last_name,
        age=calculate_age(p.date_of_birth),
        gender=p.gender.value,
        phone=p.phone,
        blood_group=patient.blood_group.value if patient.blood_group else None,
    )


@router.get("", response_model=list[PatientOut])
def list_patients(
    q: str | None = Query(None, description="Search by name / MRN / phone"),
    limit: int = Query(50, le=200),
    offset: int = 0,
    all_patients: bool = Query(False, alias="all"),
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    stmt = select(Patient).join(Person, Person.person_id == Patient.patient_id)

    # Doctors normally only see patients they have an appointment with.
    # Pass ?all=true to get all patients (used by booking form to create new relationships).
    if user.role == "DOCTOR" and not all_patients:
        stmt = stmt.where(
            Patient.patient_id.in_(
                select(Appointment.patient_id).where(
                    Appointment.doctor_id == uuid.UUID(user.user_id)
                )
            )
        )

    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            or_(Person.first_name.ilike(like), Person.last_name.ilike(like),
                Patient.mrn.ilike(like), Person.phone.ilike(like))
        )
    stmt = stmt.order_by(Person.first_name).limit(limit).offset(offset)
    return [_to_out(p) for p in db.execute(stmt).scalars().all()]


@router.post("", response_model=PatientOut, status_code=status.HTTP_201_CREATED)
def create_patient(
    body: PatientCreate,
    db: Session = Depends(get_db),
    _=Depends(require_role("ADMIN", "RECEPTIONIST")),
):
    person = Person(
        first_name=body.first_name,
        last_name=body.last_name,
        date_of_birth=body.date_of_birth,
        gender=Gender(body.gender),
        phone=body.phone,
        email=body.email,
    )
    db.add(person)
    db.flush()  # obtain person_id

    mrn = "MRN" + uuid.uuid4().hex[:8].upper()
    patient = Patient(
        patient_id=person.person_id,
        mrn=mrn,
        blood_group=body.blood_group,
        emergency_contact=body.emergency_contact,
        insurance_number=body.insurance_number,
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return _to_out(patient)


@router.get("/{patient_id}", response_model=PatientOut)
def get_patient(
    patient_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    patient = db.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Patient not found")
    # Doctors can only fetch patients they have an appointment with.
    if user.role == "DOCTOR":
        appt = db.execute(
            select(Appointment).where(
                Appointment.patient_id == patient_id,
                Appointment.doctor_id == uuid.UUID(user.user_id),
            ).limit(1)
        ).scalar_one_or_none()
        if not appt:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your patient")
    return _to_out(patient)


@router.get("/{patient_id}/detail", response_model=PatientDetailOut)
def get_patient_detail(
    patient_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(get_current_user),
):
    """360° clinical view: demographics + appointments, diagnoses, prescriptions, labs.

    Access rules:
    - ADMIN / NURSE  → all sections
    - DOCTOR         → only patients they have an appointment with; all sections
    - LAB_TECHNICIAN → only lab investigations (no diagnoses/prescriptions)
    - RECEPTIONIST   → demographics + appointments only (no clinical detail)
    """
    patient = db.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Patient not found")

    p = patient.person
    role = user.role

    # ── Doctor scope check ────────────────────────────────────────────────────
    if role == "DOCTOR":
        appt_check = db.execute(
            select(Appointment).where(
                Appointment.patient_id == patient_id,
                Appointment.doctor_id == uuid.UUID(user.user_id),
            ).limit(1)
        ).scalar_one_or_none()
        if not appt_check:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not your patient")

    # ── Appointments (all roles that reach here) ──────────────────────────────
    doctor_person = Person.__table__.alias("doctor_person")
    appt_query = (
        select(Appointment, doctor_person.c.first_name, doctor_person.c.last_name)
        .join(HealthcareProfessional, HealthcareProfessional.professional_id == Appointment.doctor_id)
        .join(doctor_person, doctor_person.c.person_id == HealthcareProfessional.professional_id)
        .where(Appointment.patient_id == patient_id)
        .order_by(Appointment.start_time.desc())
    )
    # Doctors only see appointments they own.
    if role == "DOCTOR":
        appt_query = appt_query.where(Appointment.doctor_id == uuid.UUID(user.user_id))

    appt_rows = db.execute(appt_query).all()
    appointments = [
        AppointmentSummary(
            appointment_id=a.appointment_id,
            start_time=a.start_time,
            end_time=a.end_time,
            status=a.status.value,
            reason=a.reason,
            doctor_name=f"Dr. {fn} {ln}",
        )
        for a, fn, ln in appt_rows
    ]
    appt_ids = [a.appointment_id for a, _, _ in appt_rows]

    # ── Clinical sections (role-gated) ────────────────────────────────────────
    diagnoses: list[DiagnosisSummary] = []
    prescriptions: list[PrescriptionSummary] = []
    labs: list[LabSummary] = []

    can_see_clinical = role in ("ADMIN", "DOCTOR", "NURSE")
    can_see_labs     = role in ("ADMIN", "DOCTOR", "NURSE", "LAB_TECHNICIAN")

    if appt_ids:
        if can_see_clinical:
            diag_rows = db.execute(
                select(Diagnosis, DiagnosisCode.description)
                .outerjoin(DiagnosisCode, DiagnosisCode.icd10_code == Diagnosis.icd10_code)
                .where(Diagnosis.appointment_id.in_(appt_ids))
                .order_by(Diagnosis.created_at.desc())
            ).all()
            diagnoses = [
                DiagnosisSummary(
                    diagnosis_id=d.diagnosis_id,
                    icd10_code=d.icd10_code,
                    description=desc,
                    severity=d.severity.value,
                    notes=d.notes,
                    appointment_id=d.appointment_id,
                )
                for d, desc in diag_rows
            ]

            presc_rows = db.execute(
                select(Prescription)
                .where(Prescription.appointment_id.in_(appt_ids))
                .order_by(Prescription.issued_at.desc())
            ).scalars().all()
            for presc in presc_rows:
                item_rows = db.execute(
                    select(Medicine.name, PrescriptionItem.dosage, PrescriptionItem.frequency)
                    .join(PrescriptionItem, PrescriptionItem.medicine_id == Medicine.medicine_id)
                    .where(PrescriptionItem.prescription_id == presc.prescription_id)
                ).all()
                prescriptions.append(
                    PrescriptionSummary(
                        prescription_id=presc.prescription_id,
                        issued_at=presc.issued_at,
                        items=[f"{name} — {dosage}, {freq}" for name, dosage, freq in item_rows],
                    )
                )

        if can_see_labs:
            lab_rows = db.execute(
                select(LabInvestigation, LabTest.name, LabResult.value, LabResult.flag)
                .join(LabTest, LabTest.test_id == LabInvestigation.test_id)
                .outerjoin(LabResult, LabResult.investigation_id == LabInvestigation.investigation_id)
                .where(LabInvestigation.appointment_id.in_(appt_ids))
                .order_by(LabInvestigation.ordered_at.desc())
            ).all()
            labs = [
                LabSummary(
                    investigation_id=inv.investigation_id,
                    test_name=name,
                    value=float(value) if value is not None else None,
                    flag=flag.value if flag is not None else None,
                    ordered_at=inv.ordered_at,
                )
                for inv, name, value, flag in lab_rows
            ]

    return PatientDetailOut(
        patient=_to_out(patient),
        email=p.email,
        insurance_number=patient.insurance_number,
        emergency_contact=patient.emergency_contact,
        stats={
            "appointments": len(appointments),
            "diagnoses": len(diagnoses),
            "prescriptions": len(prescriptions),
            "labs": len(labs),
        },
        appointments=appointments,
        diagnoses=diagnoses,
        prescriptions=prescriptions,
        labs=labs,
    )
