"use client";

// Demo "login": no passwords — pick one of the four HMD Secure personas and the
// app drops you into that role's view. Sets the role (persisted to localStorage
// by RoleProvider) and routes to the role home. Real SSO (Entra ID, owned by
// Arttu) replaces this picker; until then it is the front door to the demo.

import { useRouter } from "next/navigation";
import { Logo } from "./Logo";
import { useRole } from "./RoleProvider";
import { ROLES, ROLE_ORDER } from "@/lib/roles";
import type { Role } from "@/lib/types";

// One line of context per persona so the buttons read as real sign-ins, not
// abstract role names.
const BLURB: Record<Role, string> = {
  rep: "Accounts, deals & offers",
  tam: "Cases & service health",
  sm: "Team pipeline & forecast",
  finance: "Forecast, targets & catalog",
};

// Simple line glyphs — stroke uses currentColor so they pick up the hover tint.
const ICON: Record<Role, React.ReactNode> = {
  rep: (
    <path d="M3 21V8l9-5 9 5v13M9 21v-6h6v6" strokeLinecap="round" strokeLinejoin="round" />
  ),
  tam: (
    <path d="M12 3l8 4v5c0 4.4-3.4 7.5-8 9-4.6-1.5-8-4.6-8-9V7l8-4zM9.5 12l1.8 1.8L15 10" strokeLinecap="round" strokeLinejoin="round" />
  ),
  sm: (
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" strokeLinecap="round" strokeLinejoin="round" />
  ),
  finance: (
    <path d="M12 2v20M17 6H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" strokeLinecap="round" strokeLinejoin="round" />
  ),
};

export function LoginScreen() {
  const { setRole } = useRole();
  const router = useRouter();

  function signIn(role: Role) {
    setRole(role);
    router.push(ROLES[role].home);
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-background px-5 py-12">
      {/* Atmosphere: a single electric-lime glow + a faint security-grade grid. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-1/3 left-1/2 h-[60rem] w-[60rem] -translate-x-1/2 rounded-full opacity-[0.10] blur-3xl"
        style={{ background: "radial-gradient(circle, var(--hmd-teal) 0%, transparent 60%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />

      <div className="relative w-full max-w-2xl">
        <header
          className="mb-10 flex flex-col items-center text-center"
          style={{ animation: "login-rise .5s ease both" }}
        >
          <div className="scale-125">
            <Logo />
          </div>
          <h1 className="mt-7 text-2xl font-semibold tracking-tight text-foreground">
            Sign in to the CRM
          </h1>
          <p className="mt-2 text-sm text-muted">
            Choose a persona to enter the demo — no password required.
          </p>
        </header>

        <div className="grid gap-3 sm:grid-cols-2">
          {ROLE_ORDER.map((role, i) => (
            <button
              key={role}
              type="button"
              onClick={() => signIn(role)}
              style={{ animation: "login-rise .5s ease both", animationDelay: `${80 + i * 70}ms` }}
              className="group flex items-center gap-4 rounded-xl border border-border bg-surface p-4 text-left transition-all hover:-translate-y-0.5 hover:border-hmd-teal hover:bg-hmd-charcoal-soft focus:outline-none focus-visible:border-hmd-teal focus-visible:ring-2 focus-visible:ring-hmd-teal/40"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-background text-muted transition-colors group-hover:bg-hmd-teal group-hover:text-hmd-charcoal">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden>
                  {ICON[role]}
                </svg>
              </span>
              <span className="min-w-0">
                <span className="block font-semibold tracking-tight text-foreground">
                  {ROLES[role].label}
                </span>
                <span className="block text-xs text-muted">{BLURB[role]}</span>
              </span>
              <svg
                className="ml-auto shrink-0 text-muted opacity-0 transition-all group-hover:translate-x-0.5 group-hover:text-hmd-teal group-hover:opacity-100"
                width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden
              >
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ))}
        </div>

        <p
          className="mt-8 text-center text-xs text-muted"
          style={{ animation: "login-rise .5s ease both", animationDelay: "400ms" }}
        >
          🔒 EU region · Entra ID SSO replaces this picker in production
        </p>
      </div>
    </main>
  );
}
