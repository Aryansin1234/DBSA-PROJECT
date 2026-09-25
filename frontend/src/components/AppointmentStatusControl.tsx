import { useRef, useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Loader2 } from "lucide-react";
import { api } from "../lib/api";
import { useToast } from "./Toast";
import { cn } from "../lib/cn";

// ── Status config ─────────────────────────────────────────────────────────────
export const STATUS_STYLES: Record<string, string> = {
  SCHEDULED:   "bg-blue-50    text-blue-600    ring-blue-200",
  IN_PROGRESS: "bg-amber-50   text-amber-600   ring-amber-200",
  COMPLETED:   "bg-emerald-50 text-emerald-600 ring-emerald-200",
  CANCELLED:   "bg-red-50     text-red-600     ring-red-200",
  NO_SHOW:     "bg-slate-100  text-slate-500   ring-slate-200",
};

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED:   "Scheduled",
  IN_PROGRESS: "In Progress",
  COMPLETED:   "Completed",
  CANCELLED:   "Cancelled",
  NO_SHOW:     "No Show",
};

const TRANSITIONS: Record<string, string[]> = {
  SCHEDULED:   ["IN_PROGRESS", "CANCELLED", "NO_SHOW"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED:   [],
  CANCELLED:   [],
  NO_SHOW:     [],
};

const ROLE_CAN_SET: Record<string, string[]> = {
  ADMIN:        ["IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"],
  DOCTOR:       ["IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"],
  NURSE:        ["IN_PROGRESS", "COMPLETED", "NO_SHOW"],
  RECEPTIONIST: ["CANCELLED"],
};

interface Props {
  appointmentId: string;
  currentStatus: string;
  role: string | null;
}

export default function AppointmentStatusControl({ appointmentId, currentStatus, role }: Props) {
  const [open, setOpen]           = useState(false);
  const [dropPos, setDropPos]     = useState({ top: 0, left: 0 });
  const triggerRef                = useRef<HTMLButtonElement>(null);
  const dropRef                   = useRef<HTMLDivElement>(null);
  const { toast }                 = useToast();
  const qc                        = useQueryClient();

  // Position the portal dropdown below the trigger button
  const positionDrop = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setDropPos({
      top:  rect.bottom + window.scrollY + 4,
      left: rect.left   + window.scrollX,
    });
  }, []);

  const toggle = () => {
    if (!canChange) return;
    if (!open) positionDrop();
    setOpen((o) => !o);
  };

  // Close on outside click or scroll
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        dropRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", close);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const mutation = useMutation({
    mutationFn: (newStatus: string) =>
      api.put(`/appointments/${appointmentId}/status`, { status: newStatus }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["appt-stats"] });
      qc.invalidateQueries({ queryKey: ["kpis"] });
      qc.invalidateQueries({ queryKey: ["patient-detail"] });
      qc.invalidateQueries({ queryKey: ["status-breakdown"] });
      setOpen(false);
    },
    onError: (e: any) =>
      toast(e?.response?.data?.detail ?? "Could not update status", "error"),
  });

  const validNext  = (TRANSITIONS[currentStatus] ?? []).filter(
    (s) => (ROLE_CAN_SET[role ?? ""] ?? []).includes(s)
  );
  const canChange  = validNext.length > 0;
  const badgeStyle = STATUS_STYLES[currentStatus] ?? "bg-slate-100 text-slate-600 ring-slate-200";

  const dropdown = open && validNext.length > 0
    ? createPortal(
        <div
          ref={dropRef}
          style={{ position: "absolute", top: dropPos.top, left: dropPos.left, zIndex: 9999 }}
          className="min-w-[170px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        >
          <p className="border-b border-slate-100 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Change status to
          </p>
          {validNext.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => mutation.mutate(s)}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-slate-50"
            >
              <span className={cn(
                "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
                STATUS_STYLES[s],
              )}>
                <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                {STATUS_LABELS[s]}
              </span>
            </button>
          ))}
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={!canChange || mutation.isPending}
        onClick={toggle}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset transition-all",
          badgeStyle,
          canChange  ? "cursor-pointer hover:opacity-80" : "cursor-default",
        )}
      >
        {mutation.isPending
          ? <Loader2 className="h-3 w-3 animate-spin" />
          : <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
        }
        {STATUS_LABELS[currentStatus] ?? currentStatus.replace("_", " ")}
        {canChange && (
          <ChevronDown className={cn("h-3 w-3 opacity-60 transition-transform", open && "rotate-180")} />
        )}
      </button>

      {dropdown}
    </>
  );
}
