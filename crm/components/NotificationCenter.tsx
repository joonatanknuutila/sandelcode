"use client";

// In-app notification bell — mounts in the AppShell top bar.
// Receives pre-fetched notifications from the server parent (AppShell / layout).
// Clicking a notification: calls markReadAction + navigates to the entity deep link.

import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AppNotification } from "@/lib/types";
import { markReadAction } from "@/app/actions";

// ---------------------------------------------------------------------------
// Entity → route map
// ---------------------------------------------------------------------------
// The mapper in lib/db/mappers.ts resolves href for deal + account already.
// For case and offer the href is undefined — we fall back to safe defaults.
function resolveHref(n: AppNotification): string | null {
  if (n.href) return n.href;
  // href is undefined when entity_type is case or offer (mapper gap).
  // Derive from body/title text is unreliable, so link to the dashboard root
  // — better than a dead link. Parallel agents may extend the mapper later.
  return null;
}

// ---------------------------------------------------------------------------
// Bell icon SVG
// ---------------------------------------------------------------------------
function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Relative time helper
// ---------------------------------------------------------------------------
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// NotificationCenter
// ---------------------------------------------------------------------------
export function NotificationCenter({
  notifications: initialNotifications,
}: {
  notifications: AppNotification[];
}) {
  const [optimisticReadIds, setOptimisticReadIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const notifications = initialNotifications.map((n) =>
    optimisticReadIds.has(n.id) ? { ...n, read: true } : n,
  );

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  function handleNotificationClick(n: AppNotification) {
    // Optimistically mark read in local state
    setOptimisticReadIds((prev) => {
      const next = new Set(prev);
      next.add(n.id);
      return next;
    });
    setOpen(false);

    // Persist via server action (fire-and-forget; revalidatePath updates server)
    startTransition(() => {
      markReadAction(n.id).catch(() => {
        // Roll back optimistic update on failure
        setOptimisticReadIds((prev) => {
          const next = new Set(prev);
          next.delete(n.id);
          return next;
        });
      });
    });

    // Navigate to the deep link
    const href = resolveHref(n);
    if (href) router.push(href);
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        type="button"
        aria-label={
          unreadCount > 0
            ? `${unreadCount} unread notifications`
            : "Notifications"
        }
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-background hover:text-foreground"
      >
        <BellIcon className="h-5 w-5" />
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none"
            style={{ background: "#e4ff00", color: "#000000" }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-10 z-50 w-80 rounded-xl border border-border bg-surface shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold text-foreground">
              Notifications
            </span>
            {unreadCount > 0 && (
              <span
                className="rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none"
                style={{ background: "#e4ff00", color: "#000000" }}
              >
                {unreadCount} new
              </span>
            )}
          </div>

          {/* List */}
          <ul className="max-h-[400px] overflow-y-auto divide-y divide-border">
            {notifications.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-muted">
                No notifications yet
              </li>
            ) : (
              notifications.map((n) => {
                const href = resolveHref(n);
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleNotificationClick(n)}
                      className={`w-full px-4 py-3 text-left transition-colors hover:bg-background ${
                        !n.read ? "bg-surface" : "opacity-70"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        {/* Unread dot */}
                        <span
                          aria-hidden="true"
                          className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${
                            !n.read ? "bg-[#e4ff00]" : "bg-transparent"
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-sm leading-snug ${
                              !n.read
                                ? "font-medium text-foreground"
                                : "text-muted"
                            }`}
                          >
                            {n.body}
                          </p>
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-xs text-muted">
                              {relativeTime(n.createdAt)}
                            </span>
                            {href && (
                              <span className="text-xs font-medium text-foreground">
                                View →
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })
            )}
          </ul>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-border px-4 py-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push("/");
                }}
                className="text-xs text-muted hover:text-foreground"
              >
                View all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
