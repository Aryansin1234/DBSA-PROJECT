# 08 · Roadmap — Term 2 Enhancements

Term 1 of MediTrack is complete. The full relational core, clinical workflows,
role-based access, simulation engine, and SQL showcase are all built and working.

Term 2 extends the platform into **multimodal data**, **AI-assisted clinical
decision support**, and **predictive analytics**.

---

## Term 2 — Three Pillars

### 1. DICOM Viewer
*Medical image upload, metadata storage, in-browser rendering*

**What it adds:**
- New `medical_image` table: `image_id`, `patient_id`, `appointment_id`, `modality`
  (X-ray/MRI/CT/Ultrasound), `body_part`, `acquisition_date`, `file_path`,
  `file_size_kb`, `resolution_width`, `resolution_height`, `radiologist_notes`
- `POST /images/upload` — multipart file upload, saves to disk, stores metadata in DB
- Composite index on `(patient_id, modality, acquisition_date DESC)` for efficient filtering
- **Cornerstone.js** integration in the frontend for in-browser DICOM viewing
- Image search: filter by patient, modality, body part, date range
- New "Images" section on the patient detail page

**Tech:** Cornerstone.js (DICOM), PostgreSQL (metadata), filesystem (files)

---

### 2. AI Summaries
*Clinical notes summarisation + drug-interaction checker + diagnosis suggestion*

**What it adds:**

**a) SOAP Note Summarisation**
- `POST /ai/summarise-notes` — takes SOAP note text, returns structured summary:
  Chief Complaint, Key Findings, Assessment, Plan
- AI summary panel displayed alongside the full note on the patient detail page
- Model: OpenAI GPT-4o (cloud) or local Ollama `llama3.2` (free, offline)
- Responses cached in Redis to avoid redundant API calls

**b) Drug Interaction Checker**
- On `POST /prescriptions`, check all prescribed medicines against OpenFDA API
  for known interactions
- Warning banner rendered in the prescription form if interactions are detected
- `drug_interaction_log` table stores every check result for audit purposes

**c) Diagnosis Suggestion**
- `POST /ai/suggest-diagnosis` — input: symptom list, output: top 5 probable
  ICD-10 codes with confidence scores
- Non-mandatory helper panel in the Diagnosis form ("AI suggests…" — doctor
  approves or ignores)
- Model: scikit-learn multi-label classifier trained on a public
  symptom-to-ICD-10 dataset

**Tech:** OpenAI API / Ollama, OpenFDA API, scikit-learn, Redis (cache)

---

### 3. Demand Forecasting
*Appointment demand prediction + time-series vitals + critical lab alerts*

**What it adds:**

**a) Appointment Demand Forecasting**
- Train a **Prophet** (Facebook/Meta) time-series model on historical appointment
  data by department
- `GET /forecasts/appointments?department=Cardiology&days=30` — returns predicted
  daily appointment counts with confidence intervals
- Forecast chart on the Analytics dashboard (30-day horizon)

**b) Time-Series Vitals (TimescaleDB)**
- Enable **TimescaleDB** extension on PostgreSQL
- New `vital_reading` hypertable: `reading_id`, `patient_id`, `appointment_id`,
  `metric` (HR/BP/SpO2/Temp), `value`, `unit`, `recorded_at TIMESTAMPTZ`
- Partitioned by `recorded_at` (daily chunks)
- `GET /vitals/{patient_id}?metric=HR&from=&to=` — time-range query
- Vital sign trend charts per patient using Recharts

**c) Critical Lab Result Alerts (WebSocket)**
- When a `CRITICAL` lab result is entered, push a real-time WebSocket notification
  to the ordering doctor
- `GET /alerts/active` — list of unacknowledged critical results for the logged-in doctor
- Alert banner on Doctor dashboard: "⚠ Critical result — [Patient] — [Test] = [Value]"

**Tech:** Prophet, TimescaleDB, FastAPI WebSockets, Redis pub/sub

---

## Summary Table

| Feature | Pillar | Effort | Exam Relevance |
|---|---|---|---|
| DICOM image upload + metadata | DICOM Viewer | Medium | Multimodal storage, composite index |
| Cornerstone.js in-browser viewer | DICOM Viewer | Medium | Frontend integration |
| SOAP note AI summarisation | AI Summaries | Low | LLM integration |
| Drug interaction checker (OpenFDA) | AI Summaries | Low | External API + audit log |
| Diagnosis suggestion (ML classifier) | AI Summaries | High | ML pipeline |
| Prophet appointment forecasting | Demand Forecasting | Medium | Time-series analytics |
| TimescaleDB vitals hypertable | Demand Forecasting | Medium | Multimodal DB (time-series) |
| Critical result WebSocket alerts | Demand Forecasting | Medium | Real-time + CRITICAL flag |
| PostGIS hospital proximity search | (bonus) | Low | Spatial DB |
| Lab report PDF + OCR search | (bonus) | Medium | Document storage |
