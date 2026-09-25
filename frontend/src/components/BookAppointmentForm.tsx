import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Loader2, Stethoscope } from "lucide-react";
import { AxiosError } from "axios";
import { api } from "../lib/api";
import { useToast } from "./Toast";
import { useAuthStore } from "../store/auth";
import Modal from "./Modal";
import SearchSelect from "./SearchSelect";

interface Props {
  open: boolean;
  onClose: () => void;
  presetPatientId?: string;
}

interface Patient {
  patient_id: string;
  first_name: string;
  last_name: string;
  mrn: string;
}
interface Doctor {
  professional_id: string;
  first_name: string;
  last_name: string;
  department: string | null;
}

export default function BookAppointmentForm({ open, onClose, presetPatientId }: Props) {
  const { role, user } = useAuthStore();
  const isDoctor = role === "DOCTOR";
  const [patientId, setPatientId] = useState(presetPatientId ?? "");
  // A doctor books for themselves — pre-fill and lock the doctor field.
  const [doctorId, setDoctorId] = useState(isDoctor ? user?.id ?? "" : "");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: patients } = useQuery<Patient[]>({
    queryKey: ["patients", "all-for-booking"],
    // Pass all=true so doctors can book for any patient (creates new association).
    queryFn: async () => (await api.get("/patients", { params: { limit: 200, all: true } })).data,
    enabled: open && !presetPatientId,
  });
  const { data: doctors } = useQuery<Doctor[]>({
    queryKey: ["doctors"],
    queryFn: async () => (await api.get("/professionals", { params: { role: "DOCTOR" } })).data,
    enabled: open && !isDoctor,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        patient_id: presetPatientId ?? patientId,
        doctor_id: isDoctor ? user?.id : doctorId,
        start_time: new Date(start).toISOString(),
        end_time: new Date(end).toISOString(),
        reason: reason || null,
      };
      return (await api.post("/appointments", payload)).data;
    },
    onSuccess: () => {
      toast("Appointment booked successfully", "success");
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["kpis"] });
      qc.invalidateQueries({ queryKey: ["weekly-trend"] });
      qc.invalidateQueries({ queryKey: ["patient-detail"] });
      reset();
      onClose();
    },
    onError: (err: AxiosError<{ detail?: string }>) => {
      const status = err.response?.status;
      if (status === 409) {
        toast("Doctor is already booked in that time window", "error");
      } else {
        toast(err.response?.data?.detail ?? "Could not book appointment", "error");
      }
    },
  });

  const reset = () => {
    setStart(""); setEnd(""); setReason("");
    if (!isDoctor) setDoctorId("");
    if (!presetPatientId) setPatientId("");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <Modal open={open} onClose={onClose} title="Book Appointment" subtitle="Real-time doctor conflict detection" icon={CalendarPlus}>
      <form onSubmit={submit} className="space-y-4">
        {!presetPatientId && (
          <Field label="Patient" required>
            <SearchSelect
              required
              value={patientId}
              onChange={setPatientId}
              placeholder="Search patient by name or MRN…"
              emptyText="No matching patients"
              options={
                patients?.map((p) => ({
                  value: p.patient_id,
                  label: `${p.first_name} ${p.last_name}`,
                  sublabel: p.mrn,
                })) ?? []
              }
            />
          </Field>
        )}

        {isDoctor ? (
          <Field label="Doctor">
            <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <Stethoscope className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-navy">
                  Dr. {user?.name ?? "You"}
                </p>
                <p className="text-xs text-slate-400">
                  Booking under your account{user?.department ? ` · ${user.department}` : ""}
                </p>
              </div>
            </div>
          </Field>
        ) : (
          <Field label="Doctor" required>
            <SearchSelect
              required
              value={doctorId}
              onChange={setDoctorId}
              placeholder="Search doctor by name or department…"
              emptyText="No matching doctors"
              options={
                doctors?.map((d) => ({
                  value: d.professional_id,
                  label: `Dr. ${d.first_name} ${d.last_name}`,
                  sublabel: d.department ?? undefined,
                })) ?? []
              }
            />
          </Field>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label="Start" required>
            <input type="datetime-local" className="input" required value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="End" required>
            <input type="datetime-local" className="input" required value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>

        <Field label="Reason">
          <input className="input" placeholder="e.g. Follow-up consultation" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          <button type="submit" disabled={mutation.isPending} className="btn-primary">
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
            Book
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
