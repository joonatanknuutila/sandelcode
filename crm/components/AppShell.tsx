"use client";

// The application chrome: HMD-branded navy sidebar (role-aware nav) + top bar
// with the role switcher and in-app notifications. Wraps every page.

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "./Logo";
import { useRole } from "./RoleProvider";
import { ROLES, ROLE_ORDER } from "@/lib/roles";
import { NotificationCenter } from "./NotificationCenter";
import { SearchCommand } from "./SearchCommand";
import type { AppNotification, Role } from "@/lib/types";

function roleFromPath(pathname: string): Role | null {
  if (pathname === "/tam" || pathname.startsWith("/tam/")) return "tam";
  if (pathname === "/sm" || pathname.startsWith("/sm/")) return "sm";
  if (pathname === "/finance" || pathname.startsWith("/finance/")) {
    return "finance";
  }
  if (pathname === "/rep" || pathname.startsWith("/rep/")) return "rep";
  return null;
}

export function AppShell({
  children,
  user,
  notifications = [],
}: {
  children: React.ReactNode;
  user: { name: string; initials: string };
  notifications?: AppNotification[];
}) {
  const { role, setRole } = useRole();
  const pathname = usePathname();
  const router = useRouter();
  const activeRole = roleFromPath(pathname) ?? role;
  const config = ROLES[activeRole];
  // Reps are non-technical: give them larger nav targets + plainer chrome.
  const repView = activeRole === "rep";
  // Mobile nav drawer (md+ shows the sidebar statically; below md it slides in).
  const [navOpen, setNavOpen] = useState(false);
  // Close the drawer whenever the route changes (tapping a nav link navigates).
  useEffect(() => setNavOpen(false), [pathname]);

  function switchRole(next: typeof role) {
    setRole(next);
    router.push(ROLES[next].home);
  }

  return (
    <div className="flex min-h-screen">
      {/* Backdrop behind the mobile drawer */}
      {navOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setNavOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — static at md+, off-canvas drawer below md */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 transform flex-col bg-hmd-charcoal text-white transition-transform duration-200 md:static md:w-60 md:translate-x-0 ${
          navOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="border-b border-white/10 px-5 py-4">
          <Link href={config.home}>
            <Logo light />
          </Link>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {config.nav.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== config.home && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-md px-3 font-medium transition-colors ${
                  repView ? "py-3 text-base" : "py-2 text-sm"
                } ${
                  active
                    ? "bg-hmd-teal font-semibold text-hmd-charcoal"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className={`border-t border-white/10 p-4 text-white/50 ${repView ? "text-sm" : "text-xs"}`}>
          {repView ? "🔒 Secure · EU" : "EU region · Entra ID SSO"}
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-2 border-b border-border bg-surface px-4 py-3 md:px-6">
          <div className="flex items-center gap-2">
            {/* Hamburger — opens the nav drawer below md */}
            <button
              type="button"
              onClick={() => setNavOpen(true)}
              aria-label="Open navigation"
              className="-ml-1 grid h-10 w-10 place-items-center rounded-md text-muted hover:bg-background hover:text-foreground md:hidden"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <p className={`font-medium uppercase tracking-wide text-muted ${repView ? "text-sm" : "text-xs"}`}>
              {config.label}
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Role switcher — demo aid; replaced by SSO claims */}
            <label className={`flex items-center gap-2 text-muted ${repView ? "text-sm" : "text-xs"}`}>
              <span className="hidden sm:inline">View as</span>
              <select
                value={activeRole}
                onChange={(e) => switchRole(e.target.value as Role)}
                className={`rounded-md border border-border bg-background px-2 font-medium text-foreground ${repView ? "min-h-11 py-2 text-sm" : "py-1 text-xs"}`}
              >
                {ROLE_ORDER.map((r) => (
                  <option key={r} value={r}>
                    {ROLES[r].label}
                  </option>
                ))}
              </select>
            </label>
            <SearchCommand />
            <NotificationCenter notifications={notifications} />
            <div className="flex items-center gap-2">
              <span className={`grid place-items-center rounded-full bg-hmd-teal font-semibold text-hmd-charcoal ${repView ? "h-10 w-10 text-sm" : "h-8 w-8 text-xs"}`}>
                {user.initials}
              </span>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
