"""Seed the database with realistic demo data using Faker.

Run:  python -m app.seed
Creates departments, doctors/nurses/lab-techs/admin/receptionist, patients,
ICD-10 codes, medicines and appointments.
Default login:  admin@meditrack.dev / Admin@123
"""
import random
from datetime import datetime, timedelta, timezone

from faker import Faker
from sqlalchemy import text

from app.core.database import Base, SessionLocal, engine
from app.core.security import hash_password
from app.models import (
    Appointment,
    Department,
    DiagnosisCode,
    Gender,
    HealthcareProfessional,
    LabTest,
    Medicine,
    MedicineCategory,
    Patient,
    Person,
    ProfessionalRole,
)

fake = Faker("en_IN")

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
    # Respiratory
    ("J45.909", "Unspecified asthma, uncomplicated"),
    ("J44.1",   "Chronic obstructive pulmonary disease with acute exacerbation"),
    ("J18.9",   "Pneumonia, unspecified organism"),
    ("J06.9",   "Acute upper respiratory infection, unspecified"),
    ("J02.9",   "Acute pharyngitis, unspecified"),
    ("J00",     "Acute nasopharyngitis (common cold)"),
    ("J30.9",   "Allergic rhinitis, unspecified"),
    ("J11.1",   "Influenza with other respiratory manifestations"),
    ("J22",     "Unspecified acute lower respiratory infection"),
    ("J96.00",  "Acute respiratory failure, unspecified"),
    # Gastrointestinal
    ("K21.9",   "Gastro-oesophageal reflux disease without oesophagitis"),
    ("K29.70",  "Gastritis, unspecified, without bleeding"),
    ("K57.30",  "Diverticulosis of large intestine without perforation"),
    ("K80.20",  "Calculus of gallbladder without cholecystitis"),
    ("K85.9",   "Acute pancreatitis, unspecified"),
    ("K50.90",  "Crohn's disease of small intestine, unspecified"),
    ("K51.90",  "Ulcerative colitis, unspecified"),
    ("K74.60",  "Unspecified cirrhosis of liver"),
    ("K76.0",   "Fatty change of liver, not elsewhere classified"),
    # Genitourinary / Renal
    ("N39.0",   "Urinary tract infection, site not specified"),
    ("N18.3",   "Chronic kidney disease, stage 3"),
    ("N18.6",   "End-stage renal disease"),
    ("N20.0",   "Calculus of kidney"),
    ("N40.0",   "Benign prostatic hyperplasia without lower urinary tract symptoms"),
    ("N17.9",   "Acute kidney failure, unspecified"),
    # Musculoskeletal
    ("M54.5",   "Low back pain"),
    ("M06.9",   "Rheumatoid arthritis, unspecified"),
    ("M10.9",   "Gout, unspecified"),
    ("M15.9",   "Polyosteoarthritis, unspecified"),
    ("M16.9",   "Osteoarthritis of hip, unspecified"),
    ("M17.9",   "Osteoarthritis of knee, unspecified"),
    ("M81.0",   "Age-related osteoporosis without current pathological fracture"),
    ("M54.2",   "Cervicalgia"),
    # Neurological / Mental Health
    ("R51",     "Headache"),
    ("G43.909", "Migraine, unspecified, not intractable"),
    ("G40.909", "Epilepsy, unspecified, not intractable"),
    ("G35",     "Multiple sclerosis"),
    ("G20",     "Parkinson's disease"),
    ("G30.9",   "Alzheimer's disease, unspecified"),
    ("F41.9",   "Anxiety disorder, unspecified"),
    ("F32.9",   "Major depressive disorder, single episode, unspecified"),
    ("F10.20",  "Alcohol dependence, uncomplicated"),
    # Dermatology
    ("L40.9",   "Psoriasis, unspecified"),
    ("L20.9",   "Atopic dermatitis, unspecified"),
    ("L50.9",   "Urticaria, unspecified"),
    ("L03.90",  "Cellulitis, unspecified"),
    # Infections
    ("A09",     "Gastroenteritis and colitis of infectious origin"),
    ("B34.9",   "Viral infection, unspecified"),
    ("A01.00",  "Typhoid fever, unspecified"),
    ("B50.9",   "Plasmodium falciparum malaria, unspecified"),
    ("A15.0",   "Tuberculosis of lung"),
    # Eyes / ENT
    ("H25.9",   "Age-related cataract, unspecified"),
    ("H40.9",   "Unspecified glaucoma"),
    ("H10.9",   "Unspecified conjunctivitis"),
    ("H91.90",  "Unspecified hearing loss"),
    ("J35.01",  "Chronic tonsillitis"),
    # Oncology
    ("C34.90",  "Malignant neoplasm of bronchus and lung, unspecified"),
    ("C50.919", "Malignant neoplasm of unspecified site of breast"),
    ("C61",     "Malignant neoplasm of prostate"),
    ("C18.9",   "Malignant neoplasm of colon, unspecified"),
    # Haematological
    ("D50.9",   "Iron deficiency anaemia, unspecified"),
    ("D64.9",   "Anaemia, unspecified"),
    ("D69.6",   "Thrombocytopenia, unspecified"),
    # General / Preventive
    ("Z00.00",  "Encounter for general adult medical examination"),
    ("Z13.220", "Encounter for screening for lipoid disorders"),
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
    ("Amoxicillin 500mg", "Antibiotic"),
    ("Paracetamol 650mg", "Analgesic"),
    ("Amlodipine 5mg", "Antihypertensive"),
    ("Metformin 500mg", "Antidiabetic"),
    ("Pantoprazole 40mg", "Antacid"),
    ("Azithromycin 250mg", "Antibiotic"),
    ("Ibuprofen 400mg", "Analgesic"),
    ("Losartan 50mg", "Antihypertensive"),
]


