"""Hospital Simulation Engine.

Instead of a one-off `seed.py`, this runs a background thread that continuously
generates realistic clinical events — as if a real hospital were operating live:

  • patients walk in and register
  • appointments get booked
  • appointments progress SCHEDULED → IN_PROGRESS → COMPLETED / NO_SHOW
  • doctors record diagnoses
  • prescriptions get issued (and inventory decremented)
  • lab tests get ordered and results entered (with abnormal-value flags)
  • pharmacy restocks medicines

Every action is pushed to an in-memory ring buffer so the UI can show a live
activity feed, and the analytics endpoints reflect the growing data in real time.

The engine is fully controllable at runtime via /api/simulator/*.
"""
from __future__ import annotations

import random
import threading
import time
import uuid
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from faker import Faker
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models import (
    Appointment,
    AppointmentStatus,
    ClinicalRecord,
    Department,
    Diagnosis,
    DiagnosisCode,
    Gender,
    HealthcareProfessional,
    LabInvestigation,
    LabResult,
    LabTest,
    Medicine,
    MedicineCategory,
    Patient,
    Person,
    Prescription,
    PrescriptionItem,
    ProfessionalRole,
    Referral,
    Severity,
)
from app.services.domain import flag_lab_result

fake = Faker("en_IN")

# --------------------------------------------------------------------- reference
DEPARTMENTS = ["Cardiology", "Neurology", "Orthopaedics", "Paediatrics", "General Medicine"]
ICD10 = [
    # Endocrine / Metabolic
    ("E11.9",   "Type 2 diabetes mellitus without complications"),
    ("E11.65",  "Type 2 diabetes mellitus with hyperglycaemia"),
    ("E10.9",   "Type 1 diabetes mellitus without complications"),
    ("E78.5",   "Hyperlipidaemia, unspecified"),
    ("E78.00",  "Pure hypercholesterolaemia, unspecified"),
    ("E66.9",   "Obesity, unspecified"),
    ("E03.9",   "Hypothyroidism, unspecified"),
    ("E05.90",  "Thyrotoxicosis, unspecified"),
    ("E11.40",  "Type 2 diabetes with diabetic neuropathy, unspecified"),
    ("E11.311", "Type 2 diabetes with unspecified diabetic retinopathy"),
    # Cardiovascular
    ("I10",     "Essential (primary) hypertension"),
    ("I25.10",  "Atherosclerotic heart disease, unspecified"),
    ("I50.9",   "Heart failure, unspecified"),
    ("I48.91",  "Unspecified atrial fibrillation"),
    ("I21.9",   "Acute myocardial infarction, unspecified"),
    ("I63.9",   "Cerebral infarction, unspecified"),
    ("I20.9",   "Angina pectoris, unspecified"),
    ("I35.0",   "Nonrheumatic aortic (valve) stenosis"),
    ("I73.9",   "Peripheral vascular disease, unspecified"),
    ("I83.90",  "Varicose veins of unspecified lower extremity without complications"),
    # Respiratory
    ("J45.909", "Unspecified asthma, uncomplicated"),
    ("J44.1",   "Chronic obstructive pulmonary disease with acute exacerbation"),
    ("J18.9",   "Pneumonia, unspecified organism"),
    ("J06.9",   "Acute upper respiratory infection, unspecified"),
    ("J02.9",   "Acute pharyngitis, unspecified"),
    ("J00",     "Acute nasopharyngitis (common cold)"),
    ("J30.9",   "Allergic rhinitis, unspecified"),
    ("J11.1",   "Influenza due to unidentified influenza virus with other respiratory manifestations"),
    ("J22",     "Unspecified acute lower respiratory infection"),
    ("J96.00",  "Acute respiratory failure, unspecified"),
    # Gastrointestinal
    ("K21.9",   "Gastro-oesophageal reflux disease without oesophagitis"),
    ("K29.70",  "Gastritis, unspecified, without bleeding"),
    ("K57.30",  "Diverticulosis of large intestine without perforation"),
    ("K92.1",   "Melaena"),
    ("K80.20",  "Calculus of gallbladder without cholecystitis"),
    ("K85.9",   "Acute pancreatitis, unspecified"),
    ("K50.90",  "Crohn's disease of small intestine, unspecified"),
    ("K51.90",  "Ulcerative colitis, unspecified"),
    ("K74.60",  "Unspecified cirrhosis of liver"),
    ("K76.0",   "Fatty (change of) liver, not elsewhere classified"),
    # Genitourinary / Renal
    ("N39.0",   "Urinary tract infection, site not specified"),
    ("N18.3",   "Chronic kidney disease, stage 3"),
    ("N18.6",   "End-stage renal disease"),
    ("N20.0",   "Calculus of kidney"),
    ("N40.0",   "Benign prostatic hyperplasia without lower urinary tract symptoms"),
    ("N17.9",   "Acute kidney failure, unspecified"),
    ("N92.0",   "Excessive and frequent menstruation with regular cycle"),
    ("N95.1",   "Menopausal and female climacteric states"),
    # Musculoskeletal
    ("M54.5",   "Low back pain"),
    ("M79.3",   "Panniculitis, unspecified"),
    ("M06.9",   "Rheumatoid arthritis, unspecified"),
    ("M10.9",   "Gout, unspecified"),
    ("M15.9",   "Polyosteoarthritis, unspecified"),
    ("M16.9",   "Osteoarthritis of hip, unspecified"),
    ("M17.9",   "Osteoarthritis of knee, unspecified"),
    ("M81.0",   "Age-related osteoporosis without current pathological fracture"),
    ("M54.2",   "Cervicalgia"),
    ("M25.561", "Pain in right knee"),
    # Neurological / Mental Health
    ("R51",     "Headache"),
    ("G43.909", "Migraine, unspecified, not intractable, without status migrainosus"),
    ("G40.909", "Epilepsy, unspecified, not intractable"),
    ("G35",     "Multiple sclerosis"),
    ("G20",     "Parkinson's disease"),
    ("G30.9",   "Alzheimer's disease, unspecified"),
    ("F41.9",   "Anxiety disorder, unspecified"),
    ("F32.9",   "Major depressive disorder, single episode, unspecified"),
    ("F10.20",  "Alcohol dependence, uncomplicated"),
    ("F20.9",   "Schizophrenia, unspecified"),
    # Dermatology
    ("L40.9",   "Psoriasis, unspecified"),
    ("L20.9",   "Atopic dermatitis, unspecified"),
    ("L50.9",   "Urticaria, unspecified"),
    ("L03.90",  "Cellulitis, unspecified"),
    ("B35.1",   "Tinea unguium"),
    # Infections / Fever
    ("A09",     "Other and unspecified gastroenteritis and colitis of infectious origin"),
    ("B34.9",   "Viral infection, unspecified"),
    ("A01.00",  "Typhoid fever, unspecified"),
    ("B50.9",   "Plasmodium falciparum malaria, unspecified"),
    ("A15.0",   "Tuberculosis of lung"),
    ("B24",     "Unspecified human immunodeficiency virus disease"),
    # Eyes / ENT
    ("H25.9",   "Age-related cataract, unspecified"),
    ("H40.9",   "Unspecified glaucoma"),
    ("H10.9",   "Unspecified conjunctivitis"),
    ("H81.39",  "Other specified peripheral vertigo"),
    ("H91.90",  "Unspecified hearing loss, unspecified ear"),
    ("J35.01",  "Chronic tonsillitis"),
    # Oncology
    ("C34.90",  "Malignant neoplasm of unspecified part of unspecified bronchus or lung"),
    ("C50.919", "Malignant neoplasm of unspecified site of unspecified female breast"),
    ("C61",     "Malignant neoplasm of prostate"),
    ("C18.9",   "Malignant neoplasm of colon, unspecified"),
    ("C92.00",  "Acute myeloblastic leukaemia, not having achieved remission"),
    # Haematological
    ("D50.9",   "Iron deficiency anaemia, unspecified"),
    ("D64.9",   "Anaemia, unspecified"),
    ("D69.6",   "Thrombocytopenia, unspecified"),
    # Paediatric / Other
    ("P07.30",  "Preterm newborn, unspecified weeks of gestation"),
    ("Z13.220", "Encounter for screening for lipoid disorders"),
    ("Z00.00",  "Encounter for general adult medical examination without abnormal findings"),
    ("Z23",     "Encounter for immunisation"),
]
LAB_TESTS = [
    # Metabolic / Diabetes
    ("Fasting Blood Glucose",       "mg/dL",  70,    100),
    ("Post-Prandial Blood Glucose",  "mg/dL",  70,    140),
    ("HbA1c",                        "%",       4.0,   5.6),
    ("Serum Insulin",                "µIU/mL",  2.6,  24.9),
    # Lipid Profile
    ("Total Cholesterol",            "mg/dL",  125,   200),
    ("LDL Cholesterol",              "mg/dL",   0,    100),
    ("HDL Cholesterol",              "mg/dL",  40,     60),
    ("Triglycerides",                "mg/dL",   0,    150),
    # Renal / Liver
    ("Serum Creatinine",             "mg/dL",   0.6,   1.3),
    ("Blood Urea Nitrogen",          "mg/dL",   7,    20),
    ("Uric Acid",                    "mg/dL",   3.5,   7.2),
    ("SGPT (ALT)",                   "U/L",      7,    56),
    ("SGOT (AST)",                   "U/L",     10,    40),
    ("Alkaline Phosphatase",         "U/L",     44,   147),
    ("Total Bilirubin",              "mg/dL",   0.1,   1.2),
    ("Serum Albumin",                "g/dL",    3.5,   5.0),
    # Haematology
    ("Haemoglobin",                  "g/dL",   12,    17),
    ("Total WBC Count",              "×10³/µL", 4.0,  11.0),
    ("Platelet Count",               "×10³/µL",150,   400),
    ("Haematocrit (PCV)",            "%",      36,    50),
    ("MCV",                          "fL",     80,    100),
    # Thyroid
    ("TSH",                          "µIU/mL",  0.4,   4.0),
    ("Free T3",                      "pg/mL",   2.3,   4.2),
    ("Free T4",                      "ng/dL",   0.8,   1.8),
    # Cardiac Markers
    ("Troponin I",                   "ng/mL",   0.0,   0.04),
    ("CK-MB",                        "U/L",      0,    25),
    ("BNP",                          "pg/mL",   0,    100),
    # Electrolytes
    ("Serum Sodium",                 "mEq/L",  136,   145),
    ("Serum Potassium",              "mEq/L",    3.5,   5.1),
    ("Serum Calcium",                "mg/dL",   8.5,  10.5),
    # Urinalysis / Other
    ("Urine Routine & Microscopy",   "",        0,      0),
    ("C-Reactive Protein (CRP)",     "mg/L",    0,      5),
    ("ESR",                          "mm/hr",   0,     20),
    ("Vitamin D (25-OH)",            "ng/mL",  30,    100),
    ("Vitamin B12",                  "pg/mL",  200,   900),
    ("Serum Ferritin",               "ng/mL",  12,    300),
]
MED_CATEGORIES = ["Antibiotic", "Analgesic", "Antihypertensive", "Antidiabetic", "Antacid"]
MEDICINES = [
    ("Amoxicillin 500mg", "Antibiotic"), ("Paracetamol 650mg", "Analgesic"),
    ("Amlodipine 5mg", "Antihypertensive"), ("Metformin 500mg", "Antidiabetic"),
    ("Pantoprazole 40mg", "Antacid"), ("Azithromycin 250mg", "Antibiotic"),
    ("Ibuprofen 400mg", "Analgesic"), ("Losartan 50mg", "Antihypertensive"),
]
REASONS = [
    "Routine check-up", "Follow-up consultation", "Fever and fatigue",
    "Chest pain evaluation", "Persistent cough", "Blood pressure review",
    "Diabetes management", "Back pain assessment", "Headache and dizziness",
    "Annual physical exam",
]


