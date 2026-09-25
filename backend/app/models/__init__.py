"""SQLAlchemy ORM models for MediTrack.

Mirrors artefacts/schema.sql — people (generalisation), appointments,
diagnoses, prescriptions, lab investigations, clinical records, audit log.
"""
from __future__ import annotations

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def _uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


# --------------------------------------------------------------------- enums
class Gender(str, enum.Enum):
    MALE = "MALE"
    FEMALE = "FEMALE"
    OTHER = "OTHER"


class BloodGroup(str, enum.Enum):
    A_POS = "A+"; A_NEG = "A-"; B_POS = "B+"; B_NEG = "B-"
    AB_POS = "AB+"; AB_NEG = "AB-"; O_POS = "O+"; O_NEG = "O-"


class ProfessionalRole(str, enum.Enum):
    DOCTOR = "DOCTOR"
    NURSE = "NURSE"
    LAB_TECHNICIAN = "LAB_TECHNICIAN"
    RECEPTIONIST = "RECEPTIONIST"
    ADMIN = "ADMIN"


class AppointmentStatus(str, enum.Enum):
    SCHEDULED = "SCHEDULED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    NO_SHOW = "NO_SHOW"


class Severity(str, enum.Enum):
    MILD = "MILD"
    MODERATE = "MODERATE"
    SEVERE = "SEVERE"
    CRITICAL = "CRITICAL"


class LabFlag(str, enum.Enum):
    NORMAL = "NORMAL"
    LOW = "LOW"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


# --------------------------------------------------------------------- people
class Person(Base, TimestampMixin):
    __tablename__ = "person"

    person_id: Mapped[uuid.UUID] = _uuid_pk()
    first_name: Mapped[str] = mapped_column(String(80))
    last_name: Mapped[str] = mapped_column(String(80))
    date_of_birth: Mapped[date] = mapped_column(Date)
    gender: Mapped[Gender] = mapped_column(Enum(Gender, name="gender_enum"))
    phone: Mapped[str | None] = mapped_column(String(20))
    email: Mapped[str | None] = mapped_column(String(120), unique=True)

    __table_args__ = (CheckConstraint("date_of_birth < CURRENT_DATE", name="chk_dob"),)


class Department(Base):
    __tablename__ = "department"

    department_id: Mapped[uuid.UUID] = _uuid_pk()
    name: Mapped[str] = mapped_column(String(100), unique=True)


class Patient(Base, TimestampMixin):
    __tablename__ = "patient"

    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("person.person_id", ondelete="CASCADE"), primary_key=True
    )
    mrn: Mapped[str] = mapped_column(String(20), unique=True)
    blood_group: Mapped[BloodGroup | None] = mapped_column(Enum(BloodGroup, name="blood_group_enum"))
    emergency_contact: Mapped[str | None] = mapped_column(String(20))
    insurance_number: Mapped[str | None] = mapped_column(String(60))

    person: Mapped[Person] = relationship("Person")


class HealthcareProfessional(Base, TimestampMixin):
    __tablename__ = "healthcare_professional"

    professional_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("person.person_id", ondelete="CASCADE"), primary_key=True
    )
    role: Mapped[ProfessionalRole] = mapped_column(Enum(ProfessionalRole, name="professional_role"))
    department_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("department.department_id", ondelete="SET NULL")
    )
    license_number: Mapped[str | None] = mapped_column(String(60), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))

    person: Mapped[Person] = relationship("Person")
    department: Mapped[Department | None] = relationship("Department")


# ----------------------------------------------------------------- appointment
class Appointment(Base, TimestampMixin):
    __tablename__ = "appointment"

    appointment_id: Mapped[uuid.UUID] = _uuid_pk()
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patient.patient_id", ondelete="CASCADE")
    )
    doctor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("healthcare_professional.professional_id", ondelete="RESTRICT")
    )
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[AppointmentStatus] = mapped_column(
        Enum(AppointmentStatus, name="appointment_status"), default=AppointmentStatus.SCHEDULED
    )
    reason: Mapped[str | None] = mapped_column(String(255))

    __table_args__ = (CheckConstraint("end_time > start_time", name="chk_time"),)


# ------------------------------------------------------------------- diagnosis
class DiagnosisCode(Base):
    __tablename__ = "diagnosis_code"

    icd10_code: Mapped[str] = mapped_column(String(10), primary_key=True)
    description: Mapped[str] = mapped_column(String(255))


class Diagnosis(Base, TimestampMixin):
    __tablename__ = "diagnosis"

    diagnosis_id: Mapped[uuid.UUID] = _uuid_pk()
    appointment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("appointment.appointment_id", ondelete="CASCADE")
    )
    icd10_code: Mapped[str] = mapped_column(
        String(10), ForeignKey("diagnosis_code.icd10_code", ondelete="RESTRICT")
    )
    severity: Mapped[Severity] = mapped_column(Enum(Severity, name="severity_enum"), default=Severity.MILD)
    notes: Mapped[str | None] = mapped_column(Text)


