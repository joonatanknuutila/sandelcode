"use client";

// The application chrome: HMD-branded navy sidebar (role-aware nav) + top bar
// with the role switcher and in-app notifications. Wraps every page.

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

  function switchRole(next: typeof role) {
    setRole(next);
    router.push(ROLES[next].home);
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="flex w-60 flex-col bg-hmd-charcoal text-white">
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
                className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
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
        <div className="border-t border-white/10 p-4 text-xs text-white/50">
          EU region · Entra ID SSO
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              {config.label}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* Role switcher — demo aid; replaced by SSO claims */}
            <label className="flex items-center gap-2 text-xs text-muted">
              View as
              <select
                value={activeRole}
                onChange={(e) => switchRole(e.target.value as Role)}
                className="rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground"
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
              <span className="grid h-8 w-8 place-items-center rounded-full bg-hmd-teal text-xs font-semibold text-hmd-charcoal">
                {user.initials}
              </span>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
