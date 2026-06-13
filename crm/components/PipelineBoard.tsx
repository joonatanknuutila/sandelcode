"use client";

// Pipeline kanban (brief Block 3). One board, role-aware capabilities:
//  - rep    : drags their own cards between stages (optimistic; the move also
//             writes a timeline event server-side).
//  - manager: reassigns a card to another rep inline.
//  - finance: read-only (the route offers an "Open in forecast" link instead).
// Channel logic: reseller deals skip "Contract negotiation" (stage 5) — they
// cannot be dropped there and move customer_test → won/lost directly.

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Channel,
  Stage,
  STAGE_LABELS,
  STAGE_ORDER,
} from "@/lib/types";
import { eur } from "@/lib/format";
import { Badge } from "./ui";
import { toast } from "./ui-client";
import { moveDealStageAction } from "@/app/pipeline-actions";

export interface BoardDeal {
  id: string;
  accountName: string;
  dealName: string;
  ownerId: string;
  ownerInitials: string;
  tcv: number;
  channel: Channel;
  stage: Stage;
  /** Win probability as a 0–100 percent. */
  confidence: number;
  stalled: boolean;
  idleDays: number;
}

export interface RepOption {
  value: string;
  label: string;
}

interface Capabilities {
  canDrag: boolean;
  canReassign: boolean;
}

export function PipelineBoard({
  deals,
  capabilities,
  reps = [],
  dealHref,
  reassignAction,
}: {
  deals: BoardDeal[];
  capabilities: Capabilities;
  reps?: RepOption[];
  /** Card link base, e.g. "/rep/deals". Null = cards are not links. */
  dealHref?: string | null;
  reassignAction?: (dealId: string, newOwnerId: string) => Promise<void>;
}) {
  // Optimistic stage overrides keyed by deal id — the card jumps instantly.
  const [moved, setMoved] = useState<Record<string, Stage>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const stageOf = (d: BoardDeal): Stage => moved[d.id] ?? d.stage;

  function onDrop(target: Stage) {
    const id = dragId;
    setDragId(null);
    if (!id) return;
    const deal = deals.find((d) => d.id === id);
    if (!deal) return;
    if (deal.channel === "reseller" && target === "contract_negotiation") {
      toast("Reseller deals skip contract negotiation", { variant: "warning" });
      return;
    }
    if (stageOf(deal) === target) return;

    const previous = stageOf(deal);
    setMoved((m) => ({ ...m, [id]: target })); // optimistic
    startTransition(async () => {
      const res = await moveDealStageAction({ dealId: id, toStage: target });
      if (!res.ok) {
        setMoved((m) => ({ ...m, [id]: previous })); // revert
        toast(res.error ?? "Could not move the deal", { variant: "error" });
      } else {
        toast(`Moved to ${STAGE_LABELS[target]}`, { variant: "success" });
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
      {STAGE_ORDER.map((stage) => {
        const colDeals = deals.filter((d) => stageOf(d) === stage);
        const colValue = colDeals.reduce((s, d) => s + d.tcv, 0);
        return (
          <div
            key={stage}
            onDragOver={(e) => {
              if (capabilities.canDrag) e.preventDefault();
            }}
            onDrop={() => capabilities.canDrag && onDrop(stage)}
            className="flex min-h-[8rem] flex-col rounded-xl border border-border bg-surface"
          >
            <div className="border-b border-border px-3 py-2.5">
              <p className="text-xs font-semibold text-foreground">
                {STAGE_LABELS[stage]}
              </p>
              <p className="text-xs text-muted">
                {colDeals.length} · {eur(colValue)}
              </p>
            </div>
            <div className="flex-1 space-y-2 p-2">
              {colDeals.length === 0 && (
                <p className="px-1 py-3 text-xs text-muted">—</p>
              )}
              {colDeals.map((d) => {
                const card = (
                  <div
                    className={`rounded-lg border p-2.5 ${
                      d.stalled
                        ? "border-amber-400/45 bg-amber-400/10"
                        : "border-border bg-surface"
                    } ${capabilities.canDrag ? "cursor-grab active:cursor-grabbing" : ""} ${
                      dragId === d.id ? "opacity-50" : ""
                    }`}
                    draggable={capabilities.canDrag}
                    onDragStart={() => setDragId(d.id)}
                    onDragEnd={() => setDragId(null)}
                  >
                    {dealHref ? (
                      <Link
                        href={`${dealHref}/${d.id}`}
                        className="line-clamp-2 text-xs font-medium leading-snug hover:underline"
                        draggable={false}
                      >
                        {d.accountName}
                      </Link>
                    ) : (
                      <p className="line-clamp-2 text-xs font-medium leading-snug">
                        {d.accountName}
                      </p>
                    )}
                    <p className="mt-0.5 line-clamp-1 text-[0.7rem] text-muted">
                      {d.dealName}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {eur(d.tcv)}
                    </p>
                    {/* Confidence indicator */}
                    <div className="mt-1.5">
                      <div className="h-1 w-full overflow-hidden rounded-full bg-border">
                        <div
                          className="h-full rounded-full bg-hmd-teal"
                          style={{ width: `${Math.max(4, d.confidence)}%` }}
                        />
                      </div>
                      <p className="mt-0.5 text-[0.65rem] text-muted">
                        {d.confidence}% confidence
                      </p>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      <Badge>{d.ownerInitials}</Badge>
                      <Badge tone={d.channel === "reseller" ? "amber" : "blue"}>
                        {d.channel}
                      </Badge>
                      {d.stalled && (
                        <Badge tone="amber">{d.idleDays}d idle</Badge>
                      )}
                    </div>
                    {capabilities.canReassign && reassignAction && (
                      <div className="mt-2">
                        <ReassignSelect
                          dealId={d.id}
                          currentOwnerId={d.ownerId}
                          reps={reps}
                          action={reassignAction}
                        />
                      </div>
                    )}
                  </div>
                );
                return <div key={d.id}>{card}</div>;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ReassignSelect({
  dealId,
  currentOwnerId,
  reps,
  action,
}: {
  dealId: string;
  currentOwnerId: string;
  reps: RepOption[];
  action: (dealId: string, newOwnerId: string) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    if (!next || next === currentOwnerId) return;
    startTransition(async () => {
      try {
        await action(dealId, next);
        toast("Reassigned — both reps notified", { variant: "success" });
      } catch {
        toast("Could not reassign", { variant: "error" });
      }
    });
  }
  return (
    <select
      aria-label="Reassign to rep"
      value={currentOwnerId}
      onChange={onChange}
      disabled={pending}
      className="w-full rounded-md border border-border bg-surface px-2 py-1 text-xs text-foreground outline-none focus:border-hmd-teal disabled:opacity-50"
    >
      {reps.map((r) => (
        <option key={r.value} value={r.value}>
          {r.label}
        </option>
      ))}
    </select>
  );
}
