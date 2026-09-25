import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Loader2 } from "lucide-react";
import { AxiosError } from "axios";
import { api } from "../lib/api";
import { useToast } from "./Toast";
import Modal from "./Modal";

interface Props {
  open: boolean;
  onClose: () => void;
}

const empty = {
  first_name: "",
  last_name: "",
  date_of_birth: "",
  gender: "MALE",
  phone: "",
  email: "",
  blood_group: "",
  emergency_contact: "",
  insurance_number: "",
};

export default function RegisterPatientForm({ open, onClose }: Props) {
  const [form, setForm] = useState(empty);
  const { toast } = useToast();
  const qc = useQueryClient();

  const set = (k: keyof typeof empty, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        phone: form.phone || null,
        email: form.email || null,
        blood_group: form.blood_group || null,
        emergency_contact: form.emergency_contact || null,
        insurance_number: form.insurance_number || null,
      };
      return (await api.post("/patients", payload)).data;
    },
    onSuccess: (data) => {
      toast(`Patient registered — MRN ${data.mrn}`, "success");
      qc.invalidateQueries({ queryKey: ["patients"] });
      qc.invalidateQueries({ queryKey: ["kpis"] });
      setForm(empty);
      onClose();
    },
    onError: (err: AxiosError<{ detail?: string }>) => {
      toast(err.response?.data?.detail ?? "Could not register patient", "error");
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <Modal open={open} onClose={onClose} title="Register Patient" subtitle="Create a new patient record" icon={UserPlus}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="First name" required>
            <input className="input" required value={form.first_name} onChange={(e) => set("first_name", e.target.value)} />
          </Field>
          <Field label="Last name" required>
            <input className="input" required value={form.last_name} onChange={(e) => set("last_name", e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Date of birth" required>
            <input type="date" className="input" required value={form.date_of_birth} onChange={(e) => set("date_of_birth", e.target.value)} />
          </Field>
          <Field label="Gender">
            <select className="input" value={form.gender} onChange={(e) => set("gender", e.target.value)}>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Phone">
            <input className="input" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </Field>
          <Field label="Blood group">
            <select className="input" value={form.blood_group} onChange={(e) => set("blood_group", e.target.value)}>
              <option value="">—</option>
              {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Email">
          <input type="email" className="input" value={form.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Emergency contact">
            <input className="input" value={form.emergency_contact} onChange={(e) => set("emergency_contact", e.target.value)} />
          </Field>
          <Field label="Insurance no.">
            <input className="input" value={form.insurance_number} onChange={(e) => set("insurance_number", e.target.value)} />
          </Field>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          <button type="submit" disabled={mutation.isPending} className="btn-primary">
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Register
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label} {required && <span className="text-red-400">*</span>}
      </span>
      {children}
    </label>
  );
}
