"""Lab investigation ordering + result entry with abnormal-value flagging."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import CurrentUser, get_current_user, require_role
from app.models import (
    Appointment, HealthcareProfessional, LabInvestigation, LabResult,
    LabTest, Medicine, MedicineCategory, Patient, Person,
)
from app.schemas import (
    LabOrderCreate, LabResultCreate, LabResultOut,
    LabTestOut, MedicineOut, PendingLabOut,
)
from app.services.domain import flag_lab_result

router = APIRouter(prefix="/lab", tags=["lab"])


@router.get("/tests", response_model=list[LabTestOut])
def list_lab_tests(db: Session = Depends(get_db), _=Depends(get_current_user)):
    """All available lab tests — used to populate the order-lab dropdown."""
    return db.execute(select(LabTest).order_by(LabTest.name)).scalars().all()


@router.get("/medicines", response_model=list[MedicineOut])
def list_medicines(db: Session = Depends(get_db), _=Depends(require_role("DOCTOR", "ADMIN"))):
    """All medicines with stock — used to populate the prescribe dropdown."""
    rows = db.execute(
        select(Medicine, MedicineCategory.name.label("cat_name"))
        .outerjoin(MedicineCategory, MedicineCategory.category_id == Medicine.category_id)
        .order_by(Medicine.name)
    ).all()
    return [
        MedicineOut(
            medicine_id=m.medicine_id,
            name=m.name,
            stock_count=m.stock_count,
            category=cat_name,
        )
        for m, cat_name in rows
    ]


@router.get("/pending", response_model=list[PendingLabOut])
def pending_investigations(
    db: Session = Depends(get_db),
    _=Depends(require_role("LAB_TECHNICIAN", "ADMIN")),
):
    """Pending lab investigations (no result yet) — enriched with patient & test info."""
    # Alias person table for the ordering doctor
    doctor_person = Person.__table__.alias("doctor_person")

    rows = db.execute(
        select(
            LabInvestigation,
            LabTest,
            Patient,
            Person,
            doctor_person.c.first_name.label("doc_first"),
            doctor_person.c.last_name.label("doc_last"),
        )
        .join(LabTest,       LabTest.test_id           == LabInvestigation.test_id)
        .join(Appointment,   Appointment.appointment_id == LabInvestigation.appointment_id)
        .join(Patient,       Patient.patient_id         == Appointment.patient_id)
        .join(Person,        Person.person_id           == Patient.patient_id)
        .outerjoin(
            HealthcareProfessional,
            HealthcareProfessional.professional_id == LabInvestigation.ordered_by,
        )
        .outerjoin(doctor_person, doctor_person.c.person_id == LabInvestigation.ordered_by)
        .outerjoin(LabResult, LabResult.investigation_id == LabInvestigation.investigation_id)
        .where(LabResult.result_id.is_(None))
        .order_by(LabInvestigation.ordered_at)
    ).all()

    return [
        PendingLabOut(
            investigation_id=inv.investigation_id,
            appointment_id=inv.appointment_id,
            patient_id=patient.patient_id,
            patient_name=f"{person.first_name} {person.last_name}",
            mrn=patient.mrn,
            test_id=test.test_id,
            test_name=test.name,
            unit=test.unit,
            ref_low=float(test.ref_low)  if test.ref_low  is not None else None,
            ref_high=float(test.ref_high) if test.ref_high is not None else None,
            ordered_by_name=(
                f"Dr. {doc_first} {doc_last}" if doc_first else None
            ),
            ordered_at=inv.ordered_at,
        )
        for inv, test, patient, person, doc_first, doc_last in rows
    ]


@router.post("/orders", response_model=LabResultOut, status_code=status.HTTP_201_CREATED)
def order_test(
    body: LabOrderCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_role("DOCTOR", "ADMIN")),
):
    if not db.get(LabTest, body.test_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Lab test not found")
    inv = LabInvestigation(
        appointment_id=body.appointment_id,
        test_id=body.test_id,
        ordered_by=uuid.UUID(user.user_id),
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)
    return LabResultOut(
        investigation_id=inv.investigation_id,
        test_id=inv.test_id,
        ordered_at=inv.ordered_at,
    )


@router.put("/results/{investigation_id}", response_model=LabResultOut)
def enter_result(
    investigation_id: uuid.UUID,
    body: LabResultCreate,
    db: Session = Depends(get_db),
    user: CurrentUser = Depends(require_role("LAB_TECHNICIAN", "ADMIN")),
):
    inv = db.get(LabInvestigation, investigation_id)
    if not inv:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Investigation not found")
    if db.execute(
        select(LabResult).where(LabResult.investigation_id == investigation_id)
    ).scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, "Result already entered for this investigation")
    flag = flag_lab_result(inv.test, body.value)
    result = LabResult(
        investigation_id=investigation_id,
        value=body.value,
        flag=flag,
        recorded_by=uuid.UUID(user.user_id),
    )
    db.add(result)
    db.commit()
    return LabResultOut(
        investigation_id=investigation_id,
        test_id=inv.test_id,
        value=body.value,
        flag=flag.value,
        ordered_at=inv.ordered_at,
    )


@router.get("/results/{appointment_id}", response_model=list[LabResultOut])
def results_for_appointment(
    appointment_id: uuid.UUID, db: Session = Depends(get_db), _=Depends(get_current_user)
):
    stmt = select(LabInvestigation).where(LabInvestigation.appointment_id == appointment_id)
    out: list[LabResultOut] = []
    for inv in db.execute(stmt).scalars().all():
        out.append(
            LabResultOut(
                investigation_id=inv.investigation_id,
                test_id=inv.test_id,
                value=float(inv.result.value) if inv.result else None,
                flag=inv.result.flag.value if inv.result else None,
                ordered_at=inv.ordered_at,
            )
        )
    return out


