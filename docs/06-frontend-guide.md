# 06 · Frontend Guide

## Tech Stack

| Concern | Library | Version |
|---|---|---|
| Framework | React + TypeScript | 18 |
| Build tool | Vite | 5 |
| Styling | Tailwind CSS (custom navy/brand theme) | 3 |
| Animation | Framer Motion + GSAP | latest |
| Icons | Lucide React | latest |
| Data fetching | TanStack Query (React Query) | v5 |
| Global state | Zustand + persist middleware | 4 |
| HTTP | Axios (JWT interceptor + auto-refresh) | 1 |
| Routing | React Router v6 | 6 |
| Charts | Recharts | 2 |

---

## Folder Structure

```
frontend/src/
├── main.tsx                   app bootstrap (Query + Router + Toast providers)
├── App.tsx                   routes, ProtectedRoute, RoleRoute guards
├── index.css                 Tailwind layers + .card .btn-primary .input classes
├── lib/
│   ├── api.ts                Axios instance + JWT request/response interceptors
│   ├── cn.ts                 className merge helper
│   └── roles.ts              ROLE_META, NAV_ITEMS, navForRole(), RoleMeta types
├── store/
│   └── auth.ts               Zustand auth store (accessToken, role, user — persisted)
├── components/
│   ├── Layout.tsx            sticky sidebar + main Outlet (role-aware nav)
│   ├── PageHeader.tsx        page title + optional action button
│   ├── Modal.tsx             reusable animated modal shell (Framer Motion spring)
│   ├── Toast.tsx             toast context + useToast() hook (auto-dismiss 4s)
│   ├── StatusBadge.tsx       read-only coloured appointment status pill
│   ├── AppointmentStatusControl.tsx  interactive status change (portal dropdown)
│   ├── SearchSelect.tsx      searchable combobox with onQueryChange support
│   ├── SimulationPanel.tsx   live activity feed + engine controls (admin only)
│   ├── BookAppointmentForm.tsx  book appointment modal (conflict-aware)
│   ├── RegisterPatientForm.tsx  register patient modal
│   ├── SoapEditor.tsx        SOAP note modal with optimistic locking
│   ├── AddDiagnosisForm.tsx  ICD-10 server search + severity grid + notes
│   ├── AddPrescriptionForm.tsx  searchable medicine picker + dosage/freq/days
│   ├── OrderLabForm.tsx      searchable + grouped lab test picker
│   └── EnterLabResultForm.tsx  numeric entry + live flag preview
└── pages/
    ├── LoginPage.tsx          split hero (GSAP) + form (Framer Motion)
    ├── DashboardPage.tsx     role-aware KPIs + charts + role-specific widgets
    ├── PatientListPage.tsx   search, filters, stat cards, clickable rows
    ├── PatientDetailPage.tsx 360° clinical view + all action modals
    ├── AppointmentPage.tsx   stat cards + table + status change + row navigation
    ├── LabQueuePage.tsx      lab tech work queue (pending tests, search, enter result)
    ├── InsightsPage.tsx      4 SQL demos + EXPLAIN ANALYZE (Admin only)
    └── AuditLogPage.tsx      DB change history (Admin only)
```

---

## Routing & Guards

```tsx
// App.tsx
<Route path="/login" element={<LoginPage />} />
<Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
  <Route index element={<DashboardPage />} />
  <Route path="patients" element={<PatientListPage />} />
  <Route path="patients/:id" element={<PatientDetailPage />} />
  <Route path="appointments"
    element={<RoleRoute roles={["ADMIN","DOCTOR","NURSE","RECEPTIONIST"]}><AppointmentPage /></RoleRoute>} />
  <Route path="lab-queue"
    element={<RoleRoute roles={["LAB_TECHNICIAN","ADMIN"]}><LabQueuePage /></RoleRoute>} />
  <Route path="insights"
    element={<RoleRoute roles={["ADMIN"]}><InsightsPage /></RoleRoute>} />
  <Route path="audit"
    element={<RoleRoute roles={["ADMIN"]}><AuditLogPage /></RoleRoute>} />
</Route>
```

- `ProtectedRoute` — redirects to `/login` if no `accessToken` in Zustand.
- `RoleRoute` — redirects to `/` if the user's role is not in the allowed list.
- Both are **UX guards only** — backend enforces the real rules.

---

## Auth State (Zustand)

`store/auth.ts` persists `accessToken`, `refreshToken`, `role`, and `user`
to `localStorage` (key: `meditrack-auth`) so a page refresh keeps you logged in.

```ts
const { accessToken, role, user, setTokens, setUser, logout } = useAuthStore();
```

---

## JWT Auto-Refresh (`lib/api.ts`)

```
Request → 401
  if (!_retry && refreshToken && !refreshing):
    refreshing = true
    POST /auth/refresh → new tokens → setTokens()
    retry original request
  else:
    logout() → redirect to /login
```

The `refreshing` boolean flag prevents concurrent refresh loops.

---

## Role-Aware Navigation

`lib/roles.ts` defines `NAV_ITEMS` with `roles: Role[] | "all"` per item:

| Nav item | Visible to |
|---|---|
| Dashboard | All |
| Patients | All |
| Appointments | Admin, Doctor, Nurse, Receptionist |
| Lab Queue | Lab Technician, Admin |
| SQL Insights | Admin only |
| Audit Log | Admin only |

