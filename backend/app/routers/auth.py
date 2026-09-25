"""Authentication routes: login, refresh."""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import CurrentUser, get_current_user
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)
from app.models import HealthcareProfessional, Person
from app.schemas import RefreshRequest, TokenResponse, UserProfile

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Login with email (username field) + password, returns JWT tokens."""
    stmt = (
        select(HealthcareProfessional)
        .join(Person, Person.person_id == HealthcareProfessional.professional_id)
        .where(Person.email == form.username)
    )
    prof = db.execute(stmt).scalar_one_or_none()
    if not prof or not verify_password(form.password, prof.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")

    subject = str(prof.professional_id)
    return TokenResponse(
        access_token=create_access_token(subject, prof.role.value),
        refresh_token=create_refresh_token(subject, prof.role.value),
        role=prof.role.value,
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(body: RefreshRequest):
    try:
        payload = decode_token(body.refresh_token)
    except ValueError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(exc)) from exc
    if payload.get("type") != "refresh":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not a refresh token")

    subject, role = payload["sub"], payload["role"]
    return TokenResponse(
        access_token=create_access_token(subject, role),
        refresh_token=create_refresh_token(subject, role),
        role=role,
    )


@router.get("/me", response_model=UserProfile)
def me(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """Return the signed-in user's identity for the app shell / sidebar."""
    prof = db.get(HealthcareProfessional, user.user_id)
    if not prof:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    person = db.get(Person, prof.professional_id)
    return UserProfile(
        id=prof.professional_id,
        name=f"{person.first_name} {person.last_name}".strip(),
        email=person.email,
        role=prof.role.value,
        department=prof.department.name if prof.department else None,
        license_number=prof.license_number,
    )
