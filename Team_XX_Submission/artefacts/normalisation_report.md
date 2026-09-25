# Normalisation Report (Extract)
### MediTrack — SESAP ZC337 | Team_XX

This document records the functional dependencies (FDs) and normalisation reasoning for the
core tables. Full proofs for all tables are maintained in the SRS; three representative proofs
are given below.

---

## 1. `prescription_item` — BCNF Proof

**Relation:** `prescription_item(prescription_id, medicine_id, dosage, frequency, duration_days)`

**Functional Dependencies:**
```
{prescription_id, medicine_id} → dosage, frequency, duration_days
```

- **Candidate key:** `{prescription_id, medicine_id}` (composite).
- **1NF:** All attributes atomic; no repeating groups. ✅
- **2NF:** No non-prime attribute depends on part of the key — `dosage`, `frequency`,
  `duration_days` depend on the *whole* key. ✅
- **3NF:** No transitive dependency among non-prime attributes. ✅
- **BCNF:** The only determinant `{prescription_id, medicine_id}` is a superkey. ✅ **In BCNF.**

---

## 2. `lab_result` — BCNF Proof

**Relation:** `lab_result(result_id, investigation_id, value, flag, recorded_by, recorded_at)`

**Functional Dependencies:**
```
result_id → investigation_id, value, flag, recorded_by, recorded_at
```

- **Candidate key:** `result_id`.
- The `flag` is *not* stored as a dependency of `value` — it is computed by
  `fn_flag_abnormal_lab_result()` and persisted at write time (a deliberate, documented
  denormalisation for read performance and audit stability).
- All non-key attributes depend solely on `result_id`. The only determinant is the key. ✅ **In BCNF.**

**Denormalisation note:** `flag` is functionally derivable from (`test_id`, `value`) via reference
ranges. It is intentionally materialised so that historic results retain the flag that was valid
at recording time, even if reference ranges are later revised.

---

## 3. `diagnosis` — 3NF / BCNF Proof

**Relation:** `diagnosis(diagnosis_id, appointment_id, icd10_code, severity, notes)`

**Functional Dependencies:**
```
diagnosis_id → appointment_id, icd10_code, severity, notes
icd10_code   → (description)   -- held in the separate diagnosis_code lookup table
```

- The ICD-10 `description` is **removed** from `diagnosis` to eliminate the transitive
  dependency `diagnosis_id → icd10_code → description`. It lives only in `diagnosis_code`.
- After this decomposition, the only determinant in `diagnosis` is the key `diagnosis_id`.
  ✅ **In BCNF.**

---

## Summary Table

| Table | Highest Normal Form | Notes |
|---|---|---|
| `person`, `patient` | BCNF | Clean 1:1 supertype/subtype split |
| `appointment` | BCNF | Single-key determinant |
| `diagnosis` / `diagnosis_code` | BCNF | ICD-10 description factored into lookup |
| `prescription_item` | BCNF | Composite-key weak entity |
| `lab_result` | BCNF | Documented denormalisation of `flag` |
| `clinical_record` | 3NF | SOAP columns; `soap_search` derived (denormalised) |
