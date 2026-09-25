/**
 * AddDiagnosisForm — Doctor/Admin adds a diagnosis to a specific appointment.
 *
 * UI highlights:
 *  - Real-time ICD-10 server search as you type (debounced 300ms)
 *  - Selected code shown as a prominent "code card" so the doctor can confirm
 *  - Severity picker with colour-coded pills and descriptive sub-labels
 *  - Notes textarea with character count
 *  - Keyboard-friendly: search opens on focus, Escape closes
 */
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Stethoscope, Loader2, Search, X, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { AxiosError } from "axios";
import { api } from "../lib/api";
import { useToast } from "./Toast";
import Modal from "./Modal";
import { cn } from "../lib/cn";

interface Props {
  open: boolean;
  onClose: () => void;
  appointmentId: string;
  patientId: string;
}

interface ICD10Option {
  icd10_code: string;
  description: string;
}

const SEVERITIES: {
  value: string;
  label: string;
  sub: string;
  active: string;
  dot: string;
}[] = [
  {
    value: "MILD",
    label: "Mild",
    sub: "Minor symptoms, no significant impairment",
    active: "bg-emerald-50 ring-emerald-400 text-emerald-800",
    dot: "bg-emerald-500",
  },
  {
    value: "MODERATE",
    label: "Moderate",
    sub: "Noticeable symptoms, some daily impact",
    active: "bg-amber-50 ring-amber-400 text-amber-800",
    dot: "bg-amber-500",
  },
  {
    value: "SEVERE",
    label: "Severe",
    sub: "Significant symptoms, major functional impact",
    active: "bg-orange-50 ring-orange-400 text-orange-800",
    dot: "bg-orange-500",
  },
  {
    value: "CRITICAL",
    label: "Critical",
    sub: "Life-threatening or immediate hospitalisation",
    active: "bg-red-50 ring-red-400 text-red-800",
    dot: "bg-red-500",
  },
];

const MAX_NOTES = 500;

