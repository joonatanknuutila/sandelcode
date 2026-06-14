import Link from "next/link";
import {
  getAccounts,
  getAllDeals,
  getUsers,
  isStalled,
  isOverdue,
} from "@/lib/db";
import { Channel, Deal, dealProbability, Stage, STAGE_LABELS, STAGE_ORDER } from "@/lib/types";
import { relativeDays } from "@/lib/format";
import { BoardDeal, PipelineBoard, RepOption } from "@/components/PipelineBoard";
import { reassignDealAction } from "../actions";

// Sales Manager pipeline — the whole team's board. Filter by rep / stage /
// channel, restage cards by drag/drop, and reassign a deal inline. (The /sm
// war-room stays the dashboard; this is the kanban the brief asks for.)
function asStage(v: string | undefined): Stage | undefined {
  return v && STAGE_ORDER.includes(v as Stage) ? (v as Stage) : undefined;
}
function asChannel(v: string | undefined): Channel | undefined {
  return v === "direct" || v === "reseller" ? v : undefined;
}
// Close-date horizon filter — "by date" (brief P1: pipeline by stage/channel/date).
type CloseFilter = "overdue" | "quarter" | "year";
const CLOSE_LABELS: Record<CloseFilter, string> = {
  overdue: "Overdue",
  quarter: "This quarter",
  year: "This year",
};
function asClose(v: string | undefined): CloseFilter | undefined {
  return v === "overdue" || v === "quarter" || v === "year" ? v : undefined;
}
function matchesClose(deal: Deal, f: CloseFilter): boolean {
  if (f === "overdue") return isOverdue(deal);
  if (!deal.expectedCloseDate) return false;
  const close = new Date(deal.expectedCloseDate);
  const now = new Date();
  if (f === "year") return close.getFullYear() === now.getFullYear();
  // quarter: same calendar year + same quarter as today.
  return (
    close.getFullYear() === now.getFullYear() &&
    Math.floor(close.getMonth() / 3) === Math.floor(now.getMonth() / 3)
  );
}

export default async function SmPipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ rep?: string; stage?: string; channel?: string; close?: string }>;
}) {
  const sp = await searchParams;
  const repFilter = sp.rep;
  const stageFilter = asStage(sp.stage);
  const channelFilter = asChannel(sp.channel);
  const closeFilter = asClose(sp.close);

  const [deals, accounts, users] = await Promise.all([
    getAllDeals(),
    getAccounts(),
    getUsers(),
  ]);
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const userById = new Map(users.map((u) => [u.id, u]));
  const reps = users.filter((u) => u.role === "rep");
  const repOptions: RepOption[] = reps.map((u) => ({
    value: u.id,
    label: `${u.initials} · ${u.name}`,
  }));

  const filtered = deals.filter(
    (d) =>
      (!repFilter || d.ownerId === repFilter) &&
      (!stageFilter || d.stage === stageFilter) &&
      (!channelFilter || d.channel === channelFilter) &&
      (!closeFilter || matchesClose(d, closeFilter)),
  );

  const boardDeals: BoardDeal[] = filtered.map((d) => ({
    id: d.id,
    accountName: accountById.get(d.accountId)?.name ?? "Unknown account",
    dealName: d.name,
    ownerId: d.ownerId,
    ownerInitials: userById.get(d.ownerId)?.initials ?? "?",
    tcv: d.tcv,
    channel: d.channel,
    stage: d.stage,
    confidence: Math.round(dealProbability(d) * 100),
    stalled: isStalled(d),
    overdue: isOverdue(d),
    idleDays: relativeDays(d.updatedAt),
  }));

  // Build filter links that preserve the other selections.
  function withParam(key: string, value?: string): string {
    const params = new URLSearchParams();
    if (repFilter && key !== "rep") params.set("rep", repFilter);
    if (stageFilter && key !== "stage") params.set("stage", stageFilter);
    if (channelFilter && key !== "channel") params.set("channel", channelFilter);
    if (closeFilter && key !== "close") params.set("close", closeFilter);
    if (value) params.set(key, value);
    const qs = params.toString();
    return qs ? `/sm/pipeline?${qs}` : "/sm/pipeline";
  }

  const chip = (active: boolean) =>
    `rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
      active
        ? "border-hmd-teal bg-hmd-teal text-hmd-charcoal"
        : "border-border bg-surface text-muted hover:bg-background"
    }`;

  return (
    <div className="mx-auto max-w-[100rem] space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team board</h1>
        <p className="mt-1 text-sm text-muted">
          Every rep&apos;s pipeline. Move cards through stages or reassign them to
          rebalance the team.
        </p>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium uppercase tracking-wide text-muted">
            Rep
          </span>
          <Link href={withParam("rep")} className={chip(!repFilter)}>
            All
          </Link>
          {reps.map((r) => (
            <Link
              key={r.id}
              href={withParam("rep", r.id)}
              className={chip(repFilter === r.id)}
            >
              {r.initials}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium uppercase tracking-wide text-muted">
            Channel
          </span>
          <Link href={withParam("channel")} className={chip(!channelFilter)}>
            All
          </Link>
          {(["direct", "reseller"] as Channel[]).map((ch) => (
            <Link
              key={ch}
              href={withParam("channel", ch)}
              className={chip(channelFilter === ch)}
            >
              {ch}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium uppercase tracking-wide text-muted">
            Stage
          </span>
          <Link href={withParam("stage")} className={chip(!stageFilter)}>
            All
          </Link>
          {STAGE_ORDER.map((s) => (
            <Link
              key={s}
              href={withParam("stage", s)}
              className={chip(stageFilter === s)}
            >
              {STAGE_LABELS[s]}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium uppercase tracking-wide text-muted">
            Close
          </span>
          <Link href={withParam("close")} className={chip(!closeFilter)}>
            All
          </Link>
          {(Object.keys(CLOSE_LABELS) as CloseFilter[]).map((c) => (
            <Link
              key={c}
              href={withParam("close", c)}
              className={chip(closeFilter === c)}
            >
              {CLOSE_LABELS[c]}
            </Link>
          ))}
        </div>
      </div>

      <PipelineBoard
        deals={boardDeals}
        capabilities={{ canDrag: true, canReassign: true }}
        reps={repOptions}
        reassignAction={reassignDealAction}
        dealHref="/sm/deals"
      />
    </div>
  );
}
