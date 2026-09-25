import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollText, Database, Plus, Pencil, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import PageHeader from "../components/PageHeader";
import { useAuthStore } from "../store/auth";

interface AuditEntry {
  audit_id: number;
  table_name: string;
  operation: string;
  user_id: string | null;
  changed_at: string;
}

const opConfig: Record<string, { icon: typeof Plus; color: string }> = {
  INSERT: { icon: Plus, color: "bg-emerald-50 text-emerald-600" },
  UPDATE: { icon: Pencil, color: "bg-amber-50 text-amber-600" },
  DELETE: { icon: Trash2, color: "bg-red-50 text-red-600" },
};

export default function AuditLogPage() {
  const role = useAuthStore((s) => s.role);
  const isAdmin = role === "ADMIN";

  const { data, isLoading } = useQuery<AuditEntry[]>({
    queryKey: ["audit"],
    queryFn: async () => (await api.get("/audit", { params: { limit: 100 } })).data,
    enabled: isAdmin,
  });

  const fmt = (iso: string) => new Date(iso).toLocaleString(undefined, {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  return (
    <div>
      <PageHeader
        title="Audit Log"
        subtitle="Database change history captured by PostgreSQL triggers"
        icon={ScrollText}
      />

      {!isAdmin ? (
        <div className="card p-16 text-center text-slate-400">
          <ScrollText className="mx-auto mb-3 h-10 w-10 opacity-40" />
          Audit history is restricted to administrators.
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card overflow-hidden">
          {isLoading ? (
            <div className="space-y-3 p-6">
              {[...Array(6)].map((_, i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-6 py-4">Operation</th>
                  <th className="px-6 py-4">Table</th>
                  <th className="px-6 py-4">Changed at</th>
                  <th className="px-6 py-4">User</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {data?.map((e, i) => {
                    const cfg = opConfig[e.operation] ?? { icon: Database, color: "bg-slate-100 text-slate-500" };
                    const Icon = cfg.icon;
                    return (
                      <motion.tr
                        key={e.audit_id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.02 }}
                        className="border-b border-slate-50 transition-colors hover:bg-slate-50"
                      >
                        <td className="px-6 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.color}`}>
                            <Icon className="h-3 w-3" />{e.operation}
                          </span>
                        </td>
                        <td className="px-6 py-3.5">
                          <span className="inline-flex items-center gap-1.5 font-mono text-xs text-slate-600">
                            <Database className="h-3.5 w-3.5 text-slate-400" />{e.table_name}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 text-sm text-slate-600">{fmt(e.changed_at)}</td>
                        <td className="px-6 py-3.5 font-mono text-xs text-slate-400">{e.user_id?.slice(0, 8) ?? "system"}</td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
                {data?.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-16 text-center text-slate-400">
                      <ScrollText className="mx-auto mb-3 h-10 w-10 opacity-40" />
                      No audit entries yet — perform a write action to generate history.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </motion.div>
      )}
    </div>
  );
}
