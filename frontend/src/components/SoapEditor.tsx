import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2, Save } from "lucide-react";
import { AxiosError } from "axios";
import { api } from "../lib/api";
import { useToast } from "./Toast";
import Modal from "./Modal";

interface Props {
  open: boolean;
  onClose: () => void;
  appointmentId: string;
}

interface Soap {
  record_id: string;
  appointment_id: string;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  version: number;
}

const FIELDS: { key: keyof typeof empty; label: string; hint: string }[] = [
  { key: "subjective", label: "Subjective", hint: "Patient's reported symptoms & history" },
  { key: "objective", label: "Objective", hint: "Exam findings, vitals, measurements" },
  { key: "assessment", label: "Assessment", hint: "Diagnosis / clinical impression" },
  { key: "plan", label: "Plan", hint: "Treatment, follow-up, referrals" },
];

const empty = { subjective: "", objective: "", assessment: "", plan: "" };

export default function SoapEditor({ open, onClose, appointmentId }: Props) {
  const [form, setForm] = useState(empty);
  const [version, setVersion] = useState<number | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data } = useQuery<Soap | null>({
    queryKey: ["soap", appointmentId],
    queryFn: async () => (await api.get(`/records/${appointmentId}`)).data,
    enabled: open,
  });

  useEffect(() => {
    if (data) {
      setForm({
        subjective: data.subjective ?? "",
        objective: data.objective ?? "",
        assessment: data.assessment ?? "",
        plan: data.plan ?? "",
      });
      setVersion(data.version);
    } else if (open) {
      setForm(empty);
      setVersion(null);
    }
  }, [data, open]);

  const save = useMutation({
    mutationFn: async () =>
      (await api.post("/records", {
        appointment_id: appointmentId,
        ...form,
        version: version ?? undefined,
      })).data,
    onSuccess: (rec: Soap) => {
      toast("Clinical note saved", "success");
      setVersion(rec.version);
      qc.invalidateQueries({ queryKey: ["soap", appointmentId] });
      qc.invalidateQueries({ queryKey: ["patient-detail"] });
      onClose();
    },
    onError: (err: AxiosError<{ detail?: string }>) => {
      toast(err.response?.data?.detail ?? "Could not save note", "error");
    },
  });

  const set = (k: keyof typeof empty, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal open={open} onClose={onClose} title="Clinical Note (SOAP)" subtitle={version ? `Version ${version}` : "New encounter record"} icon={FileText}>
      <form
        onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
        className="space-y-4"
      >
        {FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              {f.label} <span className="ml-1 font-normal normal-case text-slate-300">— {f.hint}</span>
            </span>
            <textarea
              className="input min-h-[64px] resize-y"
              value={form[f.key]}
              onChange={(e) => set(f.key, e.target.value)}
            />
          </label>
        ))}
        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          <button type="submit" disabled={save.isPending} className="btn-primary">
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save note
          </button>
        </div>
      </form>
    </Modal>
  );
}
