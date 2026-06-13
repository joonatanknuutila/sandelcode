import Link from "next/link";
import {
  getAccounts,
  getAllDeals,
  getConfidenceOverrides,
  getOffersByStatus,
  getOpenDeals,
  getTargets,
  getUsers,
  getWonDeals,
  isStalled,
  weightedValue,
} from "@/lib/db";
import { Deal, STAGE_LABELS, STAGE_ORDER, Stage } from "@/lib/types";
import { eur, relativeDays } from "@/lib/format";
import { Badge, Card, SectionTitle, StatTile } from "@/components/ui";
import { OfferApproval, OfferVM } from "@/components/OfferApproval";
import {
  computeForecastSummary,
  ForecastSummary,
  HORIZON_QUARTERS,
  Horizon,
  PERIOD_OPTIONS,
} from "@/components/ForecastSummary";
import { pipelineNarrative } from "@/lib/ai/forecast";
import { Reassign, RepOption } from "./Reassign";

// Sales Manager — the screen that IS the forecast meeting. The team's
// committed/at-risk/gap band (identical to Finance via computeForecastSummary),
// an AI pipeline-health story, a dedicated "what's stalled" list, the by-stage
// board, and the discount-approval gate. The SM reads, decides, and intervenes
// (reassigns) — they don't enter data.
//
// The Quarter/Half/Year/All toggle is URL-driven (?horizon=) — mirrors Finance
// so the SAME horizon feeds the band, the KPIs and the board.

const ACTIVE_STAGES: Stage[] = STAGE_ORDER.filter(
  (s) => s !== "won" && s !== "lost",
);

function parseHorizon(raw: string | undefined): Horizon {
  if (raw === "quarter" || raw === "half" || raw === "year" || raw === "all")
    return raw;
  return "all";
}

function horizonHref(horizon: Horizon): string {
  return horizon === "all" ? "/sm" : `/sm?horizon=${horizon}`;
}

/** Quarter offset 0..11 of a forecast point (matches the band window). */
function quarterOffset(p: { year: number; quarter: number }): number {
  return p.year * 4 + (p.quarter - 1);
}

/** A deal is "in scope" for the horizon if any of its forecast revenue lands
 *  inside the window — same window the band sums over, so the board scopes with
 *  the band. */
function dealInHorizon(deal: Deal, window: number): boolean {
  return deal.forecast.some(
    (p) =>
      quarterOffset(p) < window && p.deviceRevenue + p.serviceRevenue > 0,
  );
}

/** Open deal whose expected close date is already in the past — "slipped". */
function isSlipped(deal: Deal): boolean {
  if (deal.stage === "won" || deal.stage === "lost") return false;
  if (!deal.expectedCloseDate) return false;
  return new Date(deal.expectedCloseDate).getTime() < Date.now();
}

