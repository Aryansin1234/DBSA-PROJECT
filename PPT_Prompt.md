# MediTrack — PPT Generation Prompt

> Copy the prompt below into **Gamma.app**, **Beautiful.ai**, **Tome**, or
> **ChatGPT** (with a presentation plugin) to generate the slide deck.

---

```
Create a 10-slide presentation for a university database systems capstone project.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
THEME & DESIGN RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Colour palette:
  Primary background: #0f2c4c  (deep navy blue)
  Secondary surface:  #1a3d5c  (medium navy)
  Accent / highlight: #2fa27a  (soft green — icons, borders, badges)
  Text on dark:       #ffffff and #e2e8f0  (light slate)
  Text on light:      #0f2c4c  (navy)
  Success badges:     #2fa27a
  Warning / alert:    #f59e0b  (amber)
  Danger:             #ef4444  (red)

Typography:
  Font: Inter (sans-serif)
  Headings: Bold, white, large
  Body: Regular, #e2e8f0, medium
  Code / monospace: JetBrains Mono or Courier New, colour #5dcea8

Layout rules:
  - Dark navy background on every slide
  - Thin green accent line under each slide title
  - Icons: medical/clinical theme (stethoscope, flask, shield, chart, calendar)
  - Minimal text — each bullet point ≤ 10 words
  - Use coloured pill/badge chips for status values
  - Tables: dark surface (#1a3d5c), green header row, white body text
  - Flow diagrams: white boxes + lines on navy, green arrow highlights

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SLIDE 1 — TITLE SLIDE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Full navy background. Subtle green ECG / heartbeat line graphic across the
bottom third. Stethoscope icon in a green rounded square, top-left corner.

  MediTrack
  [hero size, white, bold]

  Smart Patient & Clinical Record Management System
  [subtitle, #e2e8f0]

  BITS Pilani WILP  ·  SESAP ZC337  ·  September 2026
  [small, #94a3b8]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SLIDE 2 — THE PROBLEM & SOLUTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Two-column layout.
Left column has a subtle red tint border. Right column has a subtle green tint border.

LEFT — "Paper-based clinic today"
  ✗  Patient re-registered in every register
  ✗  Prescriptions with no audit trail
  ✗  Doctors double-booked
  ✗  Abnormal lab results missed
  ✗  Anyone can access any record

RIGHT — "MediTrack fixes it"
  ✓  Single patient record, referenced everywhere
  ✓  PostgreSQL trigger captures every change
  ✓  Conflict trigger + SELECT FOR UPDATE lock
  ✓  Auto-flag: NORMAL / LOW / HIGH / CRITICAL
  ✓  5 roles, least-privilege RBAC

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SLIDE 3 — ARCHITECTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Horizontal flow diagram, white rounded boxes on navy, green arrows between them.

  [ React 18 + TypeScript ]
    Vite · TanStack Query
    Zustand · Recharts
    Framer Motion · GSAP
           │
       /api/ proxy
           ↓
  [ FastAPI + SQLAlchemy ]
    Python 3.11 · Pydantic
    JWT + bcrypt · 14 routers
    Simulation Engine thread
           │
          SQL
           ↓
  [ PostgreSQL 16 ]  ←──►  [ Redis 7 ]
    15 tables                Token store
    Triggers / Views         Session cache
    Indexes / RBAC roles

Below diagram — 4 badge chips in a row:
  [ Docker Compose ]  [ JWT Auth ]  [ Role Guards ]  [ Live Simulation ]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SLIDE 4 — DATABASE DESIGN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Left: compact entity pill-chip grid (two columns).
Right: 4 design-decision callout cards with green left border.

LEFT — 15 Tables (green pill chips):
  person              patient
  department          healthcare_professional
  appointment         diagnosis
  diagnosis_code      prescription
  prescription_item   medicine
  medicine_category   lab_test
  lab_investigation   lab_result
  clinical_record     referral
  audit_log

RIGHT — Key Design Decisions:
  ┌─ UUID primary keys — no enumeration attacks
  ┌─ Generalisation: person → patient / professional
  ┌─ Weak entity: prescription_item (composite PK)
  ┌─ 6 ENUMs: status, severity, flag, gender, blood, role

Bottom row — 5 amber CHECK constraint badges:
  [ DOB < today ]  [ end > start ]  [ value ≥ 0 ]  [ stock ≥ 0 ]  [ duration > 0 ]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SLIDE 5 — DATABASE LAYER (Standout Features)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2 × 2 grid of quadrant cards. Each card: icon + title + short bullets.

┌─────────────────────────┬─────────────────────────┐
│  ⚡ TRIGGERS  (amber)   │  f() FUNCTIONS  (green) │
│                         │                         │
│  trg_write_audit        │  fn_calculate_age(dob)  │
│  → JSONB old/new        │  → returns INT          │
│                         │                         │
│  trg_appt_conflict      │  fn_flag_lab_result      │
│  → double-book RAISE    │  → NORMAL/LOW/HIGH/      │
│                         │    CRITICAL              │
│  trg_set_updated_at     │                         │
│  → 7 tables             │                         │
├─────────────────────────┼─────────────────────────┤
│  👁 VIEWS  (blue)       │  📊 INDEXES  (purple)   │
│                         │                         │
│  vw_patient_summary     │  15 total indexes       │
│  vw_doctor_schedule_    │  FK B-trees (all FKs)   │
│    today                │  Composite:             │
│  vw_pending_lab_results │  (doctor_id, start_time)│
│  vw_audit_recent        │  Partial: WHERE status= │
│                         │    'SCHEDULED'          │
│                         │  GIN: audit_log JSONB   │
└─────────────────────────┴─────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SLIDE 6 — ADVANCED SQL SHOWCASE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4 horizontal cards. Each card: dark surface (#1a3d5c), green top border,
monospace SQL snippet, plain-English description below.

CARD 1 — WINDOW FUNCTION
  RANK() OVER (ORDER BY COUNT(visits) DESC)
  ─────────────────────────────────────────
  Top 10 patients ranked by visit count

CARD 2 — CTE
  WITH daily AS (
    SELECT date_trunc('day', start_time)…
  )
  ─────────────────────────────────────────
  Daily appointment volume + completion rate

CARD 3 — RECURSIVE CTE
  WITH RECURSIVE chain AS (
    anchor UNION ALL recursive step
  ) depth ≤ 8
  ─────────────────────────────────────────
  Doctor referral chain traversal

CARD 4 — LATERAL JOIN
  LEFT JOIN LATERAL (
    SELECT … ORDER BY recorded_at DESC LIMIT 1
  ) ON true
  ─────────────────────────────────────────
  Latest lab result per test type

Bottom — one centred green badge:
  [ All 4 queries live in SQL Insights page · Admin only ]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SLIDE 7 — ROLE-BASED ACCESS CONTROL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Permission table. Dark navy surface. Green header row.
Use ✅ for allowed, — (dash) for not allowed.

                  ADMIN   DOCTOR   NURSE   LAB TECH   RECEPTIONIST
Register patient   ✅       —        —        —           ✅
View patient list  ✅      Own       ✅       ✅         List only
Patient detail     ✅      Own       ✅     Labs only       —
Book appointment   ✅       ✅        —        —           ✅
Diagnose           ✅       ✅        —        —           —
Prescribe          ✅       ✅        —        —           —
Order lab test     ✅       ✅        —        —           —
Enter lab result   ✅       —         —        ✅          —
SQL Insights       ✅       —         —        —           —
Audit Log          ✅       —         —        —           —
Lab Queue          ✅       —         —        ✅          —
Sim Engine         ✅       —         —        —           —

Below table — 3-layer enforcement flow (small, horizontal):
  [ PostgreSQL DB roles ] → [ FastAPI require_role() ] → [ React RoleRoute ]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SLIDE 8 — TRANSACTIONS & SECURITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Two sections side by side, dividing line in the middle.

LEFT — ACID Transaction: Prescription Creation
  Step 1  INSERT prescription → flush for ID
  Step 2  SELECT medicine FOR UPDATE
  Step 3  Validate stock_count > 0
  Step 4  stock_count -= 1
  Step 5  INSERT prescription_item
  ─────────────────────────────────
  Single db.commit() — all or nothing
  [ Atomicity ]  [ Consistency ]  [ Isolation ]  [ Durability ]
  (4 green badge chips)

RIGHT — Optimistic Locking: SOAP Clinical Notes
  Client reads note  →  { version: 3 }
  Client sends save  →  { version: 3 }
  Server checks      →  body.version == record.version?
                         ✅ YES → save · version becomes 4
                         ✗ NO  → 409 Conflict
  ─────────────────────────────────
  [ Concurrent edit detection ]
  (amber badge chip)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SLIDE 9 — 3-WEEK BUILD TIMELINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Horizontal timeline. 3 large green circle nodes connected by a green line.
Below each node: label + bullets.

  ●────────────────────●────────────────────●
WEEK 1              WEEK 2              WEEK 3
01 – 11 Sep         12 – 20 Sep         21 – 25 Sep
Foundation          UI + SQL Showcase   RBAC + Clinical Workflow

• Docker stack       • All UI pages       • 3-layer RBAC enforced
• 15-table schema    • Live dashboard     • Doctor full workflow
• JWT + bcrypt       • SQL Insights       • Lab tech work queue
• All triggers +     • SOAP optimistic    • 97 ICD-10 codes
  views + indexes      locking            • 36 lab tests
• Simulation engine                       • Blank-start platform

Below timeline, right side — amber pill badge:
  [ Term 2: DICOM Viewer  ·  AI Summaries  ·  Demand Forecasting ]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SLIDE 10 — THANK YOU / DEMO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Full navy background. Green ECG line at bottom (same as slide 1).
Centred layout.

  MediTrack
  [large, white, bold]

  Built on PostgreSQL 16  ·  FastAPI  ·  React 18
  [subtitle, #e2e8f0]

Three info chips in a row:
  [ localhost:5173 ]   [ /docs — Swagger UI ]   [ admin@meditrack.dev ]

Green divider line.

"Term 2 — Coming Next" — 3 items in a row with icons:
  🏥  DICOM Viewer         Medical image upload + in-browser viewer
  🤖  AI Summaries         SOAP summarisation · drug-interaction checker
  📈  Demand Forecasting   Prophet time-series · TimescaleDB vitals

Footer (small, #64748b):
  BITS Pilani WILP  ·  SESAP ZC337  ·  Database Systems & Applications  ·  September 2026
```
