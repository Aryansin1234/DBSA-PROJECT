import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { gsap } from "gsap";
import axios from "axios";
import {
  Stethoscope,
  Mail,
  Lock,
  ArrowRight,
  Activity,
  ShieldCheck,
  HeartPulse,
  Loader2,
} from "lucide-react";
import { useAuthStore } from "../store/auth";
import { ROLE_META } from "../lib/roles";

const DEMO_ACCOUNTS = [
  { role: "ADMIN", email: "admin@meditrack.dev", password: "Admin@123" },
  { role: "DOCTOR", email: "doctor@meditrack.dev", password: "Doctor@123" },
  { role: "NURSE", email: "nurse@meditrack.dev", password: "Staff@123" },
  { role: "LAB_TECHNICIAN", email: "lab@meditrack.dev", password: "Staff@123" },
  { role: "RECEPTIONIST", email: "reception@meditrack.dev", password: "Staff@123" },
];

export default function LoginPage() {
  const [email, setEmail] = useState("admin@meditrack.dev");
  const [password, setPassword] = useState("Admin@123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);
  const navigate = useNavigate();
  const heroRef = useRef<HTMLDivElement>(null);

  // GSAP: animate floating orbs + hero stats on mount
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.to(".orb", {
        y: "random(-30, 30)",
        x: "random(-20, 20)",
        duration: "random(4, 7)",
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
        stagger: 0.3,
      });
      gsap.from(".hero-stat", {
        y: 30,
        opacity: 0,
        duration: 0.8,
        stagger: 0.15,
        delay: 0.4,
        ease: "power3.out",
      });
    }, heroRef);
    return () => ctx.revert();
  }, []);

  const pickDemo = (acc: (typeof DEMO_ACCOUNTS)[number]) => {
    setEmail(acc.email);
    setPassword(acc.password);
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // OAuth2 password flow expects form-encoded username/password.
      const form = new URLSearchParams();
      form.append("username", email);
      form.append("password", password);
      const { data } = await axios.post("/api/auth/login", form, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      setTokens(data.access_token, data.refresh_token, data.role);
      // Fetch the signed-in identity for the sidebar / dashboard.
      try {
        const me = await axios.get("/api/auth/me", {
          headers: { Authorization: `Bearer ${data.access_token}` },
        });
        setUser(me.data);
      } catch {
        setUser(null);
      }
      navigate("/");
    } catch {
      setError("Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* ---------- Left: animated brand hero ---------- */}
      <div
        ref={heroRef}
        className="relative hidden overflow-hidden bg-gradient-to-br from-navy-900 via-navy-800 to-navy-700 lg:flex lg:flex-col lg:justify-between lg:p-14"
      >
        {/* animated gradient mesh + orbs */}
        <div className="orb pointer-events-none absolute -left-20 top-10 h-72 w-72 rounded-full bg-brand/30 blur-3xl" />
        <div className="orb pointer-events-none absolute right-0 top-1/3 h-80 w-80 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="orb pointer-events-none absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-emerald-400/20 blur-3xl" />

        <div className="relative z-10 flex items-center gap-3 text-white">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand shadow-glow">
            <Stethoscope className="h-7 w-7" />
          </div>
          <span className="text-2xl font-extrabold tracking-tight">MediTrack</span>
        </div>

        <div className="relative z-10 text-white">
          <motion.h2
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.7 }}
            className="max-w-md text-4xl font-extrabold leading-tight"
          >
            Smart clinical records,
            <span className="text-brand-light"> beautifully organised.</span>
          </motion.h2>
          <motion.p
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="mt-4 max-w-md text-slate-300"
          >
            Manage patients, appointments, diagnoses, prescriptions and lab
            investigations — all in one secure, role-aware platform.
          </motion.p>

          <div className="mt-10 flex gap-4">
            {[
              { icon: Activity, label: "Real-time", value: "Analytics" },
              { icon: ShieldCheck, label: "Role-based", value: "Security" },
              { icon: HeartPulse, label: "Clinical", value: "Records" },
            ].map((s) => (
              <div
                key={s.value}
                className="hero-stat flex-1 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
              >
                <s.icon className="mb-2 h-5 w-5 text-brand-light" />
                <p className="text-xs text-slate-400">{s.label}</p>
                <p className="font-semibold text-white">{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs text-slate-400">
          © 2026 MediTrack · BITS Pilani WILP · SESAP ZC337
        </p>
      </div>

      {/* ---------- Right: login form ---------- */}
      <div className="flex items-center justify-center bg-slate-50 px-6 py-12">
        <motion.form
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          onSubmit={handleSubmit}
          className="w-full max-w-md"
        >
          {/* mobile logo */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy text-white">
              <Stethoscope className="h-6 w-6" />
            </div>
            <span className="text-xl font-extrabold text-navy">MediTrack</span>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-navy">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Sign in to access your clinical dashboard.
          </p>

          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600"
            >
              {error}
            </motion.div>
          )}

          <div className="mt-8 space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-600">
                Email address
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  required
                  className="input pl-10"
                  placeholder="you@hospital.com"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-600">
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  required
                  className="input pl-10"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.98 }}
            className="btn-primary mt-8 w-full"
            type="submit"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Signing in…
              </>
            ) : (
              <>
                Sign In <ArrowRight className="h-4 w-4" />
              </>
            )}
          </motion.button>

          <div className="mt-6">
            <p className="mb-2 text-center text-xs font-medium text-slate-500">
              Quick demo login — pick a role
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {DEMO_ACCOUNTS.map((acc) => {
                const meta = ROLE_META[acc.role];
                const Icon = meta.icon;
                const active = email === acc.email;
                return (
                  <button
                    key={acc.role}
                    type="button"
                    onClick={() => pickDemo(acc)}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-all ${
                      active
                        ? "border-brand bg-brand/10 text-brand-dark"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${meta.gradient} text-white`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="truncate">{meta.short}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </motion.form>
      </div>
    </div>
  );
}