export default async function SalesManagerView({
  searchParams,
}: {
  searchParams: Promise<{ horizon?: string }>;
}) {
  const sp = await searchParams;
  const horizon = parseHorizon(sp.horizon);
  const window = HORIZON_QUARTERS[horizon];

  const [deals, open, won, targets, overrides, pendingOffers, accounts, users] =
    await Promise.all([
      getAllDeals(),
      getOpenDeals(),
      getWonDeals(),
      getTargets(),
      getConfidenceOverrides(),
      getOffersByStatus("pending_sm"),
      getAccounts(),
      getUsers(),
    ]);
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const userById = new Map(users.map((u) => [u.id, u]));
  const dealById = new Map(deals.map((d) => [d.id, d]));

  // Reps for the inline reassign control.
  const reps = users.filter((u) => u.role === "rep");
  const repOptions: RepOption[] = reps.map((u) => ({
    value: u.id,
    label: `${u.initials} · ${u.name}`,
  }));

  // Horizon scoping — band, KPIs and board all look at the same window.
  const openInScope = open.filter((d) => dealInHorizon(d, window));
  const wonInScope = won.filter((d) => dealInHorizon(d, window));

  // Gap-to-target band — SAME math and SAME inputs as /finance, so the gap on
  // /sm equals the gap on /finance for the same horizon.
  const figures = computeForecastSummary(open, won, targets, horizon, overrides);

  // Stalled (14+ days) + slipped (past close) — the intervention list.
  const stalledDeals = openInScope
    .filter(isStalled)
    .sort((a, b) => relativeDays(b.updatedAt) - relativeDays(a.updatedAt));
  const slippedCount = openInScope.filter(isSlipped).length;

  // Scoped team KPIs.
  const kpiOpen = openInScope.length;
  const kpiTcv = openInScope.reduce((s, d) => s + d.tcv, 0);
  const kpiWeighted = openInScope.reduce((s, d) => s + weightedValue(d), 0);

  // AI pipeline-health story — figures come from the SAME band the page shows.
  const narrative = await pipelineNarrative({
    figures,
    stalledCount: stalledDeals.length,
    slippedCount,
    openCount: kpiOpen,
    horizon,
  });

  const pendingApprovals: OfferVM[] = pendingOffers.map((o) => {
    const account = accountById.get(o.accountId);
    const deal = dealById.get(o.dealId);
    return {
      id: o.id,
      accountName: account?.name ?? "Unknown account",
      dealName: deal?.name ?? "—",
      version: o.version,
      total: o.total,
      maxDiscountPct: Math.max(0, ...o.lines.map((l) => l.discountPct)),
      justification: o.justification,
      ownerId: deal?.ownerId,
      dealId: deal?.id,
    };
  });

  const byStage = (stage: Stage) =>
    deals
      .filter((d) => d.stage === stage && dealInHorizon(d, window))
      .sort((a, b) => weightedValue(b) - weightedValue(a));

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team pipeline</h1>
        <p className="mt-1 text-sm text-muted">
          The forecast meeting on one screen — where the team stands, what&apos;s
          stalled, and what to approve.
        </p>
      </div>

      {/* Period toggle (Quarter / Half / Year / All) — URL-driven, mirrors
          Finance. The SAME horizon feeds the band, the KPIs and the board. */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">
          Period
        </span>
        <div className="flex overflow-hidden rounded-lg border border-border">
          {PERIOD_OPTIONS.map((opt) => (
            <Link
              key={opt.value}
              href={horizonHref(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                horizon === opt.value
                  ? "bg-hmd-teal text-hmd-teal-700"
                  : "bg-surface text-muted hover:bg-background"
              }`}
            >
              {opt.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Gap-to-target band — shared with /finance via ForecastSummary. */}
      <ForecastSummary figures={figures} horizon={horizon} />

      {/* AI pipeline-health story — opens the meeting. Figures match the band. */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Pipeline health
            {!narrative.modelUsed && (
              <span className="ml-1 normal-case text-muted">
                · model offline — deterministic
              </span>
            )}
          </p>
          <Badge tone="blue">AI</Badge>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-foreground">
          {narrative.text}
        </p>
      </Card>

      {/* Team KPIs (scoped to the selected horizon). */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Open deals" value={String(kpiOpen)} />
        <StatTile
          label="Weighted pipeline"
          value={eur(kpiWeighted)}
          hint="probability-adjusted"
        />
        <StatTile
          label="Total opportunity (TCV)"
          value={eur(kpiTcv)}
          hint="open deals in window"
        />
        <StatTile
          label="Stalled deals"
          value={String(stalledDeals.length)}
          hint="no update in 14+ days"
          tone={stalledDeals.length > 0 ? "warning" : "default"}
        />
      </div>

      {/* Stalled — needs intervention. Above the board, sorted by idle days. */}
      <section>
        <SectionTitle>Stalled — needs intervention</SectionTitle>
        {stalledDeals.length === 0 ? (
          <Card className="p-4 text-sm text-muted">
            Nothing stalled in this window — the pipeline is moving.
          </Card>
        ) : (
          <Card className="divide-y divide-border">
            {stalledDeals.map((d) => {
              const account = accountById.get(d.accountId);
              const owner = userById.get(d.ownerId);
              const idle = relativeDays(d.updatedAt);
              return (
                <div
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {account?.name ?? "Unknown account"}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                      <Badge>{owner?.initials ?? "?"}</Badge>
                      <span>{STAGE_LABELS[d.stage]}</span>
                      <span>· {eur(d.tcv)}</span>
                      {isSlipped(d) && <Badge tone="red">past close</Badge>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="amber">{idle}d idle</Badge>
                    <Reassign
                      dealId={d.id}
                      currentOwnerId={d.ownerId}
                      reps={repOptions}
                    />
                  </div>
                </div>
              );
            })}
          </Card>
        )}
      </section>

      {/* Discount approvals — first gate (persists via recordApproval). */}
      <OfferApproval offers={pendingApprovals} gate="sm" />

      {/* Pipeline by stage, team-wide (scoped to the horizon). */}
      <section>
        <SectionTitle>Pipeline by stage</SectionTitle>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          {ACTIVE_STAGES.map((stage) => {
            const stageDeals = byStage(stage);
            const stageValue = stageDeals.reduce(
              (s, d) => s + weightedValue(d),
              0,
            );
            return (
              <div
                key={stage}
                className="rounded-xl border border-border bg-surface"
              >
                <div className="border-b border-border px-3 py-2.5">
                  <p className="text-xs font-semibold text-foreground">
                    {STAGE_LABELS[stage]}
                  </p>
                  <p className="text-xs text-muted">
                    {stageDeals.length} · {eur(stageValue)}
                  </p>
                </div>
                <div className="space-y-2 p-2">
                  {stageDeals.length === 0 && (
                    <p className="px-1 py-3 text-xs text-muted">—</p>
                  )}
                  {stageDeals.map((d) => {
                    const account = accountById.get(d.accountId);
                    const owner = userById.get(d.ownerId);
                    const stalled = isStalled(d);
                    return (
                      <div
                        key={d.id}
                        className={`rounded-lg border p-2.5 ${
                          stalled
                            ? "border-amber-300 bg-amber-50"
                            : "border-border"
                        }`}
                      >
                        <p className="line-clamp-2 text-xs font-medium leading-snug">
                          {account?.name}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-hmd-teal-700">
                          {eur(d.tcv)}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                          <Badge>{owner?.initials ?? "?"}</Badge>
                          {d.channel === "reseller" && <Badge>reseller</Badge>}
                          {stalled && (
                            <Badge tone="amber">
                              {relativeDays(d.updatedAt)}d idle
                            </Badge>
                          )}
                        </div>
                        <div className="mt-2">
                          <Reassign
                            dealId={d.id}
                            currentOwnerId={d.ownerId}
                            reps={repOptions}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
