import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  FlaskConical, Clock, Stethoscope, CheckCircle2,
  RefreshCw, Search,
} from "lucide-react";
import { api } from "../lib/api";
import PageHeader from "../components/PageHeader";
import EnterLabResultForm from "../components/EnterLabResultForm";
import { useAuthStore } from "../store/auth";

interface PendingLab {
  investigation_id: string;
  appointment_id: string;
  patient_id: string;
  patient_name: string;
  mrn: string;
  test_id: string;
  test_name: string;
  unit: string | null;
  ref_low: number | null;
  ref_high: number | null;
  ordered_by_name: string | null;
  ordered_at: string;
}

export default function LabQueuePage() {
  const role = useAuthStore((s) => s.role);
  const qc   = useQueryClient();
  const [search, setSearch]       = useState("");
  const [selected, setSelected]   = useState<PendingLab | null>(null);

  const { data: queue = [], isLoading, dataUpdatedAt } = useQuery<PendingLab[]>({
    queryKey: ["lab-pending"],
    queryFn:  async () => (await api.get("/lab/pending")).data,
    refetchInterval: 10_000,
    enabled: role === "LAB_TECHNICIAN" || role === "ADMIN",
  });

  const filtered = queue.filter((item) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      item.patient_name.toLowerCase().includes(q) ||
      item.mrn.toLowerCase().includes(q) ||
      item.test_name.toLowerCase().includes(q) ||
      (item.ordered_by_name ?? "").toLowerCase().includes(q)
    );
  });

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  const updatedLabel = dataUpdatedAt
    ? `Updated ${new Date(dataUpdatedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
    : "";

  return (
    <div>
      <PageHeader
        title="Lab Work Queue"
        subtitle="Pending investigations awaiting results"
        icon={FlaskConical}
        action={
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ["lab-pending"] })}
            className="btn-ghost"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        }
      />

      {/* Stats bar */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-2xl font-extrabold text-navy">{queue.length}</p>
          <p className="mt-0.5 text-xs font-medium text-slate-500">Pending tests</p>
        </div>
        <div className="card p-4">
          <p className="text-2xl font-extrabold text-navy">
            {new Set(queue.map((q) => q.patient_id)).size}
          </p>
          <p className="mt-0.5 text-xs font-medium text-slate-500">Patients waiting</p>
        </div>
        <div className="card hidden p-4 sm:block">
          <p className="text-xs font-semibold text-slate-400">Last refreshed</p>
          <p className="mt-0.5 text-xs font-mono text-slate-600">{updatedLabel}</p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4 relative max-w-md">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className="input pl-10"
          placeholder="Search patient, MRN or test…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Queue table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="card overflow-hidden"
      >
        {isLoading ? (
          <div className="space-y-3 p-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-6 py-4">Patient</th>
                <th className="px-6 py-4">Test</th>
                <th className="px-6 py-4">Ordered by</th>
                <th className="px-6 py-4">Ordered at</th>
                <th className="px-6 py-4">Action</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {filtered.map((item, i) => (
                  <motion.tr
                    key={item.investigation_id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="border-b border-slate-50 transition-colors hover:bg-slate-50"
                  >
                    {/* Patient */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-sky-600 text-xs font-bold text-white">
                          {item.patient_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-navy">{item.patient_name}</p>
                          <p className="font-mono text-xs text-slate-400">{item.mrn}</p>
                        </div>
                      </div>
                    </td>

                    {/* Test */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <FlaskConical className="h-4 w-4 shrink-0 text-cyan-500" />
                        <div>
                          <p className="font-medium text-navy">{item.test_name}</p>
                          {(item.ref_low != null && item.ref_high != null) && (
                            <p className="text-xs text-slate-400">
                              Ref: {item.ref_low}–{item.ref_high} {item.unit ?? ""}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Ordered by */}
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                        <Stethoscope className="h-3.5 w-3.5 text-slate-400" />
                        {item.ordered_by_name ?? "—"}
                      </span>
                    </td>

                    {/* Ordered at */}
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 text-sm text-slate-500">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        {fmtTime(item.ordered_at)}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setSelected(item)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700 transition-colors hover:bg-cyan-600 hover:text-white"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Enter Result
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>

              {filtered.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-slate-400">
                    <FlaskConical className="mx-auto mb-3 h-10 w-10 opacity-30" />
                    <p className="font-medium">
                      {queue.length === 0
                        ? "No pending lab tests — all clear!"
                        : "No results match your search."}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </motion.div>

      {/* Enter result modal */}
      {selected && (
        <EnterLabResultForm
          open={!!selected}
          onClose={() => setSelected(null)}
          investigationId={selected.investigation_id}
          testName={selected.test_name}
          unit={selected.unit}
          refLow={selected.ref_low}
          refHigh={selected.ref_high}
          patientId={selected.patient_id}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["lab-pending"] });
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}
