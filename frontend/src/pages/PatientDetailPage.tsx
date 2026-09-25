import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft, CalendarDays, Stethoscope, Pill, FlaskConical,
  Droplet, Phone, Mail, ShieldPlus, UserRound, CalendarPlus,
  FileText, Pencil,
} from "lucide-react";
import { api } from "../lib/api";
import AppointmentStatusControl from "../components/AppointmentStatusControl";
import BookAppointmentForm from "../components/BookAppointmentForm";
import SoapEditor from "../components/SoapEditor";
import AddDiagnosisForm from "../components/AddDiagnosisForm";
import AddPrescriptionForm from "../components/AddPrescriptionForm";
import OrderLabForm from "../components/OrderLabForm";
import EnterLabResultForm from "../components/EnterLabResultForm";
import { useAuthStore } from "../store/auth";

interface LabItem {
  investigation_id: string;
  test_name: string;
  unit?: string | null;
  value: number | null;
  flag: string | null;
  ordered_at: string;
  ref_low?: number | null;
  ref_high?: number | null;
}

interface Detail {
  patient: {
    patient_id: string; mrn: string; first_name: string; last_name: string;
    age: number; gender: string; phone: string | null; blood_group: string | null;
  };
  email: string | null;
  insurance_number: string | null;
  emergency_contact: string | null;
  stats: Record<string, number>;
  appointments: {
    appointment_id: string; start_time: string; end_time: string;
    status: string; reason: string | null; doctor_name: string | null;
  }[];
  diagnoses: {
    diagnosis_id: string; icd10_code: string; description: string | null;
    severity: string; notes: string | null;
  }[];
  prescriptions: { prescription_id: string; issued_at: string; items: string[] }[];
  labs: LabItem[];
}

