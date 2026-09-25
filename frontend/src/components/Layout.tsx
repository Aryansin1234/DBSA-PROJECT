import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { LogOut, Stethoscope } from "lucide-react";
import { useAuthStore } from "../store/auth";
import { navForRole, roleMeta } from "../lib/roles";
import { cn } from "../lib/cn";

export default function Layout() {
  const { role, user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const items = navForRole(role);
  const meta = roleMeta(role);
  const RoleIcon = meta.icon;
  const displayName = user?.name || meta.label;
  const initials = (user?.name || meta.short)
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar — sticky, full viewport height so nothing needs scrolling */}
      <motion.aside
        initial={{ x: -40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 120, damping: 18 }}
        className="sticky top-0 flex h-screen w-64 flex-col bg-gradient-to-b from-navy-800 via-navy-700 to-navy-900 px-4 py-5 text-white"
      >
        {/* decorative glow */}
        <div className="pointer-events-none absolute -right-16 top-20 h-40 w-40 rounded-full bg-brand/20 blur-3xl" />

        {/* Brand */}
        <div className="mb-6 flex items-center gap-3 px-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand shadow-glow">
            <Stethoscope className="h-6 w-6" strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="text-lg font-extrabold leading-tight">MediTrack</h1>
            <p className="text-[11px] font-medium text-slate-300">Clinical Suite</p>
          </div>
        </div>

        {/* User card — kept at the top so it's always visible (no scrolling) */}
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-sm font-bold text-white shadow-soft",
                meta.gradient
              )}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight">{displayName}</p>
              <p className="truncate text-[11px] text-slate-300">
                {user?.email ?? "—"}
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold">
              <RoleIcon className="h-3.5 w-3.5 text-brand-light" />
              {meta.label}
            </span>
            {user?.department && (
              <span className="truncate rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-slate-300">
                {user.department}
              </span>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-1.5 overflow-y-auto">
          {items.map((item, i) => (
            <motion.div
              key={item.to}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.1 + i * 0.08 }}
            >
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn("nav-link", isActive && "nav-link-active")
                }
              >
                <item.icon className="h-[18px] w-[18px]" />
                {item.label}
              </NavLink>
            </motion.div>
          ))}
        </nav>

        {/* Logout pinned to bottom */}
        <div className="mt-auto pt-4">
          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold transition-all hover:bg-red-500/90"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </motion.aside>

      {/* Main content */}
      <main className="h-screen flex-1 overflow-y-auto bg-slate-50 px-10 py-8">
        <Outlet />
      </main>
    </div>
  );
}
