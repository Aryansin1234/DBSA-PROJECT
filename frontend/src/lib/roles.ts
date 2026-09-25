import {
  LayoutDashboard,
  Users,
  CalendarDays,
  ScrollText,
  Sparkles,
  Stethoscope,
  ShieldCheck,
  HeartPulse,
  FlaskConical,
  ClipboardList,
  TestTube2,
  type LucideIcon,
} from "lucide-react";

export type Role =
  | "ADMIN"
  | "DOCTOR"
  | "NURSE"
  | "LAB_TECHNICIAN"
  | "RECEPTIONIST";

export interface RoleMeta {
  label: string;
  short: string;
  icon: LucideIcon;
  /** Tailwind gradient for the role badge/avatar. */
  gradient: string;
  /** Soft accent classes for chips. */
  chip: string;
  tagline: string;
}

export const ROLE_META: Record<string, RoleMeta> = {
  ADMIN: {
    label: "Administrator",
    short: "Admin",
    icon: ShieldCheck,
    gradient: "from-violet-500 to-purple-600",
    chip: "bg-violet-50 text-violet-700",
    tagline: "Full system oversight & governance",
  },
  DOCTOR: {
    label: "Doctor",
    short: "Doctor",
    icon: Stethoscope,
    gradient: "from-brand to-brand-dark",
    chip: "bg-emerald-50 text-emerald-700",
    tagline: "Diagnose, prescribe & manage care",
  },
  NURSE: {
    label: "Nurse",
    short: "Nurse",
    icon: HeartPulse,
    gradient: "from-rose-500 to-pink-600",
    chip: "bg-rose-50 text-rose-700",
    tagline: "Patient monitoring & clinical support",
  },
  LAB_TECHNICIAN: {
    label: "Lab Technician",
    short: "Lab Tech",
    icon: FlaskConical,
    gradient: "from-cyan-500 to-sky-600",
    chip: "bg-cyan-50 text-cyan-700",
    tagline: "Process orders & enter lab results",
  },
  RECEPTIONIST: {
    label: "Receptionist",
    short: "Front Desk",
    icon: ClipboardList,
    gradient: "from-amber-500 to-orange-600",
    chip: "bg-amber-50 text-amber-700",
    tagline: "Register patients & book appointments",
  },
};

export function roleMeta(role?: string | null): RoleMeta {
  return (role && ROLE_META[role]) || ROLE_META.ADMIN;
}

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  roles: Role[] | "all";
}

/** Sidebar navigation, filtered per role. */
export const NAV_ITEMS: NavItem[] = [
  { to: "/",          label: "Dashboard",    icon: LayoutDashboard, end: true, roles: "all" },
  { to: "/patients",  label: "Patients",     icon: Users,           roles: "all" },
  {
    to: "/appointments",
    label: "Appointments",
    icon: CalendarDays,
    roles: ["ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST"],
  },
  {
    to: "/lab-queue",
    label: "Lab Queue",
    icon: TestTube2,
    roles: ["LAB_TECHNICIAN", "ADMIN"],
  },
  {
    to: "/insights",
    label: "SQL Insights",
    icon: Sparkles,
    roles: ["ADMIN"],
  },
  { to: "/audit",     label: "Audit Log",    icon: ScrollText, roles: ["ADMIN"] },
];

export function navForRole(role?: string | null): NavItem[] {
  return NAV_ITEMS.filter(
    (item) => item.roles === "all" || (role && (item.roles as Role[]).includes(role as Role))
  );
}