def seed():
    # Drop views first (they reference tables and block plain drop_all).
    with engine.begin() as conn:
        conn.execute(text(
            "DROP VIEW IF EXISTS vw_patient_summary, vw_doctor_schedule_today, "
            "vw_pending_lab_results, vw_audit_recent CASCADE;"
        ))
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Departments
    depts = {name: Department(name=name) for name in DEPARTMENTS}
    db.add_all(depts.values())
    db.flush()

    # Admin login
    admin_person = Person(
        first_name="System", last_name="Admin",
        date_of_birth=fake.date_of_birth(minimum_age=30, maximum_age=55),
        gender=Gender.OTHER, email="admin@meditrack.dev", phone=fake.msisdn()[:10],
    )
    db.add(admin_person)
    db.flush()
    db.add(HealthcareProfessional(
        professional_id=admin_person.person_id, role=ProfessionalRole.ADMIN,
        department_id=None, license_number="ADMIN-0001",
        password_hash=hash_password("Admin@123"),
    ))

    # Doctors + other staff
    doctors: list[HealthcareProfessional] = []
    roles_extra = [ProfessionalRole.NURSE, ProfessionalRole.LAB_TECHNICIAN, ProfessionalRole.RECEPTIONIST]
    for i in range(10):
        p = Person(
            first_name=fake.first_name(), last_name=fake.last_name(),
            date_of_birth=fake.date_of_birth(minimum_age=30, maximum_age=60),
            gender=random.choice(list(Gender)), email=f"doctor{i}@meditrack.dev",
            phone=fake.msisdn()[:10],
        )
        db.add(p)
        db.flush()
        doc = HealthcareProfessional(
            professional_id=p.person_id, role=ProfessionalRole.DOCTOR,
            department_id=random.choice(list(depts.values())).department_id,
            license_number=f"DOC-{1000+i}", password_hash=hash_password("Doctor@123"),
        )
        db.add(doc)
        doctors.append(doc)

    for i, role in enumerate(roles_extra):
        p = Person(
            first_name=fake.first_name(), last_name=fake.last_name(),
            date_of_birth=fake.date_of_birth(minimum_age=25, maximum_age=55),
            gender=random.choice(list(Gender)), email=f"{role.value.lower()}@meditrack.dev",
            phone=fake.msisdn()[:10],
        )
        db.add(p)
        db.flush()
        db.add(HealthcareProfessional(
            professional_id=p.person_id, role=role,
            department_id=random.choice(list(depts.values())).department_id,
            license_number=f"STF-{2000+i}", password_hash=hash_password("Staff@123"),
        ))

    # Reference data
    db.add_all([DiagnosisCode(icd10_code=c, description=d) for c, d in ICD10])
    db.add_all([LabTest(name=n, unit=u, ref_low=lo, ref_high=hi) for n, u, lo, hi in LAB_TESTS])
    cats = {name: MedicineCategory(name=name) for name in MED_CATEGORIES}
    db.add_all(cats.values())
    db.flush()
    db.add_all([
        Medicine(name=n, category_id=cats[c].category_id, stock_count=random.randint(50, 200))
        for n, c in MEDICINES
    ])

    # Patients
    patients: list[Patient] = []
    for i in range(50):
        p = Person(
            first_name=fake.first_name(), last_name=fake.last_name(),
            date_of_birth=fake.date_of_birth(minimum_age=1, maximum_age=90),
            gender=random.choice(list(Gender)), email=fake.unique.email(),
            phone=fake.msisdn()[:10],
        )
        db.add(p)
        db.flush()
        pat = Patient(
            patient_id=p.person_id, mrn=f"MRN{100000+i}",
            blood_group=random.choice(["A+", "B+", "O+", "AB+", "O-"]),
            emergency_contact=fake.msisdn()[:10],
        )
        db.add(pat)
        patients.append(pat)

    # Appointments across the last 3 months
    db.flush()
    for _ in range(200):
        doc = random.choice(doctors)
        pat = random.choice(patients)
        start = datetime.now(timezone.utc) - timedelta(
            days=random.randint(0, 90), hours=random.randint(0, 8)
        )
        db.add(Appointment(
            patient_id=pat.patient_id, doctor_id=doc.professional_id,
            start_time=start, end_time=start + timedelta(minutes=30),
            reason=fake.sentence(nb_words=4),
        ))

    db.commit()
    db.close()
    print("✅ Seed complete. Login: admin@meditrack.dev / Admin@123")


if __name__ == "__main__":
    seed()
