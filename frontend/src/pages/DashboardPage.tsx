import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Users,
  CalendarClock,
  CalendarCheck,
  Pill,
  TrendingUp,
  Sparkles,
  Activity,
  Stethoscope,
  UserPlus,
  CalendarPlus,
  FlaskConical,
  ScrollText,
  ArrowRight,
  CheckCircle2,
  Clock,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../lib/api";
import SimulationPanel from "../components/SimulationPanel";
import { useAuthStore } from "../store/auth";
import { roleMeta } from "../lib/roles";
interface Kpis {
  total_patients: number;
  total_appointments: number;
  scheduled_appointments: number;
  active_prescriptions: number;
}
interface TrendPoint {
  day: string;
  count: number;
}
interface StatusSlice {
  status: string;
  count: number;
}
interface TopDiagnosis {
  icd10_code: string;
  description: string;
  count: number;
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const item = { hidden: { y: 20, opacity: 0 }, show: { y: 0, opacity: 1 } };

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: "#3b82f6",
  IN_PROGRESS: "#f59e0b",
  COMPLETED: "#2fa27a",
  CANCELLED: "#ef4444",
  NO_SHOW: "#94a3b8",
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const { role, user } = useAuthStore();
  const meta = roleMeta(role);
  const RoleIcon = meta.icon;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();
  const firstName = user?.name?.split(" ")[0] ?? meta.short;

  const { data: kpi, isLoading } = useQuery<Kpis>({
    queryKey: ["kpis"],
    queryFn: async () => (await api.get("/analytics/kpis")).data,
    refetchInterval: 3000,
  });
  const { data: trend = [] } = useQuery<TrendPoint[]>({
    queryKey: ["weekly-trend"],
    queryFn: async () => (await api.get("/analytics/appointments/weekly-trend")).data,
    refetchInterval: 3000,
  });
  const { data: statuses = [] } = useQuery<StatusSlice[]>({
    queryKey: ["status-breakdown"],
    queryFn: async () =>
      (await api.get("/analytics/appointments/status-breakdown")).data,
    refetchInterval: 3000,
  });
  const { data: topDx = [] } = useQuery<TopDiagnosis[]>({
    queryKey: ["top-diagnoses"],
    queryFn: async () => (await api.get("/analytics/diagnoses/top")).data,
    refetchInterval: 3000,
  });

  // Role-specific quick actions shown as buttons in the hero.
  const QUICK_ACTIONS: Record<
    string,
    { label: string; icon: typeof UserPlus; to: string }[]
  > = {
    ADMIN: [
      { label: "Register Patient", icon: UserPlus, to: "/patients" },
      { label: "Book Appointment", icon: CalendarPlus, to: "/appointments" },
      { label: "SQL Insights", icon: Sparkles, to: "/insights" },
      { label: "Audit Log", icon: ScrollText, to: "/audit" },
    ],
    DOCTOR: [
      { label: "My Patients", icon: Users, to: "/patients" },
      { label: "My Appointments", icon: CalendarPlus, to: "/appointments" },
    ],
    NURSE: [
      { label: "View Patients", icon: Users, to: "/patients" },
      { label: "Appointments", icon: CalendarPlus, to: "/appointments" },
    ],
    LAB_TECHNICIAN: [
      { label: "Patient Records", icon: FlaskConical, to: "/patients" },
    ],
    RECEPTIONIST: [
      { label: "Register Patient", icon: UserPlus, to: "/patients" },
      { label: "Book Appointment", icon: CalendarPlus, to: "/appointments" },
    ],
  };
  const actions = QUICK_ACTIONS[role ?? "ADMIN"] ?? QUICK_ACTIONS.ADMIN;

  const isDoctor = role === "DOCTOR";

  const cards = [
    {
      label: isDoctor ? "My Patients" : "Total Patients",
      value: kpi?.total_patients ?? 0,
      icon: Users,
      grad: "from-blue-500 to-blue-600",
    },
    {
      label: isDoctor ? "My Scheduled" : "Scheduled Appointments",
      value: kpi?.scheduled_appointments ?? 0,
      icon: CalendarClock,
      grad: "from-brand to-brand-dark",
    },
    {
      label: isDoctor ? "My Appointments" : "Total Appointments",
      value: kpi?.total_appointments ?? 0,
      icon: CalendarCheck,
      grad: "from-violet-500 to-purple-600",
    },
    {
      label: isDoctor ? "My Prescriptions" : "Active Prescriptions",
      value: kpi?.active_prescriptions ?? 0,
      icon: Pill,
      grad: "from-amber-500 to-orange-600",
    },
  ];

