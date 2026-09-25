import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, Play, Pause, Gauge, UserPlus, CalendarPlus, Stethoscope,
  Pill, FlaskConical, RefreshCw, ArrowRightLeft, Radio, Settings2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { api } from "../lib/api";
import { useAuthStore } from "../store/auth";
import { useToast } from "./Toast";

interface SimStatus {
  running: boolean;
  interval: number;
  ticks: number;
  started_at: string | null;
  counters: Record<string, number>;
}
interface SimEvent {
  ts: string;
  type: string;
  message: string;
}

const eventStyle: Record<string, { icon: LucideIcon; color: string; bg: string }> = {
  patient: { icon: UserPlus, color: "text-blue-600", bg: "bg-blue-50" },
  appointment: { icon: CalendarPlus, color: "text-brand", bg: "bg-emerald-50" },
  status: { icon: ArrowRightLeft, color: "text-violet-600", bg: "bg-violet-50" },
  diagnosis: { icon: Stethoscope, color: "text-rose-600", bg: "bg-rose-50" },
  prescription: { icon: Pill, color: "text-amber-600", bg: "bg-amber-50" },
  lab: { icon: FlaskConical, color: "text-cyan-600", bg: "bg-cyan-50" },
  restock: { icon: RefreshCw, color: "text-teal-600", bg: "bg-teal-50" },
  system: { icon: Settings2, color: "text-slate-500", bg: "bg-slate-100" },
};

const SPEEDS = [
  { label: "Slow", value: 5 },
  { label: "Normal", value: 3 },
  { label: "Fast", value: 1.2 },
  { label: "Turbo", value: 0.5 },
];

export default function SimulationPanel() {
  const role = useAuthStore((s) => s.role);
  const isAdmin = role === "ADMIN";
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: status } = useQuery<SimStatus>({
    queryKey: ["sim-status"],
    queryFn: async () => (await api.get("/simulator/status")).data,
    refetchInterval: 2000,
  });
  const { data: events = [] } = useQuery<SimEvent[]>({
    queryKey: ["sim-events"],
    queryFn: async () => (await api.get("/simulator/events", { params: { limit: 14 } })).data,
    refetchInterval: 2000,
  });

  const control = useMutation({
    mutationFn: async (action: { path: string; body?: object }) =>
      (await api.post(`/simulator/${action.path}`, action.body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sim-status"] }),
    onError: () => toast("Simulation control failed", "error"),
  });

  const running = status?.running ?? false;

  const toggle = () => {
    if (running) {
      control.mutate({ path: "stop" });
      toast("Simulation paused", "info");
    } else {
      control.mutate({ path: "start" });
      toast("Simulation started", "success");
    }
  };

  const setSpeed = (value: number) => {
    control.mutate({ path: "config", body: { interval: value } });
    toast(`Speed set to ${value}s / tick`, "info");
  };

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Live activity feed */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="card p-6 lg:col-span-2"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-brand" />
            <h3 className="font-bold text-navy">Live Activity</h3>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
              running ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"
            }`}
          >
            <span className="relative flex h-2 w-2">
              {running && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              )}
              <span className={`relative inline-flex h-2 w-2 rounded-full ${running ? "bg-emerald-500" : "bg-slate-400"}`} />
            </span>
            {running ? "LIVE" : "PAUSED"}
          </span>
        </div>

        <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {events.map((e) => {
              const s = eventStyle[e.type] ?? eventStyle.system;
              const Icon = s.icon;
              return (
                <motion.div
                  key={`${e.ts}-${e.message}`}
                  layout
                  initial={{ opacity: 0, x: -20, height: 0 }}
                  animate={{ opacity: 1, x: 0, height: "auto" }}
                  exit={{ opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 26 }}
                  className="flex items-center gap-3 rounded-xl border border-slate-50 bg-white px-3 py-2.5"
                >
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${s.bg} ${s.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="flex-1 truncate text-sm text-navy">{e.message}</p>
                  <span className="shrink-0 font-mono text-[11px] text-slate-400">{fmtTime(e.ts)}</span>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {events.length === 0 && (
            <p className="py-10 text-center text-sm text-slate-300">Waiting for activity…</p>
          )}
        </div>
      </motion.div>

      {/* Engine control */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55 }}
        className="card flex flex-col p-6"
      >
        <div className="mb-4 flex items-center gap-2">
          <Radio className="h-4 w-4 text-brand" />
          <h3 className="font-bold text-navy">Simulation Engine</h3>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <Stat label="Ticks" value={status?.ticks ?? 0} />
          <Stat label="Tick rate" value={`${status?.interval ?? "—"}s`} />
        </div>

        {/* Counters — admin only */}
        {isAdmin && (
          <div className="mb-5 space-y-1.5">
            {[
              ["patients", "Patients"],
              ["appointments", "Appointments"],
              ["status_changes", "Status changes"],
              ["diagnoses", "Diagnoses"],
              ["prescriptions", "Prescriptions"],
              ["labs", "Lab events"],
            ].map(([key, label]) => (
              <div key={key} className="flex items-center justify-between text-xs">
                <span className="text-slate-500">{label} generated</span>
                <span className="font-semibold text-navy">{status?.counters?.[key] ?? 0}</span>
              </div>
            ))}
          </div>
        )}

        {isAdmin ? (
          <div className="mt-auto space-y-3">
            <button
              onClick={toggle}
              disabled={control.isPending}
              className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all active:scale-[0.98] ${
                running ? "bg-red-500 hover:bg-red-600" : "bg-brand hover:bg-brand-dark"
              }`}
            >
              {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {running ? "Pause engine" : "Start engine"}
            </button>
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <Gauge className="h-3.5 w-3.5" /> Speed
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {SPEEDS.map((sp) => {
                  const active = status?.interval === sp.value;
                  return (
                    <button
                      key={sp.value}
                      onClick={() => setSpeed(sp.value)}
                      className={`rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ${
                        active ? "bg-navy text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}
                    >
                      {sp.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-auto rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-400">
            Engine controls are available to administrators.
          </p>
        )}
      </motion.div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-center">
      <p className="text-lg font-extrabold text-navy">{value}</p>
      <p className="text-[11px] font-medium text-slate-400">{label}</p>
    </div>
  );
}
