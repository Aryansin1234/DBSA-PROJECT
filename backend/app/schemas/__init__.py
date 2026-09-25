"""Pydantic request/response schemas."""
from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ORMBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------- auth
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: str


class RefreshRequest(BaseModel):
    refresh_token: str


class UserProfile(BaseModel):
    """The signed-in user's identity for the app shell / sidebar."""

    id: uuid.UUID
    name: str
    email: str | None = None
    role: str
    department: str | None = None
    license_number: str | None = None


# -------------------------------------------------------------------- patient
class PatientCreate(BaseModel):
    first_name: str
    last_name: str
    date_of_birth: date
    gender: str
    phone: str | None = None
    email: EmailStr | None = None
    blood_group: str | None = None
    emergency_contact: str | None = None
    insurance_number: str | None = None


class PatientOut(ORMBase):
    patient_id: uuid.UUID
    mrn: str
    first_name: str
    last_name: str
    age: int
    gender: str
    phone: str | None = None
    blood_group: str | None = None


class AppointmentSummary(BaseModel):
    appointment_id: uuid.UUID
    start_time: datetime
    end_time: datetime
    status: str
    reason: str | None = None
    doctor_name: str | None = None


class DiagnosisSummary(BaseModel):
    diagnosis_id: uuid.UUID
    icd10_code: str
    description: str | None = None
    severity: str
    notes: str | None = None
    appointment_id: uuid.UUID


class PrescriptionSummary(BaseModel):
    prescription_id: uuid.UUID
    issued_at: datetime
    items: list[str]


class LabSummary(BaseModel):
    investigation_id: uuid.UUID
    test_name: str
    value: float | None = None
    flag: str | None = None
    ordered_at: datetime


class PatientDetailOut(BaseModel):
    """Full 360° view of a patient for the detail page."""

    patient: PatientOut
    email: str | None = None
    insurance_number: str | None = None
    emergency_contact: str | None = None
    stats: dict[str, int]
    appointments: list[AppointmentSummary]
    diagnoses: list[DiagnosisSummary]
    prescriptions: list[PrescriptionSummary]
    labs: list[LabSummary]


# --------------------------------------------------------------- professional
class DoctorOut(BaseModel):
    professional_id: uuid.UUID
    first_name: str
    last_name: str
    role: str
    department: str | None = None


# --------------------------------------------------------------------- audit
class AuditLogOut(ORMBase):
    audit_id: int
    table_name: str
    operation: str
    user_id: uuid.UUID | None = None
    changed_at: datetime


# ----------------------------------------------------------- clinical record
class ClinicalRecordIn(BaseModel):
    appointment_id: uuid.UUID
    subjective: str | None = None
    objective: str | None = None
    assessment: str | None = None
    plan: str | None = None
    version: int | None = None  # optimistic-lock check on update


class ClinicalRecordOut(ORMBase):
    record_id: uuid.UUID
    appointment_id: uuid.UUID
    subjective: str | None = None
    objective: str | None = None
    assessment: str | None = None
    plan: str | None = None
    version: int
    updated_at: datetime


# ---------------------------------------------------------------- appointment
class AppointmentCreate(BaseModel):
    patient_id: uuid.UUID
    doctor_id: uuid.UUID
    start_time: datetime
    end_time: datetime
    reason: str | None = None


class AppointmentOut(ORMBase):
    appointment_id: uuid.UUID
    patient_id: uuid.UUID
    doctor_id: uuid.UUID
    start_time: datetime
    end_time: datetime
    status: str
    reason: str | None = None
    patient_name: str | None = None
    doctor_name: str | None = None


class StatusUpdate(BaseModel):
    status: str


# ----------------------------------------------------------------- diagnosis
class DiagnosisCreate(BaseModel):
    appointment_id: uuid.UUID
    icd10_code: str
    severity: str = "MILD"
    notes: str | None = None


class DiagnosisOut(ORMBase):
    diagnosis_id: uuid.UUID
    appointment_id: uuid.UUID
    icd10_code: str
    severity: str
    notes: str | None = None


class ICD10Out(ORMBase):
    icd10_code: str
    description: str


# -------------------------------------------------------------- prescription
class PrescriptionItemIn(BaseModel):
    medicine_id: uuid.UUID
    dosage: str
    frequency: str
    duration_days: int = Field(gt=0)


class PrescriptionCreate(BaseModel):
    appointment_id: uuid.UUID
    items: list[PrescriptionItemIn]


class PrescriptionItemOut(ORMBase):
    medicine_id: uuid.UUID
    dosage: str
    frequency: str
    duration_days: int


class PrescriptionOut(ORMBase):
    prescription_id: uuid.UUID
    appointment_id: uuid.UUID
    issued_at: datetime
    items: list[PrescriptionItemOut]


# ---------------------------------------------------------------------- lab
class LabOrderCreate(BaseModel):
    appointment_id: uuid.UUID
    test_id: uuid.UUID


class LabResultCreate(BaseModel):
    value: float = Field(ge=0)


class LabResultOut(ORMBase):
    investigation_id: uuid.UUID
    test_id: uuid.UUID
    value: float | None = None
    flag: str | None = None
    ordered_at: datetime


class LabTestOut(BaseModel):
    test_id: uuid.UUID
    name: str
    unit: str | None = None
    ref_low: float | None = None
    ref_high: float | None = None


class PendingLabOut(BaseModel):
    """Enriched pending investigation — lab tech work queue item."""
    investigation_id: uuid.UUID
    appointment_id: uuid.UUID
    patient_id: uuid.UUID
    patient_name: str
    mrn: str
    test_id: uuid.UUID
    test_name: str
    unit: str | None = None
    ref_low: float | None = None
    ref_high: float | None = None
    ordered_by_name: str | None = None
    ordered_at: datetime


# ------------------------------------------------------------------- medicine
class MedicineOut(BaseModel):
    medicine_id: uuid.UUID
    name: str
    stock_count: int
    category: str | None = None
