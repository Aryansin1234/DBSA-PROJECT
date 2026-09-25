/**
 * AddPrescriptionForm — Doctor/Admin issues a prescription for an appointment.
 * Each item: searchable medicine picker (with category grouping + stock badge)
 * + dosage / frequency / duration controls.
 */
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pill, Plus, Trash2, Loader2, Search, X, CheckCircle2, ChevronDown, PackageOpen } from "lucide-react";
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

interface Medicine {
  medicine_id: string;
  name: string;
  stock_count: number;
  category: string | null;
}

interface PrescItem {
  medicine_id: string;
  dosage: string;
  frequency: string;
  duration_days: number;
}

const FREQUENCIES = [
  { value: "OD",  label: "OD — Once daily" },
  { value: "BID", label: "BID — Twice daily" },
  { value: "TID", label: "TID — Three times daily" },
  { value: "QID", label: "QID — Four times daily" },
  { value: "HS",  label: "HS — At bedtime" },
  { value: "SOS", label: "SOS — As needed" },
];
const DOSAGES = ["125mg", "250mg", "500mg", "1g", "2.5mg", "5mg", "10mg", "20mg", "40mg", "650mg", "0.5mg", "1mg"];

// ── Searchable medicine picker for a single prescription item ────────────────
function MedicinePicker({
  medicines,
  value,
  onChange,
}: {
  medicines: Medicine[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [query,    setQuery]    = useState("");
  const [showDrop, setShowDrop] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef  = useRef<HTMLDivElement>(null);

  const selected = medicines.find((m) => m.medicine_id === value) ?? null;

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current?.contains(e.target as Node) || inputRef.current === e.target) return;
      setShowDrop(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = query.trim()
    ? medicines.filter((m) =>
        m.name.toLowerCase().includes(query.toLowerCase()) ||
        (m.category ?? "").toLowerCase().includes(query.toLowerCase())
      )
    : medicines;

  // Group by category
  const buckets: Record<string, Medicine[]> = {};
  for (const m of filtered) {
    const cat = m.category ?? "Other";
    (buckets[cat] ??= []).push(m);
  }

  const pick = (m: Medicine) => {
    onChange(m.medicine_id);
    setQuery("");
    setShowDrop(false);
  };

  const clear = () => {
    onChange("");
    setQuery("");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  if (selected) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-violet-200 bg-violet-50/60 px-3 py-2.5">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-violet-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-navy truncate">{selected.name}</p>
          <p className="text-xs text-slate-400">
            {selected.category ?? "Medicine"}
            {selected.stock_count <= 10
              ? <span className="ml-1.5 text-red-500">Low stock ({selected.stock_count})</span>
              : <span className="ml-1.5 text-emerald-600">In stock ({selected.stock_count})</span>
            }
          </p>
        </div>
        <button type="button" onClick={clear}
          className="shrink-0 rounded p-0.5 text-violet-400 hover:bg-violet-100 hover:text-violet-700">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            className="input pl-9 text-sm"
            placeholder="Search medicine…"
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
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors",
            showDrop
              ? "border-violet-400 bg-violet-50 text-violet-600"
              : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
          )}
          title="Browse all medicines"
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", showDrop && "rotate-180")} />
        </button>
      </div>

      {showDrop && (
        <div
          ref={dropRef}
          className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl"
        >
          {filtered.length === 0 ? (
            <p className="px-4 py-5 text-center text-sm text-slate-400">
              No medicines match "<strong>{query}</strong>"
            </p>
          ) : (
            Object.entries(buckets).map(([cat, items]) => (
              <div key={cat}>
                <p className="sticky top-0 border-b border-slate-100 bg-slate-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {cat}
                </p>
                {items.map((m) => (
                  <button
                    key={m.medicine_id}
                    type="button"
                    disabled={m.stock_count === 0}
                    onClick={() => pick(m)}
                    className={cn(
                      "flex w-full items-center justify-between px-3 py-2 text-left transition-colors",
                      m.stock_count === 0
                        ? "cursor-not-allowed opacity-40"
                        : "hover:bg-slate-50"
                    )}
                  >
                    <span className="text-sm font-medium text-navy">{m.name}</span>
                    <span className={cn(
                      "ml-2 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      m.stock_count === 0
                        ? "bg-red-50 text-red-500"
                        : m.stock_count <= 10
                          ? "bg-amber-50 text-amber-600"
                          : "bg-emerald-50 text-emerald-600"
                    )}>
                      {m.stock_count === 0 ? "Out of stock" : `Stock: ${m.stock_count}`}
                    </span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Main form ────────────────────────────────────────────────────────────────
export default function AddPrescriptionForm({ open, onClose, appointmentId, patientId }: Props) {
  const [items, setItems] = useState<PrescItem[]>([
    { medicine_id: "", dosage: "", frequency: "OD", duration_days: 5 },
  ]);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: medicines = [] } = useQuery<Medicine[]>({
    queryKey: ["medicines"],
    queryFn:  async () => (await api.get("/lab/medicines")).data,
    enabled: open,
  });

  useEffect(() => {
    if (!open) setItems([{ medicine_id: "", dosage: "", frequency: "OD", duration_days: 5 }]);
  }, [open]);

  const updateItem = (idx: number, patch: Partial<PrescItem>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const addItem = () =>
    setItems((prev) => [...prev, { medicine_id: "", dosage: "", frequency: "OD", duration_days: 5 }]);

  const removeItem = (idx: number) =>
    setItems((prev) => prev.filter((_, i) => i !== idx));

  const mutation = useMutation({
    mutationFn: () =>
      api.post("/prescriptions", {
        appointment_id: appointmentId,
        items: items.map((it) => ({
          medicine_id:   it.medicine_id,
          dosage:        it.dosage,
          frequency:     it.frequency,
          duration_days: it.duration_days,
        })),
      }),
    onSuccess: () => {
      toast("Prescription issued", "success");
      qc.invalidateQueries({ queryKey: ["patient-detail", patientId] });
      qc.invalidateQueries({ queryKey: ["kpis"] });
      onClose();
    },
    onError: (e: AxiosError<{ detail?: string }>) =>
      toast(e.response?.data?.detail ?? "Failed to issue prescription", "error"),
  });

  const valid = items.length > 0 &&
    items.every((it) => it.medicine_id && it.dosage && it.duration_days > 0);

  return (
    <Modal open={open} onClose={onClose}
      title="Issue Prescription"
      subtitle="Search or browse medicines — add one or more items"
      icon={Pill}
    >
      <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-3">

        {items.map((item, idx) => {
          const med = medicines.find((m) => m.medicine_id === item.medicine_id);
          return (
            <div key={idx} className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 space-y-3">
              {/* Header row */}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                  <PackageOpen className="h-3.5 w-3.5" /> Medicine {idx + 1}
                </span>
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(idx)}
                    className="rounded-lg p-1 text-red-400 hover:bg-red-50 hover:text-red-600">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Medicine picker */}
              <MedicinePicker
                medicines={medicines}
                value={item.medicine_id}
                onChange={(id) => updateItem(idx, { medicine_id: id, dosage: "" })}
              />

              {/* Dosage / Frequency / Days — only show once medicine picked */}
              {med && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-400">Dosage</label>
                    <div className="relative">
                      <select
                        required
                        className="input appearance-none pr-7 text-sm"
                        value={item.dosage}
                        onChange={(e) => updateItem(idx, { dosage: e.target.value })}
                      >
                        <option value="">Pick…</option>
                        {DOSAGES.map((d) => <option key={d}>{d}</option>)}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-400">Frequency</label>
                    <div className="relative">
                      <select
                        className="input appearance-none pr-7 text-sm"
                        value={item.frequency}
                        onChange={(e) => updateItem(idx, { frequency: e.target.value })}
                      >
                        {FREQUENCIES.map((f) => (
                          <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-400">Days</label>
                    <input
                      type="number"
                      min={1}
                      max={90}
                      required
                      className="input text-sm"
                      value={item.duration_days}
                      onChange={(e) => updateItem(idx, { duration_days: Math.max(1, Number(e.target.value)) })}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={addItem}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-2.5 text-sm font-semibold text-slate-500 transition-colors hover:border-brand hover:text-brand"
        >
          <Plus className="h-4 w-4" /> Add another medicine
        </button>

        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          <button type="submit" disabled={mutation.isPending || !valid}
            className="btn-primary disabled:opacity-50">
            {mutation.isPending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Pill className="h-4 w-4" />
            }
            Issue Prescription
          </button>
        </div>
      </form>
    </Modal>
  );
}
