# MediTrack — System Documentation

> **Project:** Smart Patient & Clinical Record Management System
> **Course:** SESAP ZC337 Database Systems and Applications — BITS Pilani WILP
> **Stack:** PostgreSQL 16 · FastAPI · React 18 + TypeScript · Docker
> **Last updated:** 25 September 2026 · v1.4.0

This folder is the **single source of truth** for how MediTrack works.

| # | Document | What it covers |
|---|---|---|
| 1 | [`01-overview.md`](./01-overview.md) | What the project is, who uses it, the domain |
| 2 | [`02-architecture.md`](./02-architecture.md) | System design, data flow, how a request travels |
| 3 | [`03-data-model.md`](./03-data-model.md) | Tables, relationships, ER diagram |
| 4 | [`04-roles-and-access.md`](./04-roles-and-access.md) | The 5 roles and exact permissions per action |
| 5 | [`05-api-reference.md`](./05-api-reference.md) | Every REST endpoint with examples |
| 6 | [`06-frontend-guide.md`](./06-frontend-guide.md) | Pages, components, state, styling |
| 7 | [`07-setup-and-run.md`](./07-setup-and-run.md) | How to install, run, and reset |
| 8 | [`08-roadmap-enhancements.md`](./08-roadmap-enhancements.md) | Term 2 roadmap (DICOM, AI, Forecasting) |
| 9 | [`09-simulation-engine.md`](./09-simulation-engine.md) | The live hospital data engine |
| 10 | [`10-project-status.md`](./10-project-status.md) | ✅ What's built vs. what's Term 2 |
| 11 | [`11-database-layer.md`](./11-database-layer.md) | Triggers, views, indexes, advanced SQL |

---

## 30-Second Summary

MediTrack digitises the full patient-care lifecycle:

```
Register patient → Book appointment → Diagnose (ICD-10) → Prescribe (ACID)
  → Order lab tests → Enter results (auto-flagged) → SOAP clinical note
                          → Everything audited by PostgreSQL triggers
```

- **Backend** — FastAPI REST API, SQLAlchemy ORM, PostgreSQL 16
- **Frontend** — React 18 + TypeScript, TanStack Query, Recharts, Framer Motion
- **Auth** — JWT (access 15 min / refresh 7 days), bcrypt rounds=12, 5 roles
- **Data integrity** — enforced in the database (constraints, triggers, transactions)
- **No seed data** — the platform starts blank. A live **simulation engine** generates
  realistic hospital activity on demand — see [`09-simulation-engine.md`](./09-simulation-engine.md)

👉 Live progress checklist: [`10-project-status.md`](./10-project-status.md)
