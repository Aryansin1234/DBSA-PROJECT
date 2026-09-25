import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Sparkles, Trophy, CalendarRange, GitBranch, FlaskConical,
  Gauge, Database, Zap, ChevronRight,
} from "lucide-react";
import {
  Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api } from "../lib/api";
import PageHeader from "../components/PageHeader";

interface RankRow { patient_name: string; mrn: string; visits: number; visit_rank: number; }
interface VolRow { day: string; total: number; completed: number; completion_rate: number; }
interface ChainRow { path: string; depth: number; }
interface LabRow { test_name: string; unit: string | null; value: number | null; flag: string | null; recorded_at: string | null; }
interface PerfRow { query: string; execution_time: string; uses_index: boolean; plan: string; }

const flagColor: Record<string, string> = {
  NORMAL: "text-emerald-600 bg-emerald-50",
  LOW: "text-blue-600 bg-blue-50",
  HIGH: "text-amber-600 bg-amber-50",
  CRITICAL: "text-red-600 bg-red-50",
};

export default function InsightsPage() {
  const [openPlan, setOpenPlan] = useState<string | null>(null);
  // Page is ADMIN-only (enforced by route guard + backend).
  // All panels including performance are available.

  const { data: ranking = [] } = useQuery<RankRow[]>({
    queryKey: ["ins-ranking"],
    queryFn: async () => (await api.get("/insights/patient-ranking")).data,
    refetchInterval: 5000,
  });
  const { data: volume = [] } = useQuery<VolRow[]>({
    queryKey: ["ins-volume"],
    queryFn: async () => (await api.get("/insights/appointment-volume")).data,
    refetchInterval: 5000,
  });
  const { data: chains = [] } = useQuery<ChainRow[]>({
    queryKey: ["ins-chains"],
    queryFn: async () => (await api.get("/insights/referral-chains")).data,
    refetchInterval: 5000,
  });
  const { data: labs = [] } = useQuery<LabRow[]>({
    queryKey: ["ins-labs"],
    queryFn: async () => (await api.get("/insights/latest-lab-per-test")).data,
    refetchInterval: 5000,
  });
  const { data: perf = [] } = useQuery<PerfRow[]>({
    queryKey: ["ins-perf"],
    queryFn: async () => (await api.get("/insights/performance")).data,
  });

  const volumeChart = [...volume].reverse();

  return (
    <div>
      <PageHeader
        title="SQL Insights"
        subtitle="Advanced queries & query-plan analysis on live data"
        icon={Sparkles}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Window function: patient ranking */}
        <Card title="Top Patients by Visits" tag="WINDOW · RANK()" icon={Trophy}>
          <div className="space-y-2">
            {ranking.map((r) => (
              <div key={r.mrn} className="flex items-center gap-3 border-b border-slate-50 py-2 last:border-0">
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
                  r.visit_rank === 1 ? "bg-amber-100 text-amber-700"
                  : r.visit_rank === 2 ? "bg-slate-200 text-slate-600"
                  : r.visit_rank === 3 ? "bg-orange-100 text-orange-700"
                  : "bg-slate-100 text-slate-400"}`}>
                  {r.visit_rank}
                </span>
                <span className="flex-1 truncate text-sm font-medium text-navy">{r.patient_name}</span>
                <span className="font-mono text-xs text-slate-400">{r.mrn}</span>
                <span className="text-sm font-bold text-brand">{r.visits}</span>
              </div>
            ))}
            {ranking.length === 0 && <Empty />}
          </div>
        </Card>

        {/* CTE: appointment volume */}
        <Card title="Daily Volume & Completion" tag="CTE" icon={CalendarRange}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={volumeChart}>
              <XAxis dataKey="day" axisLine={false} tickLine={false} fontSize={11} stroke="#94a3b8" />
              <YAxis axisLine={false} tickLine={false} fontSize={11} stroke="#94a3b8" allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }} />
              <Bar dataKey="total" name="Total" radius={[6, 6, 0, 0]} fill="#cbd5e1" />
              <Bar dataKey="completed" name="Completed" radius={[6, 6, 0, 0]} fill="#2fa27a" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Recursive CTE: referral chains */}
        <Card title="Doctor Referral Chains" tag="RECURSIVE CTE" icon={GitBranch}>
          <div className="space-y-2">
            {chains.map((c, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-navy text-[11px] font-bold text-white">
                  {c.depth}
                </span>
                <span className="flex-1 truncate text-sm font-medium text-navy">{c.path}</span>
              </div>
            ))}
            {chains.length === 0 && <p className="py-6 text-center text-sm text-slate-300">No referral chains yet — the engine is generating them…</p>}
          </div>
        </Card>

        {/* LATERAL: latest lab per test */}
        <Card title="Latest Result per Lab Test" tag="LATERAL JOIN" icon={FlaskConical}>
          <div className="space-y-2">
            {labs.map((l) => (
              <div key={l.test_name} className="flex items-center gap-3 border-b border-slate-50 py-2 last:border-0">
                <span className="flex-1 truncate text-sm font-medium text-navy">{l.test_name}</span>
                <span className="text-sm font-bold text-navy">
                  {l.value ?? "—"}<span className="ml-0.5 text-xs font-normal text-slate-400">{l.unit}</span>
                </span>
                {l.flag && (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${flagColor[l.flag] ?? "bg-slate-100 text-slate-500"}`}>
                    {l.flag}
                  </span>
                )}
              </div>
            ))}
            {labs.length === 0 && <Empty />}
          </div>
        </Card>
      </div>

      {/* Performance report — always visible (admin-only page) */}
      <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card mt-6 p-6"
        >
          <div className="mb-4 flex items-center gap-2">
            <Gauge className="h-4 w-4 text-brand" />
            <h3 className="font-bold text-navy">Query Performance</h3>
            <span className="rounded-full bg-navy-50 px-2 py-0.5 text-[11px] font-semibold text-navy">EXPLAIN ANALYZE</span>
          </div>
          <div className="space-y-3">
            {perf.map((p) => (
              <div key={p.query} className="rounded-xl border border-slate-100">
                <button
                  onClick={() => setOpenPlan(openPlan === p.query ? null : p.query)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <Database className="h-4 w-4 text-slate-400" />
                  <span className="flex-1 font-mono text-sm font-semibold text-navy">{p.query}</span>
                  {p.uses_index && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
                      <Zap className="h-3 w-3" /> index
                    </span>
                  )}
                  <span className="font-mono text-xs text-slate-500">{p.execution_time}</span>
                  <ChevronRight className={`h-4 w-4 text-slate-300 transition-transform ${openPlan === p.query ? "rotate-90" : ""}`} />
                </button>
                {openPlan === p.query && (
                  <pre className="overflow-x-auto border-t border-slate-100 bg-slate-900 px-4 py-3 text-[11px] leading-relaxed text-slate-100">
                    {p.plan}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </motion.div>
    </div>
  );
}

function Card({ title, tag, icon: Icon, children }: { title: string; tag: string; icon: typeof Trophy; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-50 text-navy">
            <Icon className="h-4 w-4" />
          </div>
          <h3 className="font-bold text-navy">{title}</h3>
        </div>
        <span className="rounded-full bg-brand/10 px-2.5 py-1 font-mono text-[10px] font-semibold text-brand-dark">{tag}</span>
      </div>
      {children}
    </motion.div>
  );
}

function Empty() {
  return <p className="py-6 text-center text-sm text-slate-300">No data yet.</p>;
}