`navForRole(role)` filters this list — the sidebar renders only permitted items.

---

## Pages

### LoginPage
- GSAP context: infinite yoyo animation on 3 orb blobs, staggered hero stat cards.
- Framer Motion: form slides in from below.
- 5 quick-role buttons auto-fill credentials on click.

### DashboardPage
Role-specific experience:
- **Admin** — all-hospital KPIs, charts, simulation panel (start/stop/speed)
- **Doctor** — "My Patients / My Appointments / My Scheduled / My Prescriptions" KPIs, own top diagnoses
- **Nurse** — all-hospital KPIs, appointments quick access
- **Lab Technician** — pending test queue widget (notification cards, pending badge, click→patient detail)
- **Receptionist** — KPIs, register patient + book appointment quick actions

All analytics refetch every 3 seconds.

### PatientListPage
- Fetches up to 200 patients once; search/gender/blood filters are client-side.
- Doctor role: only own patients shown (backend scoped).
- Clicking a row navigates to `/patients/:id` — only if `canViewDetail` (not Receptionist).
- "Register Patient" button shown to Admin and Receptionist only.

### PatientDetailPage
Fetches `GET /patients/{id}/detail`. Role-gated sections:

| Section | Visible to |
|---|---|
| Header + Book Appointment button | Admin, Doctor, Receptionist |
| Appointments list | All (who can access the page) |
| SOAP "Note" button on appointment | Doctor, Admin |
| "Dx" (diagnose) button | Doctor, Admin |
| "Rx" (prescribe) button | Doctor, Admin |
| "Lab" (order test) button | Doctor, Admin |
| Diagnoses section | Doctor, Admin, Nurse |
| Prescriptions section | Doctor, Admin, Nurse |
| Lab Investigations section | Doctor, Admin, Nurse, Lab Technician |
| "Enter" result button on pending labs | Lab Technician, Admin |

### AppointmentPage
- 6 stat cards (Total, Scheduled, In Progress, Completed, Cancelled, No Show)
- Each row shows: Patient name, Doctor name, Date+Time, Status (interactive), Reason
- Clicking a row navigates to the patient's detail page (except Receptionist)
- Status cell has `e.stopPropagation()` so clicking it doesn't navigate

### AppointmentStatusControl
Portal-rendered dropdown (renders on `document.body` to escape table `overflow-hidden`).
- Position calculated with `getBoundingClientRect()` at open time
- Closes on outside click or scroll
- Shows only valid next states for the current user's role

### LabQueuePage
- Fetches `GET /lab/pending` (enriched with patient/test/doctor info)
- Search across patient name, MRN, test name, ordering doctor
- Stats bar: pending count, unique patients waiting, last refresh time
- "Enter Result" button → `EnterLabResultForm` modal
- Auto-refreshes every 10 seconds

### Clinical Action Forms

| Form | Trigger | What it does |
|---|---|---|
| `AddDiagnosisForm` | "Dx" button on appointment row | Debounced ICD-10 server search, selected code card, severity grid (4 cards with clinical descriptions), notes with char count |
| `AddPrescriptionForm` | "Rx" button on appointment row | Per-item `MedicinePicker` (search + category browse), stock badges, full frequency labels |
| `OrderLabForm` | "Lab" button on appointment row | Search + ChevronDown browse-toggle, 8 test categories with sticky headers, reference range preview |
| `EnterLabResultForm` | "Enter" on pending lab (patient detail or lab queue) | Numeric entry, live flag preview before save, reference range shown |
| `SoapEditor` | "Note" button on appointment row | SOAP fields, current version shown, 409 handled gracefully |
| `BookAppointmentForm` | "Book Appointment" / header button | Doctor pre-filled+locked for DOCTOR role; `?all=true` fetches all patients for booking |
| `RegisterPatientForm` | "Register Patient" button | All demographics, MRN shown in success toast |

---

## Design System

Defined in `tailwind.config.js` + `index.css`:

| Token | Value | Used for |
|---|---|---|
| `navy` | `#0f2c4c` (+ 50/700/800/900 shades) | Sidebar, headings, primary text |
| `brand` | `#2fa27a` | Accents, success CTAs, active states |
| `brand-dark` | `#1e7a5a` | Hover states |
| `brand-light` | `#5dcea8` | Icon highlights on dark backgrounds |
| `.card` | white bg, shadow-soft, rounded-2xl | All content panels |
| `.btn-primary` | brand gradient, white text | Primary actions |
| `.btn-ghost` | transparent, slate text | Secondary/cancel actions |
| `.input` | white border, focus ring-brand | All form inputs |
| `.nav-link` | sidebar navigation items | Active = navy bg |

Font: **Inter**. Icons: **Lucide React** exclusively (no emoji in UI).

---

## Data Fetching Patterns

```tsx
// Read — auto-caches, background refetch
const { data, isLoading } = useQuery({
  queryKey: ["patients", "all"],
  queryFn: async () => (await api.get("/patients", { params: { limit: 200 } })).data,
});

// Write — invalidates related queries on success
const mutation = useMutation({
  mutationFn: () => api.post("/diagnoses", payload),
  onSuccess: () => {
    toast("Diagnosis added", "success");
    qc.invalidateQueries({ queryKey: ["patient-detail", patientId] });
    onClose();
  },
  onError: (e) => toast(e.response?.data?.detail ?? "Failed", "error"),
});
```