  const maxDx = Math.max(1, ...topDx.map((d) => d.count));

  return (
    <div>
      {/* Role-aware hero */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="card relative mb-6 overflow-hidden bg-gradient-to-br from-navy-800 via-navy-700 to-navy-900 p-6 text-white"
      >
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand/20 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${meta.gradient} shadow-glow`}
            >
              <RoleIcon className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold leading-tight">
                  {greeting}, {firstName}
                </h1>
                <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold">
                  {meta.label}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-slate-300">{meta.tagline}</p>
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex flex-wrap gap-2">
            {actions.map((a) => (
              <button
                key={a.label}
                onClick={() => navigate(a.to)}
                className="group inline-flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-2 text-sm font-semibold transition-all hover:bg-white/20"
              >
                <a.icon className="h-4 w-4 text-brand-light" />
                {a.label}
                <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* KPI cards */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4"
      >
        {cards.map((c) => (
          <motion.div
            key={c.label}
            variants={item}
            whileHover={{ y: -4, scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300 }}
            className="card group relative overflow-hidden p-6"
          >
            <div
              className={`absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${c.grad} opacity-10 transition-opacity group-hover:opacity-20`}
            />
            <div
              className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${c.grad} text-white shadow-soft`}
            >
              <c.icon className="h-6 w-6" />
            </div>
            <p className="text-3xl font-extrabold text-navy">
              {isLoading ? (
                <span className="inline-block h-8 w-16 animate-pulse rounded bg-slate-200" />
              ) : (
                c.value
              )}
            </p>
            <p className="mt-1 text-sm font-medium text-slate-500">{c.label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Row 1: trend + status donut */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="card p-6 lg:col-span-2"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-navy">Appointment Activity</h3>
              <p className="text-sm text-slate-500">Last 7 days</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
              <TrendingUp className="h-3.5 w-3.5" /> Live data
            </span>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2fa27a" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#2fa27a" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" axisLine={false} tickLine={false} fontSize={12} stroke="#94a3b8" />
              <YAxis axisLine={false} tickLine={false} fontSize={12} stroke="#94a3b8" allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 8px 30px rgba(15,44,76,0.08)",
                }}
              />
              <Area
                type="monotone"
                dataKey="count"
                name="Appointments"
                stroke="#2fa27a"
                strokeWidth={3}
                fill="url(#fill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Status donut */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="card p-6"
        >
          <div className="mb-2 flex items-center gap-2">
            <Activity className="h-4 w-4 text-brand" />
            <h3 className="font-bold text-navy">Appointment Status</h3>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={statuses}
                dataKey="count"
                nameKey="status"
                innerRadius={45}
                outerRadius={70}
                paddingAngle={3}
              >
                {statuses.map((s) => (
                  <Cell key={s.status} fill={STATUS_COLORS[s.status] ?? "#cbd5e1"} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 space-y-1.5">
            {statuses.map((s) => (
              <div key={s.status} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-slate-600">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: STATUS_COLORS[s.status] ?? "#cbd5e1" }}
                  />
                  {s.status.replace("_", " ")}
                </span>
                <span className="font-semibold text-navy">{s.count}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Row 2: top diagnoses + Term 2 roadmap — hidden for lab tech */}
      {role !== "LAB_TECHNICIAN" && (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="card p-6 lg:col-span-2"
          >
            <div className="mb-4 flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-brand" />
              <h3 className="font-bold text-navy">Top Diagnoses</h3>
            </div>
            {topDx.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">
                No diagnoses recorded yet.
              </p>
            ) : (
              <div className="space-y-4">
                {topDx.map((d, i) => (
                  <div key={d.icd10_code}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-slate-700">
                        <span className="rounded-md bg-navy-50 px-2 py-0.5 font-mono text-xs font-semibold text-navy">
                          {d.icd10_code}
                        </span>
                        <span className="truncate">{d.description}</span>
                      </span>
                      <span className="font-semibold text-navy">{d.count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(d.count / maxDx) * 100}%` }}
                        transition={{ delay: 0.5 + i * 0.1, duration: 0.6 }}
                        className="h-full rounded-full bg-gradient-to-r from-brand to-brand-dark"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="card relative overflow-hidden bg-gradient-to-br from-navy-800 to-navy-900 p-6 text-white"
          >
            <Sparkles className="mb-3 h-7 w-7 text-brand-light" />
            <h3 className="text-lg font-bold">Coming in Term 2</h3>
            <p className="mt-2 text-sm text-slate-300">
              Multimodal imaging (DICOM), time-series vitals, and AI-assisted
              diagnosis, summarisation & forecasting.
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {["DICOM Viewer", "AI Summaries", "Demand Forecasting"].map((f) => (
                <li key={f} className="flex items-center gap-2 text-slate-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-light" />
                  {f}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      )}

      {/* Lab tech: pending tests queue widget */}
      {role === "LAB_TECHNICIAN" && <LabQueueWidget />}

      {/* Live simulation: activity feed + engine controls — admin only */}
      {role === "ADMIN" && <SimulationPanel />}
    </div>
  );
}

// ── Lab Queue Widget (dashboard card for LAB_TECHNICIAN) ─────────────────────
interface PendingLab {
  investigation_id: string;
  patient_id: string;
  patient_name: string;
  mrn: string;
  test_name: string;
  unit: string | null;
  ordered_by_name: string | null;
  ordered_at: string;
}

function LabQueueWidget() {
  const navigate = useNavigate();

  const { data: queue = [], isLoading } = useQuery<PendingLab[]>({
    queryKey: ["lab-pending"],
    queryFn:  async () => (await api.get("/lab/pending")).data,
    refetchInterval: 10_000,
  });

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      day: "2-digit", month: "short",
      hour: "2-digit", minute: "2-digit",
    });

  const preview = queue.slice(0, 6);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="mt-6 card p-6"
    >
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-sky-600 text-white shadow-soft">
            <FlaskConical className="h-5 w-5" />
            {queue.length > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow">
                {queue.length > 99 ? "99+" : queue.length}
              </span>
            )}
          </div>
          <div>
            <h3 className="font-bold text-navy">Pending Lab Tests</h3>
            <p className="text-xs text-slate-400">
              {queue.length === 0 ? "All clear — no pending tests" : `${queue.length} test${queue.length > 1 ? "s" : ""} awaiting results`}
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate("/lab-queue")}
          className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-50 px-3.5 py-2 text-sm font-semibold text-cyan-700 transition-colors hover:bg-cyan-600 hover:text-white"
        >
          View all <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Notification list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : queue.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-slate-300">
          <CheckCircle2 className="mb-2 h-10 w-10" />
          <p className="text-sm font-medium">No pending tests</p>
        </div>
      ) : (
        <div className="space-y-2">
          {preview.map((item, i) => (
            <motion.button
              key={item.investigation_id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => navigate(`/patients/${item.patient_id}`)}
              className="group flex w-full items-center gap-4 rounded-xl border border-slate-100 bg-white px-4 py-3 text-left transition-all hover:border-cyan-200 hover:bg-cyan-50/40 hover:shadow-sm"
            >
              {/* Avatar */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-sky-500 text-xs font-bold text-white">
                {item.patient_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-navy truncate">{item.patient_name}</span>
                  <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
                    {item.mrn}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <FlaskConical className="h-3 w-3 text-cyan-500" />
                    {item.test_name}
                  </span>
                  {item.ordered_by_name && (
                    <span className="inline-flex items-center gap-1">
                      <Stethoscope className="h-3 w-3 text-slate-400" />
                      {item.ordered_by_name}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3 text-slate-400" />
                    {fmtTime(item.ordered_at)}
                  </span>
                </div>
              </div>

              {/* Notification dot + arrow */}
              <div className="flex shrink-0 items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-amber-400">
                  <span className="h-2 w-2 animate-ping rounded-full bg-amber-400 opacity-75" />
                </span>
                <ArrowRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-cyan-600" />
              </div>
            </motion.button>
          ))}

          {queue.length > 6 && (
            <button
              onClick={() => navigate("/lab-queue")}
              className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-200 py-2.5 text-sm font-semibold text-slate-400 transition-colors hover:border-cyan-300 hover:text-cyan-600"
            >
              +{queue.length - 6} more — view full queue
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}
