"use client";

// ⌘K command bar — cross-entity global search (brief P1).
// Mounts once in the AppShell top bar so every role gets it. The actual search
// is role-scoped server-side (app/search-actions -> lib/db/search); this
// component is the keyboard-driven shell around it.
//
// Keyboard contract:
//   ⌘K / Ctrl-K  open      Esc        close
//   ↑ / ↓        move       Enter      open the highlighted record
//
// Styling reuses the app chrome (bg-surface / border-border, lime #e4ff00 accent
// with black text) — same primitives as NotificationCenter and the Modal.

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { searchAction } from "@/app/search-actions";
import type { SearchHit, SearchResults } from "@/lib/db/search";

const EMPTY: SearchResults = { accounts: [], deals: [], cases: [] };

// One flat, ordered list of the visible rows + their group label, so arrow-key
// navigation can index straight into it regardless of grouping.
interface FlatRow {
  hit: SearchHit;
  group: string;
}

function flatten(results: SearchResults): FlatRow[] {
  return [
    ...results.accounts.map((hit) => ({ hit, group: "Accounts" })),
    ...results.deals.map((hit) => ({ hit, group: "Deals" })),
    ...results.cases.map((hit) => ({ hit, group: "Cases" })),
  ];
}

function SearchIcon({ className }: { className?: string }) {
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
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function SearchCommand() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [active, setActive] = useState(0);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => flatten(results), [results]);
  const hasQuery = query.trim().length > 0;

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults(EMPTY);
    setActive(0);
  }, []);

  // Global ⌘K / Ctrl-K to open (and toggle closed).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Focus the input when the palette opens.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Debounced, role-scoped search via the server action. A blank query is
  // handled in the change handler (it clears results), so the effect only
  // schedules a fetch — its setState runs async inside the transition callback,
  // never synchronously in the effect body.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q) return;
    const handle = setTimeout(() => {
      startTransition(async () => {
        const next = await searchAction(q);
        setResults(next);
        setActive(0);
      });
    }, 140);
    return () => clearTimeout(handle);
  }, [query, open]);

  // Update the query; clear results immediately when emptied (kept out of the
  // effect so we never setState synchronously inside one).
  function onQueryChange(value: string) {
    setQuery(value);
    if (!value.trim()) {
      setResults(EMPTY);
      setActive(0);
    }
  }

  const go = useCallback(
    (hit: SearchHit) => {
      close();
      router.push(hit.href);
    },
    [close, router],
  );

  // In-palette keyboard nav: arrows move, Enter opens, Esc closes.
  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (rows.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % rows.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + rows.length) % rows.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const row = rows[active];
      if (row) go(row.hit);
    }
  }

  // Keep the highlighted row scrolled into view.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-row="${active}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  // The flat index where each group starts, so we can render group headers.
  const groupStart = useMemo(() => {
    const map: Record<string, number> = {};
    rows.forEach((row, i) => {
      if (!(row.group in map)) map[row.group] = i;
    });
    return map;
  }, [rows]);

  return (
    <>
      {/* Trigger — sits in the top bar next to the bell. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search accounts, deals and cases"
        className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-muted transition-colors hover:border-hmd-teal/50 hover:text-foreground"
      >
        <SearchIcon className="h-4 w-4" />
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden rounded border border-border px-1 font-mono text-[10px] text-muted sm:inline">
          ⌘K
        </kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center pt-[12vh]"
          role="dialog"
          aria-modal="true"
          aria-label="Global search"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-hmd-teal-700/60 backdrop-blur-sm"
            onClick={close}
            aria-hidden="true"
          />

          {/* Panel */}
          <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-xl border border-border bg-surface shadow-2xl">
            {/* Input row */}
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <SearchIcon className="h-5 w-5 flex-shrink-0 text-muted" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder="Search accounts, deals, cases…"
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted outline-none"
                aria-label="Search query"
              />
              <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted">
                Esc
              </kbd>
            </div>

            {/* Results */}
            <div ref={listRef} className="max-h-[55vh] overflow-y-auto py-2">
              {!hasQuery ? (
                <p className="px-4 py-6 text-center text-sm text-muted">
                  Type to search across your accounts, deals and cases.
                </p>
              ) : rows.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted">
                  {isPending ? "Searching…" : `No matches for “${query.trim()}”.`}
                </p>
              ) : (
                rows.map((row, i) => (
                  <div key={`${row.group}-${row.hit.id}`}>
                    {groupStart[row.group] === i && (
                      <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wide text-muted">
                        {row.group}
                      </p>
                    )}
                    <button
                      type="button"
                      data-row={i}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(row.hit)}
                      className={`flex w-full items-center justify-between gap-3 px-4 py-2 text-left transition-colors ${
                        i === active ? "bg-hmd-teal text-hmd-charcoal" : "hover:bg-background"
                      }`}
                    >
                      <span className="min-w-0">
                        <span
                          className={`block truncate text-sm font-medium ${
                            i === active ? "text-hmd-charcoal" : "text-foreground"
                          }`}
                        >
                          {row.hit.title}
                        </span>
                        <span
                          className={`block truncate text-xs ${
                            i === active ? "text-hmd-charcoal/70" : "text-muted"
                          }`}
                        >
                          {row.hit.subtitle}
                        </span>
                      </span>
                      {i === active && (
                        <kbd className="flex-shrink-0 rounded bg-hmd-charcoal/10 px-1.5 py-0.5 font-mono text-[10px] text-hmd-charcoal">
                          ↵
                        </kbd>
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