export default function AddDiagnosisForm({ open, onClose, appointmentId, patientId }: Props) {
  const [query,    setQuery]    = useState("");
  const [results,  setResults]  = useState<ICD10Option[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDrop, setShowDrop] = useState(false);
  const [selected, setSelected] = useState<ICD10Option | null>(null);
  const [severity, setSeverity] = useState("MILD");
  const [notes,    setNotes]    = useState("");
  const inputRef   = useRef<HTMLInputElement>(null);
  const dropRef    = useRef<HTMLDivElement>(null);
  const timerRef   = useRef<ReturnType<typeof setTimeout>>();
  const { toast }  = useToast();
  const qc         = useQueryClient();

  // Debounced ICD-10 search
  useEffect(() => {
    clearTimeout(timerRef.current);
    if (query.length < 2) { setResults([]); setShowDrop(false); return; }
    setSearching(true);
    timerRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get("/icd10/search", { params: { q: query } });
        setResults(data);
        setShowDrop(true);
      } catch { /* ignore */ }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node) &&
          inputRef.current !== e.target) {
        setShowDrop(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setQuery(""); setResults([]); setSelected(null);
      setSeverity("MILD"); setNotes(""); setShowDrop(false);
    }
  }, [open]);

  const pick = (opt: ICD10Option) => {
    setSelected(opt);
    setQuery("");
    setResults([]);
    setShowDrop(false);
  };

  const clear = () => {
    setSelected(null);
    setQuery("");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const mutation = useMutation({
    mutationFn: () =>
      api.post("/diagnoses", {
        appointment_id: appointmentId,
        icd10_code: selected!.icd10_code,
        severity,
        notes: notes.trim() || null,
      }),
    onSuccess: () => {
      toast("Diagnosis added", "success");
      qc.invalidateQueries({ queryKey: ["patient-detail", patientId] });
      onClose();
    },
    onError: (e: AxiosError<{ detail?: string }>) =>
      toast(e.response?.data?.detail ?? "Failed to add diagnosis", "error"),
  });

  const canSubmit = !!selected && !mutation.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Diagnosis"
      subtitle="Search ICD-10, set severity & add clinical notes"
      icon={Stethoscope}
    >
      <form
        onSubmit={(e) => { e.preventDefault(); if (canSubmit) mutation.mutate(); }}
        className="space-y-5"
      >

        {/* ── ICD-10 search ─────────────────────────────────────────────── */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
            ICD-10 Diagnosis <span className="text-red-400">*</span>
          </label>

          {selected ? (
            /* Selected code card */
            <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-emerald-100 px-2 py-0.5 font-mono text-xs font-bold text-emerald-800">
                    {selected.icd10_code}
                  </span>
                  <span className="text-sm font-semibold text-emerald-900 leading-tight">
                    {selected.description}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={clear}
                className="shrink-0 rounded-lg p-1 text-emerald-500 hover:bg-emerald-100 hover:text-emerald-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            /* Search input + dropdown */
            <div className="relative">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                {searching && (
                  <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                )}
                <input
                  ref={inputRef}
                  type="text"
                  className="input pl-10 pr-10"
                  placeholder="Search by condition name or ICD-10 code…"
                  value={query}
                  autoComplete="off"
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => results.length > 0 && setShowDrop(true)}
                  onKeyDown={(e) => e.key === "Escape" && setShowDrop(false)}
                />
              </div>

              {showDrop && results.length > 0 && (
                <div
                  ref={dropRef}
                  className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl"
                >
                  {results.map((r) => (
                    <button
                      key={r.icd10_code}
                      type="button"
                      onClick={() => pick(r)}
                      className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                    >
                      <span className="mt-0.5 shrink-0 rounded-md bg-navy-50 px-2 py-0.5 font-mono text-[11px] font-bold text-navy">
                        {r.icd10_code}
                      </span>
                      <span className="text-sm text-slate-700 leading-snug">{r.description}</span>
                    </button>
                  ))}
                </div>
              )}

              {showDrop && results.length === 0 && query.length >= 2 && !searching && (
                <div className="absolute z-50 mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-6 text-center shadow-xl">
                  <p className="text-sm text-slate-400">No ICD-10 codes match "<strong>{query}</strong>"</p>
                  <p className="mt-1 text-xs text-slate-300">Try a different keyword or the exact code</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Severity ──────────────────────────────────────────────────── */}
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Severity
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SEVERITIES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setSeverity(s.value)}
                className={cn(
                  "flex flex-col items-start rounded-xl p-3 text-left ring-1 transition-all",
                  severity === s.value
                    ? s.active + " ring-2"
                    : "bg-white ring-slate-200 hover:bg-slate-50",
                )}
              >
                <span className={cn("mb-1.5 h-2.5 w-2.5 rounded-full", s.dot)} />
                <span className="text-xs font-bold">{s.label}</span>
                <span className={cn(
                  "mt-0.5 text-[10px] leading-tight",
                  severity === s.value ? "opacity-80" : "text-slate-400",
                )}>
                  {s.sub}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Clinical notes ────────────────────────────────────────────── */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Clinical Notes
            </label>
            <span className={cn(
              "text-xs",
              notes.length > MAX_NOTES * 0.9 ? "text-red-400" : "text-slate-300",
            )}>
              {notes.length}/{MAX_NOTES}
            </span>
          </div>
          <textarea
            className="input min-h-[80px] resize-none leading-relaxed"
            placeholder="Observations, relevant history, examination findings…"
            maxLength={MAX_NOTES}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        {!selected && (
          <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Search and select an ICD-10 code before saving.
          </div>
        )}

        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="btn-primary disabled:opacity-50"
          >
            {mutation.isPending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Stethoscope className="h-4 w-4" />
            }
            Save Diagnosis
          </button>
        </div>
      </form>
    </Modal>
  );
}
