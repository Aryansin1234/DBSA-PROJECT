/**
 * EnterLabResultForm — Lab Technician enters a numeric result for a pending investigation.
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FlaskConical, Loader2 } from "lucide-react";
import { AxiosError } from "axios";
import { api } from "../lib/api";
import { useToast } from "./Toast";
import Modal from "./Modal";

interface Props {
  open: boolean;
  onClose: () => void;
  investigationId: string;
  testName: string;
  unit: string | null;
  refLow: number | null;
  refHigh: number | null;
  patientId: string;
  /** Optional extra callback after a successful save (e.g. to refresh a queue). */
  onSuccess?: () => void;
}

const FLAG_COLOR: Record<string, string> = {
  NORMAL:   "bg-emerald-50 text-emerald-700",
  LOW:      "bg-blue-50    text-blue-700",
  HIGH:     "bg-amber-50   text-amber-700",
  CRITICAL: "bg-red-50     text-red-700",
};

function computeFlag(value: number, low: number | null, high: number | null): string {
  if (low == null || high == null) return "NORMAL";
  if (value < low * 0.5 || value > high * 1.5) return "CRITICAL";
  if (value < low) return "LOW";
  if (value > high) return "HIGH";
  return "NORMAL";
}

export default function EnterLabResultForm({
  open, onClose, investigationId, testName, unit, refLow, refHigh, patientId, onSuccess,
}: Props) {
  const [value, setValue] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const numVal = parseFloat(value);
  const preview = !isNaN(numVal) && value !== "" ? computeFlag(numVal, refLow, refHigh) : null;

  const mutation = useMutation({
    mutationFn: () =>
      api.put(`/lab/results/${investigationId}`, { value: numVal }),
    onSuccess: () => {
      toast("Result recorded", "success");
      qc.invalidateQueries({ queryKey: ["patient-detail", patientId] });
      qc.invalidateQueries({ queryKey: ["lab-pending"] });
      setValue("");
      onSuccess?.();
      onClose();
    },
    onError: (e: AxiosError<{ detail?: string }>) =>
      toast(e.response?.data?.detail ?? "Failed to enter result", "error"),
  });

  return (
    <Modal
      open={open}
      onClose={() => { setValue(""); onClose(); }}
      title="Enter Lab Result"
      subtitle={testName}
      icon={FlaskConical}
    >
      <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
        {(refLow != null || refHigh != null) && (
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Reference range:{" "}
            <span className="font-semibold text-navy">
              {refLow ?? "—"} – {refHigh ?? "—"} {unit ?? ""}
            </span>
          </div>
        )}

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
            Result value {unit ? `(${unit})` : ""} <span className="text-red-400">*</span>
          </span>
          <input
            type="number"
            step="any"
            min="0"
            required
            className="input"
            placeholder={`Enter numeric value${unit ? ` in ${unit}` : ""}…`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>

        {preview && (
          <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${FLAG_COLOR[preview]}`}>
            Predicted flag: {preview}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={() => { setValue(""); onClose(); }} className="btn-ghost">Cancel</button>
          <button type="submit" disabled={mutation.isPending || !value || isNaN(numVal)} className="btn-primary">
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
            Save Result
          </button>
        </div>
      </form>
    </Modal>
  );
}
