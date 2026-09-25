import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Search, Phone, Droplet, UserRound, UserPlus, ChevronRight } from "lucide-react";
import { api } from "../lib/api";
import PageHeader from "../components/PageHeader";
import RegisterPatientForm from "../components/RegisterPatientForm";
import { useAuthStore } from "../store/auth";

interface Patient {
  patient_id: string;
  mrn: string;
  first_name: string;
  last_name: string;
  age: number;
  gender: string;
  phone: string | null;
  blood_group: string | null;
}

const avatarColors = [
  "from-blue-500 to-blue-600",
  "from-brand to-brand-dark",
  "from-violet-500 to-purple-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
];

function initials(f: string, l: string) {
  return (f[0] ?? "").toUpperCase() + (l[0] ?? "").toUpperCase();
}

type GenderFilter = "ALL" | "MALE" | "FEMALE" | "OTHER";

export default function PatientListPage() {
  const [search, setSearch] = useState("");
  const [gender, setGender] = useState<GenderFilter>("ALL");
  const [blood, setBlood] = useState<string>("ALL");
  const [registerOpen, setRegisterOpen] = useState(false);
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.role);
  const canRegister = role === "ADMIN" || role === "RECEPTIONIST";
  // Receptionist and Lab Tech can see the list but NOT drill into clinical detail.
  const canViewDetail = role === "ADMIN" || role === "DOCTOR" || role === "NURSE" || role === "LAB_TECHNICIAN";

  // Fetch a broad set once, then search/filter client-side for instant counts.
  const { data: all = [], isLoading } = useQuery<Patient[]>({
    queryKey: ["patients", "all"],
    queryFn: async () => (await api.get("/patients", { params: { limit: 200 } })).data,
  });

  const bloodGroups = useMemo(
    () => Array.from(new Set(all.map((p) => p.blood_group).filter(Boolean))).sort() as string[],
    [all]
  );

  const data = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter((p) => {
      if (gender !== "ALL" && p.gender !== gender) return false;
      if (blood !== "ALL" && p.blood_group !== blood) return false;
      if (!q) return true;
      return (
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
        p.mrn.toLowerCase().includes(q) ||
        (p.phone ?? "").toLowerCase().includes(q)
      );
    });
  }, [all, search, gender, blood]);

  const stats = useMemo(
    () => ({
      total: all.length,
      male: all.filter((p) => p.gender === "MALE").length,
      female: all.filter((p) => p.gender === "FEMALE").length,
      avgAge: all.length
        ? Math.round(all.reduce((s, p) => s + p.age, 0) / all.length)
        : 0,
    }),
    [all]
  );

  return (
    <div>
      <PageHeader
        title={role === "DOCTOR" ? "My Patients" : "Patients"}
        subtitle={role === "DOCTOR" ? "Patients associated with your appointments" : "Manage patient records and demographics"}
        icon={Users}
        action={
          canRegister ? (
            <button onClick={() => setRegisterOpen(true)} className="btn-primary">
              <UserPlus className="h-4 w-4" /> Register Patient
            </button>
          ) : undefined
        }
      />

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Patients" value={stats.total} grad="from-blue-500 to-blue-600" />
        <StatCard label="Male" value={stats.male} grad="from-cyan-500 to-sky-600" />
        <StatCard label="Female" value={stats.female} grad="from-rose-500 to-pink-600" />
        <StatCard label="Avg. Age" value={stats.avgAge} grad="from-violet-500 to-purple-600" />
      </div>

      {/* Search + filters */}
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="input pl-10"
            placeholder="Search by name, MRN or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["ALL", "MALE", "FEMALE", "OTHER"] as GenderFilter[]).map((g) => (
            <Chip key={g} active={gender === g} onClick={() => setGender(g)}>
              {g === "ALL" ? "All genders" : g.charAt(0) + g.slice(1).toLowerCase()}
            </Chip>
          ))}
          {bloodGroups.length > 0 && (
            <select
              value={blood}
              onChange={(e) => setBlood(e.target.value)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 outline-none focus:ring-2 focus:ring-brand/30"
            >
              <option value="ALL">All blood groups</option>
              {bloodGroups.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          )}
        </div>
      </div>

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
                <th className="px-6 py-4">MRN</th>
                <th className="px-6 py-4">Age</th>
                <th className="px-6 py-4">Gender</th>
                <th className="px-6 py-4">Blood</th>
                <th className="px-6 py-4">Phone</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {data.map((p, i) => (
                  <motion.tr
                    key={p.patient_id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    onClick={() => canViewDetail && navigate(`/patients/${p.patient_id}`)}
                    className={`group border-b border-slate-50 transition-colors hover:bg-slate-50 ${canViewDetail ? "cursor-pointer" : "cursor-default"}`}
                  >
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${avatarColors[i % avatarColors.length]} text-sm font-bold text-white`}
                        >
                          {initials(p.first_name, p.last_name)}
                        </div>
                        <span className="font-semibold text-navy">
                          {p.first_name} {p.last_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600">
                        {p.mrn}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-sm text-slate-600">{p.age}</td>
                    <td className="px-6 py-3.5">
                      <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                        <UserRound className="h-3.5 w-3.5 text-slate-400" />
                        {p.gender}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      {p.blood_group ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600">
                          <Droplet className="h-3 w-3" />
                          {p.blood_group}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                        <Phone className="h-3.5 w-3.5 text-slate-400" />
                        {p.phone ?? "—"}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      {canViewDetail && (
                        <ChevronRight className="ml-auto h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
                      )}
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
              {data.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-slate-400">
                    <Users className="mx-auto mb-3 h-10 w-10 opacity-40" />
                    No patients found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </motion.div>

      <RegisterPatientForm open={registerOpen} onClose={() => setRegisterOpen(false)} />
    </div>
  );
}

function StatCard({ label, value, grad }: { label: string; value: number; grad: string }) {
  return (
    <div className="card relative overflow-hidden p-4">
      <div
        className={`absolute -right-4 -top-4 h-16 w-16 rounded-full bg-gradient-to-br ${grad} opacity-10`}
      />
      <p className="text-2xl font-extrabold text-navy">{value}</p>
      <p className="mt-0.5 text-xs font-medium text-slate-500">{label}</p>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? "bg-navy text-white"
          : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}
