"""Prescription routes — creates prescription + items and decrements stock
inside a single transaction (demonstrates ACID / atomicity)."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.models import Medicine, Prescription, PrescriptionItem
from app.schemas import PrescriptionCreate, PrescriptionOut

router = APIRouter(prefix="/prescriptions", tags=["prescriptions"])


@router.post("", response_model=PrescriptionOut, status_code=status.HTTP_201_CREATED)
def create_prescription(
    body: PrescriptionCreate,
    db: Session = Depends(get_db),
    _=Depends(require_role("DOCTOR", "ADMIN")),
):
    if not body.items:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "At least one item required")

    # --- Transaction boundary begins (single commit at the end) ---
    rx = Prescription(appointment_id=body.appointment_id)
    db.add(rx)
    db.flush()

    for item in body.items:
        medicine = db.get(Medicine, item.medicine_id, with_for_update=True)
        if not medicine:
            db.rollback()
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"Medicine {item.medicine_id} not found")
        if medicine.stock_count <= 0:
            db.rollback()
            raise HTTPException(status.HTTP_409_CONFLICT, f"{medicine.name} out of stock")
        medicine.stock_count -= 1  # decrement inventory
        db.add(
            PrescriptionItem(
                prescription_id=rx.prescription_id,
                medicine_id=item.medicine_id,
                dosage=item.dosage,
                frequency=item.frequency,
                duration_days=item.duration_days,
            )
        )

    db.commit()  # atomic: prescription + items + stock all persist together
    db.refresh(rx)
    return rx


@router.get("/{prescription_id}", response_model=PrescriptionOut)
def get_prescription(
    prescription_id: uuid.UUID, db: Session = Depends(get_db), _=Depends(get_current_user)
):
    rx = db.get(Prescription, prescription_id)
    if not rx:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Prescription not found")
    return rx
