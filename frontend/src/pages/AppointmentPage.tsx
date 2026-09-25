import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays, Clock, ArrowRight, FileText, CalendarPlus,
  CheckCircle2, AlertCircle, Loader, Ban, ChevronRight,
} from "lucide-react";
import { api } from "../lib/api";
import PageHeader from "../components/PageHeader";
import AppointmentStatusControl from "../components/AppointmentStatusControl";
import BookAppointmentForm from "../components/BookAppointmentForm";
import { useAuthStore } from "../store/auth";

interface Appointment {
  appointment_id: string;
  patient_id: string;
  doctor_id: string;
  patient_name: string | null;
  doctor_name: string | null;
  start_time: string;
  end_time: string;
  status: string;
  reason: string | null;
}

interface ApptStats {
  total: number;
  scheduled: number;
  in_progress: number;
  completed: number;
  cancelled: number;
  no_show: number;
}

export default function AppointmentPage() {
  const [bookOpen, setBookOpen] = useState(false);
  const role     = useAuthStore((s) => s.role);
  const navigate = useNavigate();
  // Nurses can VIEW appointments but only ADMIN/RECEPTIONIST/DOCTOR can create them.
  const canBook        = role === "ADMIN" || role === "RECEPTIONIST" || role === "DOCTOR";
  // Receptionist cannot drill into clinical detail
  const canViewPatient = role !== "RECEPTIONIST";

  const { data, isLoading } = useQuery<Appointment[]>({
    queryKey: ["appointments"],
    queryFn: async () => (await api.get("/appointments")).data,
    refetchInterval: 5000,
  });

  const { data: stats } = useQuery<ApptStats>({
    queryKey: ["appt-stats"],
    queryFn: async () => (await api.get("/analytics/appointments/stats")).data,
    refetchInterval: 5000,
  });

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, {
      day: "2-digit", month: "short", year: "numeric",
    });
  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

  const statCards = [
    { label: "Total",       value: stats?.total       ?? 0, icon: CalendarDays,  color: "from-navy to-navy-700" },
    { label: "Scheduled",   value: stats?.scheduled   ?? 0, icon: CalendarPlus,  color: "from-blue-500 to-blue-600" },
    { label: "In Progress", value: stats?.in_progress ?? 0, icon: Loader,        color: "from-amber-500 to-orange-500" },
    { label: "Completed",   value: stats?.completed   ?? 0, icon: CheckCircle2,  color: "from-brand to-brand-dark" },
    { label: "Cancelled",   value: stats?.cancelled   ?? 0, icon: Ban,           color: "from-red-500 to-red-600" },
    { label: "No Show",     value: stats?.no_show     ?? 0, icon: AlertCircle,   color: "from-slate-400 to-slate-500" },
  ];

  return (
    <div>
      <PageHeader
        title={role === "DOCTOR" ? "My Appointments" : "Appointments"}
        subtitle="Scheduling with real-time conflict detection"
        icon={CalendarDays}
        action={
          canBook ? (
            <button onClick={() => setBookOpen(true)} className="btn-primary">
              <CalendarPlus className="h-4 w-4" /> Book Appointment
            </button>
          ) : undefined
        }
      />

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-3 gap-4 sm:grid-cols-6">
        {statCards.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="card relative overflow-hidden p-4"
          >
            <div className={`absolute -right-3 -top-3 h-14 w-14 rounded-full bg-gradient-to-br ${s.color} opacity-10`} />
            <div className={`mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${s.color} text-white`}>
              <s.icon className="h-4 w-4" />
            </div>
            <p className="text-xl font-extrabold text-navy">{s.value}</p>
            <p className="mt-0.5 text-xs font-medium text-slate-500">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="card overflow-hidden"
      >
        {isLoading ? (
          <div className="space-y-3 p-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-6 py-4">Patient</th>
                <th className="px-6 py-4">Doctor</th>
                <th className="px-6 py-4">Date & Time</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Reason</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {data?.map((a, i) => (
                  <motion.tr
                    key={a.appointment_id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => canViewPatient && navigate(`/patients/${a.patient_id}`)}
                    className={`group border-b border-slate-50 transition-colors hover:bg-slate-50 ${canViewPatient ? "cursor-pointer" : "cursor-default"}`}
                  >
                    <td className="px-6 py-3.5">
                      <span className="font-medium text-navy">{a.patient_name ?? "—"}</span>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="text-sm text-slate-600">{a.doctor_name ?? "—"}</span>
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-50 text-navy">
                          <CalendarDays className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium text-navy">{fmtDate(a.start_time)}</p>
                          <p className="inline-flex items-center gap-1 text-xs text-slate-400">
                            <Clock className="h-3 w-3" />
                            {fmtTime(a.start_time)}
                            <ArrowRight className="h-2.5 w-2.5" />
                            {fmtTime(a.end_time)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td
                      className="px-6 py-3.5"
                      onClick={(e) => e.stopPropagation()}  /* don't navigate when clicking status */
                    >
                      <AppointmentStatusControl
                        appointmentId={a.appointment_id}
                        currentStatus={a.status}
                        role={role}
                      />
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                        <FileText className="h-3.5 w-3.5 text-slate-400" />
                        {a.reason ?? "—"}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      {canViewPatient && (
                        <ChevronRight className="ml-auto h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
                      )}
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
              {data?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-slate-400">
                    <CalendarDays className="mx-auto mb-3 h-10 w-10 opacity-40" />
                    No appointments found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </motion.div>

      <BookAppointmentForm open={bookOpen} onClose={() => setBookOpen(false)} />
    </div>
  );
}
