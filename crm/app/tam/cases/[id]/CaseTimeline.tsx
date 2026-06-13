"use client";

import { useState } from "react";
import { CaseNote, ServiceEvent, ServiceEventKind } from "@/lib/tam";
import { Card } from "@/components/ui";

// Unified case timeline: service-history events + case notes on ONE thread,
// newest first — so a TAM CC'd late has the whole story in one place. The
// toggle hides INTERNAL notes to give the exact customer-facing view (what the
// customer would see), the WORKING notes being the customer-safe ones.

const EVENT_DOT: Record<ServiceEventKind, string> = {
  deployed: "bg-hmd-teal-600",
  upgrade: "bg-hmd-teal-600",
  maintenance: "bg-hmd-gray",
  incident: "bg-danger",
  config: "bg-hmd-gray",
  case_opened: "bg-warning",
  case_resolved: "bg-success",
  escalation: "bg-warning",
  stage_change: "bg-hmd-teal-600",
  offer_sent: "bg-hmd-teal-600",
  call: "bg-hmd-gray",
  email: "bg-hmd-gray",
  meeting: "bg-hmd-gray",
  note: "bg-hmd-gray",
};

const EVENT_LABEL: Record<ServiceEventKind, string> = {
  deployed: "Deployed",
  upgrade: "Upgrade",
  maintenance: "Maintenance",
  incident: "Incident",
  config: "Config change",
  case_opened: "Case opened",
  case_resolved: "Case resolved",
  escalation: "Escalated",
  stage_change: "Stage change",
  offer_sent: "Offer sent",
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  note: "Activity",
};

type Item =
  | { kind: "event"; at: number; data: ServiceEvent }
  | { kind: "note"; at: number; data: CaseNote };

export function CaseTimeline({
  events,
  notes,
  authorNames,
}: {
  events: ServiceEvent[];
  notes: CaseNote[];
  /** Note author id -> display name, resolved server-side. */
  authorNames: Record<string, string>;
}) {
  const [showInternal, setShowInternal] = useState(true);

  const visibleNotes = notes.filter((n) => showInternal || n.visibility === "working");
  const items: Item[] = [
    ...events.map((e): Item => ({ kind: "event", at: +new Date(e.createdAt), data: e })),
    ...visibleNotes.map((n): Item => ({ kind: "note", at: +new Date(n.createdAt), data: n })),
  ].sort((a, b) => b.at - a.at);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-muted">
          {showInternal ? "Full internal view" : "Customer-facing view"} ·{" "}
          {items.length} entries
        </p>
        <button
          onClick={() => setShowInternal((v) => !v)}
          className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground hover:bg-background"
        >
          {showInternal ? "Hide internal notes" : "Show internal notes"}
        </button>
      </div>

      <Card className="p-4">
        <ol className="relative space-y-5 border-l border-border pl-5">
          {items.map((item) => {
            if (item.kind === "event") {
              const e = item.data;
              return (
                <li key={e.id} className="relative">
                  <span className={`absolute -left-[1.45rem] top-1 h-2.5 w-2.5 rounded-full ${EVENT_DOT[e.kind]} ring-2 ring-surface`} />
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">
                      {EVENT_LABEL[e.kind]}
                    </p>
                    <p className="text-xs text-muted">{new Date(e.createdAt).toLocaleString("en-IE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                  <p className="mt-0.5 text-sm">{e.body}</p>
                </li>
              );
            }
            const n = item.data;
            const authorName = authorNames[n.authorId];
            const internal = n.visibility === "internal";
            return (
              <li key={n.id} className="relative">
                <span className={`absolute -left-[1.45rem] top-1 h-2.5 w-2.5 rounded-full ${internal ? "bg-slate-400" : "bg-hmd-teal-600"} ring-2 ring-surface`} />
                <div className="flex items-center justify-between">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${internal ? "bg-slate-100 text-slate-600" : "bg-hmd-teal/30 text-hmd-charcoal"}`}>
                    {internal ? "Internal note" : "Working note"}
                  </span>
                  <p className="text-xs text-muted">{new Date(n.createdAt).toLocaleString("en-IE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                <p className={`mt-1 text-sm ${internal ? "" : "rounded-md bg-hmd-teal/10 px-2.5 py-1.5"}`}>{n.body}</p>
                {authorName && <p className="mt-0.5 text-xs text-muted">{authorName}</p>}
              </li>
            );
          })}
        </ol>
      </Card>
    </div>
  );
}