# ---------------------------------------------------------------- prescription
class MedicineCategory(Base):
    __tablename__ = "medicine_category"

    category_id: Mapped[uuid.UUID] = _uuid_pk()
    name: Mapped[str] = mapped_column(String(100), unique=True)


class Medicine(Base):
    __tablename__ = "medicine"

    medicine_id: Mapped[uuid.UUID] = _uuid_pk()
    name: Mapped[str] = mapped_column(String(150))
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("medicine_category.category_id", ondelete="SET NULL")
    )
    stock_count: Mapped[int] = mapped_column(Integer, default=0)

    __table_args__ = (CheckConstraint("stock_count >= 0", name="chk_stock"),)


class Prescription(Base, TimestampMixin):
    __tablename__ = "prescription"

    prescription_id: Mapped[uuid.UUID] = _uuid_pk()
    appointment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("appointment.appointment_id", ondelete="CASCADE")
    )
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    items: Mapped[list[PrescriptionItem]] = relationship(
        "PrescriptionItem", cascade="all, delete-orphan", back_populates="prescription"
    )


class PrescriptionItem(Base):
    __tablename__ = "prescription_item"

    prescription_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("prescription.prescription_id", ondelete="CASCADE"), primary_key=True
    )
    medicine_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("medicine.medicine_id", ondelete="RESTRICT"), primary_key=True
    )
    dosage: Mapped[str] = mapped_column(String(60))
    frequency: Mapped[str] = mapped_column(String(60))
    duration_days: Mapped[int] = mapped_column(Integer)

    prescription: Mapped[Prescription] = relationship("Prescription", back_populates="items")
    medicine: Mapped[Medicine] = relationship("Medicine")

    __table_args__ = (CheckConstraint("duration_days > 0", name="chk_duration"),)


# ---------------------------------------------------------------------- lab
class LabTest(Base):
    __tablename__ = "lab_test"

    test_id: Mapped[uuid.UUID] = _uuid_pk()
    name: Mapped[str] = mapped_column(String(120))
    unit: Mapped[str | None] = mapped_column(String(20))
    ref_low: Mapped[float | None] = mapped_column(Numeric(10, 2))
    ref_high: Mapped[float | None] = mapped_column(Numeric(10, 2))


class LabInvestigation(Base):
    __tablename__ = "lab_investigation"

    investigation_id: Mapped[uuid.UUID] = _uuid_pk()
    appointment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("appointment.appointment_id", ondelete="CASCADE")
    )
    test_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("lab_test.test_id", ondelete="RESTRICT")
    )
    ordered_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("healthcare_professional.professional_id")
    )
    ordered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    test: Mapped[LabTest] = relationship("LabTest")
    result: Mapped["LabResult | None"] = relationship("LabResult", uselist=False, back_populates="investigation")


class LabResult(Base):
    __tablename__ = "lab_result"

    result_id: Mapped[uuid.UUID] = _uuid_pk()
    investigation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("lab_investigation.investigation_id", ondelete="CASCADE")
    )
    value: Mapped[float] = mapped_column(Numeric(10, 2))
    flag: Mapped[LabFlag] = mapped_column(Enum(LabFlag, name="lab_flag_enum"), default=LabFlag.NORMAL)
    recorded_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("healthcare_professional.professional_id")
    )
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    investigation: Mapped[LabInvestigation] = relationship("LabInvestigation", back_populates="result")

    __table_args__ = (CheckConstraint("value >= 0", name="chk_value"),)


# --------------------------------------------------------------- clinical record
class ClinicalRecord(Base, TimestampMixin):
    __tablename__ = "clinical_record"

    record_id: Mapped[uuid.UUID] = _uuid_pk()
    appointment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("appointment.appointment_id", ondelete="CASCADE")
    )
    subjective: Mapped[str | None] = mapped_column(Text)
    objective: Mapped[str | None] = mapped_column(Text)
    assessment: Mapped[str | None] = mapped_column(Text)
    plan: Mapped[str | None] = mapped_column(Text)
    version: Mapped[int] = mapped_column(Integer, default=1)


# ---------------------------------------------------------------------- referral
class Referral(Base):
    """Doctor-to-doctor patient referral (powers the recursive-CTE chain demo)."""

    __tablename__ = "referral"

    referral_id: Mapped[uuid.UUID] = _uuid_pk()
    from_doctor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("healthcare_professional.professional_id", ondelete="CASCADE")
    )
    to_doctor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("healthcare_professional.professional_id", ondelete="CASCADE")
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patient.patient_id", ondelete="CASCADE")
    )
    reason: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ------------------------------------------------------------------- audit log
class AuditLog(Base):
    __tablename__ = "audit_log"

    audit_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    table_name: Mapped[str] = mapped_column(String(80))
    operation: Mapped[str] = mapped_column(String(10))
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    old_data: Mapped[dict | None] = mapped_column(JSONB)
    new_data: Mapped[dict | None] = mapped_column(JSONB)
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
