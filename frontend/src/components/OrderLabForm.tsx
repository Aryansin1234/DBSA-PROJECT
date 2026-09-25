/**
 * OrderLabForm — Doctor/Admin orders a lab investigation for an appointment.
 * Searchable list with category grouping + reference range preview.
 */
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FlaskConical, Loader2, Search, X, CheckCircle2, ChevronDown } from "lucide-react";
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

interface LabTest {
  test_id: string;
  name: string;
  unit: string | null;
  ref_low: number | null;
  ref_high: number | null;
}

// Group tests into categories by name prefix heuristic
const CATEGORIES: { label: string; match: (name: string) => boolean }[] = [
  { label: "Metabolic / Diabetes",  match: (n) => /glucose|hba1c|insulin/i.test(n) },
  { label: "Lipid Profile",         match: (n) => /cholesterol|triglyceride|ldl|hdl/i.test(n) },
  { label: "Renal / Liver",         match: (n) => /creatinine|urea|uric|sgpt|sgot|bilirubin|albumin|alkaline/i.test(n) },
  { label: "Haematology",           match: (n) => /haemoglobin|wbc|platelet|haematocrit|mcv/i.test(n) },
  { label: "Thyroid",               match: (n) => /tsh|t3|t4/i.test(n) },
  { label: "Cardiac Markers",       match: (n) => /troponin|ck-mb|bnp/i.test(n) },
  { label: "Electrolytes",          match: (n) => /sodium|potassium|calcium/i.test(n) },
  { label: "Other",                 match: () => true },
];

function categorise(tests: LabTest[]) {
  const buckets: Record<string, LabTest[]> = {};
  for (const test of tests) {
    const cat = CATEGORIES.find((c) => c.match(test.name))?.label ?? "Other";
    (buckets[cat] ??= []).push(test);
  }
  return buckets;
}

export default function OrderLabForm({ open, onClose, appointmentId, patientId }: Props) {
  const [query,    setQuery]    = useState("");
  const [selected, setSelected] = useState<LabTest | null>(null);
  const [showDrop, setShowDrop] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef  = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: tests = [], isLoading: loadingTests } = useQuery<LabTest[]>({
    queryKey: ["lab-tests"],
    queryFn:  async () => (await api.get("/lab/tests")).data,
    enabled: open,
  });

  // Reset on close
  useEffect(() => {
    if (!open) { setQuery(""); setSelected(null); setShowDrop(false); }
  }, [open]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current?.contains(e.target as Node) || inputRef.current === e.target) return;
      setShowDrop(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = query.trim()
    ? tests.filter((t) => t.name.toLowerCase().includes(query.toLowerCase()))
    : tests;

  const buckets = categorise(filtered);

  const pick = (t: LabTest) => { setSelected(t); setQuery(""); setShowDrop(false); };
  const clear = () => { setSelected(null); setTimeout(() => inputRef.current?.focus(), 50); };

  const mutation = useMutation({
    mutationFn: () =>
      api.post("/lab/orders", { appointment_id: appointmentId, test_id: selected!.test_id }),
    onSuccess: () => {
      toast("Lab test ordered", "success");
      qc.invalidateQueries({ queryKey: ["patient-detail", patientId] });
      setSelected(null); onClose();
    },
    onError: (e: AxiosError<{ detail?: string }>) =>
      toast(e.response?.data?.detail ?? "Failed to order lab test", "error"),
  });

  return (
    <Modal open={open} onClose={onClose} title="Order Lab Test"
      subtitle="Search or browse all 36 available tests" icon={FlaskConical}>
      <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">

        {/* ── Picker ─────────────────────────────────────────────────────── */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Test <span className="text-red-400">*</span>
          </label>

          {selected ? (
            /* Selected card */
            <div className="flex items-center gap-3 rounded-xl border border-cyan-200 bg-cyan-50/60 p-3.5">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-cyan-600" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-navy">{selected.name}</p>
                {selected.ref_low != null && selected.ref_high != null && (
                  <p className="mt-0.5 text-xs text-slate-500">
                    Reference: {selected.ref_low} – {selected.ref_high}
                    {selected.unit ? ` ${selected.unit}` : ""}
                  </p>
                )}
              </div>
              <button type="button" onClick={clear}
                className="shrink-0 rounded-lg p-1 text-cyan-500 hover:bg-cyan-100 hover:text-cyan-800">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="relative">
              {/* Search + toggle row */}
              <div className="relative flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  {loadingTests && (
                    <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                  )}
                  <input
                    ref={inputRef}
                    type="text"
                    className="input pl-10 pr-4"
                    placeholder="Search test by name…"
                    value={query}
                    autoComplete="off"
                    onChange={(e) => { setQuery(e.target.value); setShowDrop(true); }}
                    onFocus={() => setShowDrop(true)}
                    onKeyDown={(e) => e.key === "Escape" && setShowDrop(false)}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowDrop((v) => !v)}
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors",
                    showDrop
                      ? "border-brand bg-brand/10 text-brand"
                      : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                  )}
                  title="Browse all tests"
                >
                  <ChevronDown className={cn("h-4 w-4 transition-transform", showDrop && "rotate-180")} />
                </button>
              </div>

              {/* Dropdown */}
              {showDrop && (
                <div
                  ref={dropRef}
                  className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl"
                >
                  {filtered.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-slate-400">
                      No tests match "<strong>{query}</strong>"
                    </p>
                  ) : (
                    Object.entries(buckets).map(([cat, items]) =>
                      items.length === 0 ? null : (
                        <div key={cat}>
                          <p className="sticky top-0 border-b border-slate-100 bg-slate-50 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {cat}
                          </p>
                          {items.map((t) => (
                            <button
                              key={t.test_id}
                              type="button"
                              onClick={() => pick(t)}
                              className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-slate-50"
                            >
                              <span className="text-sm font-medium text-navy">{t.name}</span>
                              <span className="ml-2 shrink-0 text-xs text-slate-400">
                                {t.unit || ""}
                                {t.ref_low != null && t.ref_high != null
                                  ? ` · ${t.ref_low}–${t.ref_high}` : ""}
                              </span>
                            </button>
                          ))}
                        </div>
                      )
                    )
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          <button type="submit" disabled={mutation.isPending || !selected} className="btn-primary disabled:opacity-50">
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
            Order Test
          </button>
        </div>
      </form>
    </Modal>
  );
}
