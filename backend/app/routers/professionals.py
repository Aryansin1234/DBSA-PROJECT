"""Healthcare professional routes: list doctors for scheduling dropdowns."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import Department, HealthcareProfessional, Person, ProfessionalRole
from app.schemas import DoctorOut

router = APIRouter(prefix="/professionals", tags=["professionals"])


@router.get("", response_model=list[DoctorOut])
def list_professionals(
    role: str | None = Query(None, description="Filter by role, e.g. DOCTOR"),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    stmt = (
        select(HealthcareProfessional, Person, Department)
        .join(Person, Person.person_id == HealthcareProfessional.professional_id)
        .outerjoin(Department, Department.department_id == HealthcareProfessional.department_id)
    )
    if role:
        stmt = stmt.where(HealthcareProfessional.role == ProfessionalRole(role))
    stmt = stmt.order_by(Person.first_name)

    out: list[DoctorOut] = []
    for prof, person, dept in db.execute(stmt).all():
        out.append(
            DoctorOut(
                professional_id=prof.professional_id,
                first_name=person.first_name,
                last_name=person.last_name,
                role=prof.role.value,
                department=dept.name if dept else None,
            )
        )
    return out