const severityColor: Record<string, string> = {
  MILD:     "bg-emerald-50 text-emerald-600",
  MODERATE: "bg-amber-50   text-amber-600",
  SEVERE:   "bg-orange-50  text-orange-600",
  CRITICAL: "bg-red-50     text-red-600",
};
const flagColor: Record<string, string> = {
  NORMAL:   "bg-emerald-50 text-emerald-600",
  LOW:      "bg-blue-50    text-blue-600",
  HIGH:     "bg-amber-50   text-amber-600",
  CRITICAL: "bg-red-50     text-red-600",
};

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate  = useNavigate();
  const role      = useAuthStore((s) => s.role);

  // ── modal state ───────────────────────────────────────────────────────────
  const [booking,      setBooking]      = useState(false);
  const [soapAppt,     setSoapAppt]     = useState<string | null>(null);
  const [diagAppt,     setDiagAppt]     = useState<string | null>(null);
  const [rxAppt,       setRxAppt]       = useState<string | null>(null);
  const [labAppt,      setLabAppt]      = useState<string | null>(null);
  const [labResult,    setLabResult]    = useState<LabItem | null>(null);

  // ── permissions ───────────────────────────────────────────────────────────
  const canEditNotes   = role === "DOCTOR" || role === "ADMIN";
  const canDiagnose    = role === "DOCTOR" || role === "ADMIN";
  const canPrescribe   = role === "DOCTOR" || role === "ADMIN";
  const canOrderLab    = role === "DOCTOR" || role === "ADMIN";
  const canEnterResult = role === "LAB_TECHNICIAN" || role === "ADMIN";
  const canSeeClinical = role === "DOCTOR" || role === "ADMIN" || role === "NURSE";
  const canSeeLabs     = role === "DOCTOR" || role === "ADMIN" || role === "NURSE" || role === "LAB_TECHNICIAN";
  const canBook        = role === "ADMIN" || role === "DOCTOR" || role === "RECEPTIONIST";
  const canAccessPage  = role !== "RECEPTIONIST";

  const { data, isLoading } = useQuery<Detail>({
    queryKey: ["patient-detail", id],
    queryFn:  async () => (await api.get(`/patients/${id}/detail`)).data,
    enabled:  !!id,
  });

  // ── blocked role ─────────────────────────────────────────────────────────
  if (!canAccessPage) {
    return (
      <div className="card p-16 text-center text-slate-400">
        <button onClick={() => navigate("/patients")} className="btn-ghost mb-6 -ml-2">
          <ArrowLeft className="h-4 w-4" /> Back to patients
        </button>
        <ShieldPlus className="mx-auto mb-3 h-10 w-10 opacity-40" />
        <p>You do not have access to patient clinical details.</p>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

  const p   = data.patient;
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  const stats = [
    { label: "Appointments",  value: data.stats.appointments,  icon: CalendarDays, color: "from-blue-500 to-blue-600",     show: true },
    { label: "Diagnoses",     value: data.stats.diagnoses,     icon: Stethoscope,  color: "from-brand to-brand-dark",       show: canSeeClinical },
    { label: "Prescriptions", value: data.stats.prescriptions, icon: Pill,         color: "from-violet-500 to-purple-600",  show: canSeeClinical },
    { label: "Lab Tests",     value: data.stats.labs,          icon: FlaskConical, color: "from-amber-500 to-orange-600",   show: canSeeLabs },
  ].filter((s) => s.show);

  return (
    <div>
      <button onClick={() => navigate("/patients")} className="btn-ghost mb-6 -ml-2">
        <ArrowLeft className="h-4 w-4" /> Back to patients
      </button>

      {/* ── Patient header ─────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        className="card mb-6 flex flex-wrap items-center justify-between gap-6 p-6"
      >
        <div className="flex items-center gap-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-navy to-navy-700 text-xl font-extrabold text-white shadow-soft">
            {p.first_name[0]}{p.last_name[0]}
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-navy">{p.first_name} {p.last_name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs">{p.mrn}</span>
              <span className="inline-flex items-center gap-1"><UserRound className="h-3.5 w-3.5" />{p.gender}, {p.age}y</span>
              {p.blood_group && <span className="inline-flex items-center gap-1 text-red-500"><Droplet className="h-3.5 w-3.5" />{p.blood_group}</span>}
              {p.phone        && <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{p.phone}</span>}
              {data.email     && <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{data.email}</span>}
              {data.emergency_contact && <span className="inline-flex items-center gap-1"><ShieldPlus className="h-3.5 w-3.5" />{data.emergency_contact}</span>}
            </div>
          </div>
        </div>
        {canBook && (
          <button onClick={() => setBooking(true)} className="btn-primary">
            <CalendarPlus className="h-4 w-4" /> Book Appointment
          </button>
        )}
      </motion.div>

      {/* ── Stat cards ─────────────────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="card flex items-center gap-4 p-5"
          >
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${s.color} text-white`}>
              <s.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-navy">{s.value}</p>
              <p className="text-xs font-medium text-slate-400">{s.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Clinical sections ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Appointments */}
        <Section title="Appointments" icon={CalendarDays}>
          {data.appointments.length === 0 ? <Empty /> : data.appointments.map((a) => (
            <div key={a.appointment_id} className="flex items-center justify-between border-b border-slate-50 py-3 last:border-0">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-navy">{fmt(a.start_time)}</p>
                <p className="truncate text-xs text-slate-400">{a.doctor_name} · {a.reason ?? "—"}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <AppointmentStatusControl
                  appointmentId={a.appointment_id}
                  currentStatus={a.status}
                  role={role}
                />
                {canEditNotes && (
                  <button
                    onClick={() => setSoapAppt(a.appointment_id)}
                    className="inline-flex items-center gap-1 rounded-lg bg-navy-50 px-2 py-1 text-xs font-semibold text-navy transition-colors hover:bg-navy hover:text-white"
                  >
                    <FileText className="h-3 w-3" /> Note
                  </button>
                )}
                {canDiagnose && (
                  <button
                    onClick={() => setDiagAppt(a.appointment_id)}
                    className="inline-flex items-center gap-1 rounded-lg bg-brand/10 px-2 py-1 text-xs font-semibold text-brand transition-colors hover:bg-brand hover:text-white"
                  >
                    <Stethoscope className="h-3 w-3" /> Dx
                  </button>
                )}
                {canPrescribe && (
                  <button
                    onClick={() => setRxAppt(a.appointment_id)}
                    className="inline-flex items-center gap-1 rounded-lg bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-600 hover:text-white"
                  >
                    <Pill className="h-3 w-3" /> Rx
                  </button>
                )}
                {canOrderLab && (
                  <button
                    onClick={() => setLabAppt(a.appointment_id)}
                    className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-500 hover:text-white"
                  >
                    <FlaskConical className="h-3 w-3" /> Lab
                  </button>
                )}
              </div>
            </div>
          ))}
        </Section>

        {/* Diagnoses */}
        {canSeeClinical && (
          <Section title="Diagnoses" icon={Stethoscope}>
            {data.diagnoses.length === 0 ? <Empty /> : data.diagnoses.map((d) => (
              <div key={d.diagnosis_id} className="flex items-center justify-between border-b border-slate-50 py-3 last:border-0">
                <div>
                  <p className="text-sm font-semibold text-navy">{d.description ?? d.icd10_code}</p>
                  <p className="text-xs text-slate-400">ICD-10 {d.icd10_code}{d.notes ? ` · ${d.notes}` : ""}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${severityColor[d.severity] ?? "bg-slate-100 text-slate-500"}`}>
                  {d.severity}
                </span>
              </div>
            ))}
          </Section>
        )}

        {/* Prescriptions */}
        {canSeeClinical && (
          <Section title="Prescriptions" icon={Pill}>
            {data.prescriptions.length === 0 ? <Empty /> : data.prescriptions.map((pr) => (
              <div key={pr.prescription_id} className="border-b border-slate-50 py-3 last:border-0">
                <p className="mb-1 text-xs font-medium text-slate-400">{fmt(pr.issued_at)}</p>
                <ul className="space-y-1">
                  {pr.items.map((it, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-navy">
                      <span className="h-1.5 w-1.5 rounded-full bg-brand" />{it}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </Section>
        )}

        {/* Lab Investigations */}
        {canSeeLabs && (
          <Section title="Lab Investigations" icon={FlaskConical}>
            {data.labs.length === 0 ? <Empty /> : data.labs.map((l) => (
              <div key={l.investigation_id} className="flex items-center justify-between border-b border-slate-50 py-3 last:border-0">
                <div>
                  <p className="text-sm font-semibold text-navy">{l.test_name}</p>
                  <p className="text-xs text-slate-400">{fmt(l.ordered_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {l.value != null ? (
                    <>
                      <span className="text-sm font-bold text-navy">{l.value}</span>
                      {l.flag && (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${flagColor[l.flag] ?? "bg-slate-100 text-slate-500"}`}>
                          {l.flag}
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="text-xs text-slate-400 italic">Pending</span>
                      {canEnterResult && (
                        <button
                          onClick={() => setLabResult(l)}
                          className="inline-flex items-center gap-1 rounded-lg bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-700 transition-colors hover:bg-cyan-600 hover:text-white"
                        >
                          <Pencil className="h-3 w-3" /> Enter
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </Section>
        )}
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <BookAppointmentForm
        open={booking}
        onClose={() => setBooking(false)}
        presetPatientId={id}
      />
      {soapAppt && (
        <SoapEditor
          open={!!soapAppt}
          onClose={() => setSoapAppt(null)}
          appointmentId={soapAppt}
        />
      )}
      {diagAppt && (
        <AddDiagnosisForm
          open={!!diagAppt}
          onClose={() => setDiagAppt(null)}
          appointmentId={diagAppt}
          patientId={id!}
        />
      )}
      {rxAppt && (
        <AddPrescriptionForm
          open={!!rxAppt}
          onClose={() => setRxAppt(null)}
          appointmentId={rxAppt}
          patientId={id!}
        />
      )}
      {labAppt && (
        <OrderLabForm
          open={!!labAppt}
          onClose={() => setLabAppt(null)}
          appointmentId={labAppt}
          patientId={id!}
        />
      )}
      {labResult && (
        <EnterLabResultForm
          open={!!labResult}
          onClose={() => setLabResult(null)}
          investigationId={labResult.investigation_id}
          testName={labResult.test_name}
          unit={labResult.unit ?? null}
          refLow={labResult.ref_low ?? null}
          refHigh={labResult.ref_high ?? null}
          patientId={id!}
        />
      )}
    </div>
  );
}

function Section({ title, icon: Icon, children }: {
  title: string; icon: typeof CalendarDays; children: React.ReactNode;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
      <div className="mb-3 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-50 text-navy">
          <Icon className="h-4 w-4" />
        </div>
        <h2 className="font-bold text-navy">{title}</h2>
      </div>
      <div className="max-h-80 overflow-y-auto pr-1">{children}</div>
    </motion.div>
  );
}

function Empty() {
  return <p className="py-6 text-center text-sm text-slate-300">No records yet.</p>;
}
