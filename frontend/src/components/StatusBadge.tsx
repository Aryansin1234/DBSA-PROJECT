import { cn } from "../lib/cn";

const styles: Record<string, string> = {
  SCHEDULED: "bg-blue-50 text-blue-600 ring-blue-200",
  IN_PROGRESS: "bg-amber-50 text-amber-600 ring-amber-200",
  COMPLETED: "bg-emerald-50 text-emerald-600 ring-emerald-200",
  CANCELLED: "bg-red-50 text-red-600 ring-red-200",
  NO_SHOW: "bg-slate-100 text-slate-500 ring-slate-200",
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        styles[status] ?? "bg-slate-100 text-slate-600 ring-slate-200"
      )}
    >
      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {status.replace("_", " ")}
    </span>
  );
}