@dataclass
class SimEvent:
    ts: str
    type: str  # patient|appointment|status|diagnosis|prescription|lab|restock|system
    message: str


@dataclass
class SimState:
    running: bool = False
    interval: float = 3.0            # seconds between ticks
    ticks: int = 0
    started_at: str | None = None
    counters: dict[str, int] = field(default_factory=lambda: {
        "patients": 0, "appointments": 0, "status_changes": 0,
        "diagnoses": 0, "prescriptions": 0, "labs": 0, "restocks": 0,
        "records": 0, "referrals": 0,
    })


class HospitalSimulator:
    """Thread-driven live data generator with runtime controls."""

    def __init__(self) -> None:
        self._state = SimState()
        self._events: deque[SimEvent] = deque(maxlen=100)
        self._lock = threading.Lock()
        self._thread: threading.Thread | None = None
        self._stop = threading.Event()

    # ------------------------------------------------------------------ events
    def _emit(self, type_: str, message: str) -> None:
        # Map event type -> counter key (system events aren't counted).
        counter_key = {
            "patient": "patients",
            "appointment": "appointments",
            "status": "status_changes",
            "diagnosis": "diagnoses",
            "prescription": "prescriptions",
            "lab": "labs",
            "restock": "restocks",
            "record": "records",
            "referral": "referrals",
        }.get(type_)
        with self._lock:
            self._events.appendleft(
                SimEvent(ts=datetime.now(timezone.utc).isoformat(), type=type_, message=message)
            )
            if counter_key:
                self._state.counters[counter_key] += 1

    def recent_events(self, limit: int = 20) -> list[dict]:
        with self._lock:
            return [e.__dict__ for e in list(self._events)[:limit]]

    def status(self) -> dict:
        with self._lock:
            s = self._state
            return {
                "running": s.running,
                "interval": s.interval,
                "ticks": s.ticks,
                "started_at": s.started_at,
                "counters": dict(s.counters),
            }

    # ----------------------------------------------------------------- controls
    def start(self, interval: float | None = None) -> None:
        with self._lock:
            if self._state.running:
                if interval:
                    self._state.interval = max(0.3, interval)
                return
            if interval:
                self._state.interval = max(0.3, interval)
            self._state.running = True
            self._state.started_at = datetime.now(timezone.utc).isoformat()
            self._stop.clear()
        self._thread = threading.Thread(target=self._loop, name="hospital-sim", daemon=True)
        self._thread.start()
        self._emit("system", f"Simulation engine started (tick every {self._state.interval:g}s)")

    def stop(self) -> None:
        with self._lock:
            if not self._state.running:
                return
            self._state.running = False
        self._stop.set()
        self._emit("system", "Simulation engine paused")

    def set_interval(self, interval: float) -> None:
        with self._lock:
            self._state.interval = max(0.3, interval)
        self._emit("system", f"Tick interval set to {self._state.interval:g}s")

    # -------------------------------------------------------------------- loop
    def _loop(self) -> None:
        while not self._stop.is_set():
            try:
                db = SessionLocal()
                self._tick(db)
                db.close()
            except Exception as exc:  # keep the engine alive on any single failure
                self._emit("system", f"tick error: {exc}")
            with self._lock:
                self._state.ticks += 1
                interval = self._state.interval
            self._stop.wait(interval)

    # -------------------------------------------------------------- one sim step
    def _tick(self, db: Session) -> None:
        """Perform 1-3 weighted random actions per tick."""
        actions = [
            (self._act_register_patient, 18),
            (self._act_book_appointment, 26),
            (self._act_progress_appointment, 24),
            (self._act_add_diagnosis, 12),
            (self._act_issue_prescription, 10),
            (self._act_order_lab, 6),
            (self._act_enter_lab_result, 6),
            (self._act_restock, 2),
            (self._act_write_soap, 6),
            (self._act_refer_patient, 4),
        ]
        fns, weights = zip(*actions)
        for fn in random.choices(fns, weights=weights, k=random.randint(1, 3)):
            fn(db)

    # ------------------------------------------------------------------ helpers
    def _doctors(self, db: Session) -> list[HealthcareProfessional]:
        return db.execute(
            select(HealthcareProfessional).where(
                HealthcareProfessional.role == ProfessionalRole.DOCTOR
            )
        ).scalars().all()

    def _random_patient(self, db: Session) -> Patient | None:
        count = db.scalar(select(func.count()).select_from(Patient)) or 0
        if count == 0:
            return None
        return db.execute(select(Patient).offset(random.randrange(count)).limit(1)).scalar_one_or_none()

    # ------------------------------------------------------------------ actions
    def _act_register_patient(self, db: Session) -> None:
        first, last = fake.first_name(), fake.last_name()
        person = Person(
            first_name=first, last_name=last,
            date_of_birth=fake.date_of_birth(minimum_age=1, maximum_age=92),
            gender=random.choice(list(Gender)),
            email=fake.unique.email(), phone=fake.msisdn()[:10],
        )
        db.add(person)
        db.flush()
        mrn = "MRN" + uuid.uuid4().hex[:8].upper()
        db.add(Patient(
            patient_id=person.person_id, mrn=mrn,
            blood_group=random.choice(["A+", "B+", "O+", "AB+", "O-", "A-"]),
            emergency_contact=fake.msisdn()[:10],
        ))
        db.commit()
        self._emit("patient", f"New patient registered: {first} {last} ({mrn})")

    def _act_book_appointment(self, db: Session) -> None:
        doctors = self._doctors(db)
        pat = self._random_patient(db)
        if not doctors or not pat:
            return
        doc = random.choice(doctors)
        # Book slightly in the future / now so it appears on today's trend.
        start = datetime.now(timezone.utc) + timedelta(minutes=random.randint(-30, 240))
        end = start + timedelta(minutes=30)
        # Skip if doctor already booked in that window (mirrors the API rule).
        conflict = db.execute(
            select(Appointment).where(
                Appointment.doctor_id == doc.professional_id,
                Appointment.status == AppointmentStatus.SCHEDULED,
                Appointment.start_time < end,
                Appointment.end_time > start,
            )
        ).scalar_one_or_none()
        if conflict:
            return
        reason = random.choice(REASONS)
        db.add(Appointment(
            patient_id=pat.patient_id, doctor_id=doc.professional_id,
            start_time=start, end_time=end, reason=reason,
        ))
        db.commit()
        self._emit("appointment", f"Appointment booked — {reason} ({pat.mrn})")

    def _act_progress_appointment(self, db: Session) -> None:
        # Move a SCHEDULED / IN_PROGRESS appointment forward.
        appt = db.execute(
            select(Appointment).where(
                Appointment.status.in_([AppointmentStatus.SCHEDULED, AppointmentStatus.IN_PROGRESS])
            ).order_by(func.random()).limit(1)
        ).scalar_one_or_none()
        if not appt:
            return
        if appt.status == AppointmentStatus.SCHEDULED:
            appt.status = random.choices(
                [AppointmentStatus.IN_PROGRESS, AppointmentStatus.NO_SHOW, AppointmentStatus.CANCELLED],
                weights=[80, 12, 8],
            )[0]
        else:  # IN_PROGRESS
            appt.status = AppointmentStatus.COMPLETED
        db.commit()
        self._emit("status", f"Appointment → {appt.status.value.replace('_', ' ')}")

    def _act_add_diagnosis(self, db: Session) -> None:
        appt = db.execute(
            select(Appointment).where(
                Appointment.status.in_([AppointmentStatus.IN_PROGRESS, AppointmentStatus.COMPLETED])
            ).order_by(func.random()).limit(1)
        ).scalar_one_or_none()
        if not appt:
            return
        code = db.execute(select(DiagnosisCode).order_by(func.random()).limit(1)).scalar_one_or_none()
        if not code:
            return
        db.add(Diagnosis(
            appointment_id=appt.appointment_id, icd10_code=code.icd10_code,
            severity=random.choices(
                [Severity.MILD, Severity.MODERATE, Severity.SEVERE, Severity.CRITICAL],
                weights=[45, 35, 15, 5],
            )[0],
            notes=fake.sentence(nb_words=6),
        ))
        db.commit()
        self._emit("diagnosis", f"Diagnosis recorded: {code.description[:42]}")

    def _act_issue_prescription(self, db: Session) -> None:
        appt = db.execute(
            select(Appointment).where(
                Appointment.status.in_([AppointmentStatus.IN_PROGRESS, AppointmentStatus.COMPLETED])
            ).order_by(func.random()).limit(1)
        ).scalar_one_or_none()
        if not appt:
            return
        meds = db.execute(
            select(Medicine).where(Medicine.stock_count > 0).order_by(func.random()).limit(
                random.randint(1, 3)
            )
        ).scalars().all()
        if not meds:
            return
        rx = Prescription(appointment_id=appt.appointment_id)
        db.add(rx)
        db.flush()
        for med in meds:
            med.stock_count -= 1
            db.add(PrescriptionItem(
                prescription_id=rx.prescription_id, medicine_id=med.medicine_id,
                dosage=random.choice(["250mg", "500mg", "5mg", "40mg", "650mg"]),
                frequency=random.choice(["OD", "BID", "TID", "HS"]),
                duration_days=random.choice([3, 5, 7, 10, 14]),
            ))
        db.commit()
        self._emit("prescription", f"Prescription issued — {len(meds)} medicine(s)")

    def _act_order_lab(self, db: Session) -> None:
        appt = db.execute(
            select(Appointment).where(
                Appointment.status.in_([AppointmentStatus.IN_PROGRESS, AppointmentStatus.COMPLETED])
            ).order_by(func.random()).limit(1)
        ).scalar_one_or_none()
        test = db.execute(select(LabTest).order_by(func.random()).limit(1)).scalar_one_or_none()
        doctors = self._doctors(db)
        if not appt or not test or not doctors:
            return
        db.add(LabInvestigation(
            appointment_id=appt.appointment_id, test_id=test.test_id,
            ordered_by=random.choice(doctors).professional_id,
        ))
        db.commit()
        self._emit("lab", f"Lab ordered: {test.name}")

    def _act_enter_lab_result(self, db: Session) -> None:
        # Find an investigation without a result yet.
        inv = db.execute(
            select(LabInvestigation)
            .outerjoin(LabResult, LabResult.investigation_id == LabInvestigation.investigation_id)
            .where(LabResult.result_id.is_(None))
            .order_by(func.random()).limit(1)
        ).scalar_one_or_none()
        if not inv:
            return
        test = inv.test
        lo = float(test.ref_low) if test.ref_low is not None else 1.0
        hi = float(test.ref_high) if test.ref_high is not None else 10.0
        # Occasionally produce abnormal values to make flags interesting.
        span = hi - lo
        value = round(random.uniform(lo - span * 0.6, hi + span * 0.7), 2)
        value = max(0.0, value)
        flag = flag_lab_result(test, value)
        db.add(LabResult(
            investigation_id=inv.investigation_id, value=value, flag=flag,
            recorded_by=inv.ordered_by,
        ))
        db.commit()
        self._emit("lab", f"Result: {test.name} = {value}{test.unit or ''} [{flag.value}]")

    def _act_restock(self, db: Session) -> None:
        low = db.execute(
            select(Medicine).where(Medicine.stock_count < 40).order_by(func.random()).limit(1)
        ).scalar_one_or_none()
        if not low:
            return
        added = random.randint(50, 150)
        low.stock_count += added
        db.commit()
        self._emit("restock", f"Pharmacy restocked {low.name} (+{added})")

    def _act_write_soap(self, db: Session) -> None:
        # Write a SOAP clinical record for a completed/in-progress appointment
        # that doesn't already have one.
        appt = db.execute(
            select(Appointment)
            .outerjoin(ClinicalRecord, ClinicalRecord.appointment_id == Appointment.appointment_id)
            .where(
                Appointment.status.in_([AppointmentStatus.IN_PROGRESS, AppointmentStatus.COMPLETED]),
                ClinicalRecord.record_id.is_(None),
            )
            .order_by(func.random()).limit(1)
        ).scalar_one_or_none()
        if not appt:
            return
        db.add(ClinicalRecord(
            appointment_id=appt.appointment_id,
            subjective=fake.sentence(nb_words=10),
            objective=fake.sentence(nb_words=8),
            assessment=fake.sentence(nb_words=6),
            plan=fake.sentence(nb_words=7),
            version=1,
        ))
        db.commit()
        self._emit("record", "SOAP clinical note recorded")

    def _act_refer_patient(self, db: Session) -> None:
        doctors = self._doctors(db)
        pat = self._random_patient(db)
        if len(doctors) < 2 or not pat:
            return
        frm, to = random.sample(doctors, 2)
        db.add(Referral(
            from_doctor_id=frm.professional_id,
            to_doctor_id=to.professional_id,
            patient_id=pat.patient_id,
            reason=random.choice([
                "Specialist opinion required", "Further investigation",
                "Second opinion", "Sub-specialty consult", "Complex case",
            ]),
        ))
        db.commit()
        self._emit("referral", "Patient referred to another doctor")

    # -------------------------------------------------------------- bootstrap
    def ensure_baseline(self) -> None:
        """Idempotently seed ONLY reference/lookup data and the 5 demo accounts.

        No patients, appointments, diagnoses or prescriptions are created here.
        The platform starts completely blank — real data is entered by users or
        driven by the simulation engine once an admin starts it.

        Safe to call on every startup — only fills gaps, never duplicates.
        """
        db = SessionLocal()
        try:
            # ── Departments ──────────────────────────────────────────────────
            if not db.scalar(select(func.count()).select_from(Department)):
                depts = [Department(name=n) for n in DEPARTMENTS]
                db.add_all(depts)
                db.flush()
            depts = db.execute(select(Department)).scalars().all()

            # ── Admin account ────────────────────────────────────────────────
            admin = db.execute(
                select(Person).where(Person.email == "admin@meditrack.dev")
            ).scalar_one_or_none()
            if not admin:
                admin = Person(
                    first_name="System", last_name="Admin",
                    date_of_birth=datetime(1985, 1, 1).date(),
                    gender=Gender.OTHER, email="admin@meditrack.dev", phone="9000000000",
                )
                db.add(admin)
                db.flush()
                db.add(HealthcareProfessional(
                    professional_id=admin.person_id, role=ProfessionalRole.ADMIN,
                    department_id=None, license_number="ADMIN-0001",
                    password_hash=hash_password("Admin@123"),
                ))
            else:
                admin.first_name, admin.last_name = "System", "Admin"

            # ── Named demo accounts (one per non-admin role) ─────────────────
            demo_staff = [
                # (email, password, role, first, last, license)
                ("doctor@meditrack.dev",    "Doctor@123", ProfessionalRole.DOCTOR,         "Arjun",  "Sharma", "DOC-0001"),
                ("nurse@meditrack.dev",     "Staff@123",  ProfessionalRole.NURSE,           "Priya",  "Nair",   "NUR-0001"),
                ("lab@meditrack.dev",       "Staff@123",  ProfessionalRole.LAB_TECHNICIAN,  "Rohan",  "Desai",  "LAB-0001"),
                ("reception@meditrack.dev", "Staff@123",  ProfessionalRole.RECEPTIONIST,    "Kavya",  "Reddy",  "REC-0001"),
            ]
            for email, pwd, role, first, last, lic in demo_staff:
                person = db.execute(
                    select(Person).where(Person.email == email)
                ).scalar_one_or_none()
                if person:
                    person.first_name, person.last_name = first, last
                    continue
                p = Person(
                    first_name=first, last_name=last,
                    date_of_birth=fake.date_of_birth(minimum_age=28, maximum_age=58),
                    gender=random.choice(list(Gender)), email=email, phone=fake.msisdn()[:10],
                )
                db.add(p)
                db.flush()
                db.add(HealthcareProfessional(
                    professional_id=p.person_id, role=role,
                    department_id=random.choice(depts).department_id,
                    license_number=lic, password_hash=hash_password(pwd),
                ))

            # ── Reference / lookup tables — upsert so new entries are always added ──
            # ICD-10: insert new codes; update description if code already exists
            existing_icd = {
                row.icd10_code
                for row in db.execute(select(DiagnosisCode.icd10_code)).all()
            }
            for code, desc in ICD10:
                if code in existing_icd:
                    db.execute(
                        DiagnosisCode.__table__.update()
                        .where(DiagnosisCode.icd10_code == code)
                        .values(description=desc)
                    )
                else:
                    db.add(DiagnosisCode(icd10_code=code, description=desc))

            # Lab tests: insert new tests; update ref ranges if name already exists
            existing_tests = {
                row.name
                for row in db.execute(select(LabTest.name)).all()
            }
            for name, unit, lo, hi in LAB_TESTS:
                if name not in existing_tests:
                    db.add(LabTest(name=name, unit=unit or None, ref_low=lo if lo or hi else None, ref_high=hi if lo or hi else None))

            if not db.scalar(select(func.count()).select_from(Medicine)):
                cats = {n: MedicineCategory(name=n) for n in MED_CATEGORIES}
                db.add_all(cats.values())
                db.flush()
                db.add_all([
                    Medicine(name=n, category_id=cats[c].category_id, stock_count=random.randint(60, 200))
                    for n, c in MEDICINES
                ])

            db.commit()
        finally:
            db.close()


# Singleton used across the app.
simulator = HospitalSimulator()
