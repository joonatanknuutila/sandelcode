import Link from "next/link";
import {
  getAccounts,
  getConfidenceOverrides,
  getOffersByStatus,
  getOpenDeals,
  getTargets,
  getUsers,
  getWonDeals,
  isOverdue,
  isStalled,
  weightedValue,
} from "@/lib/db";
import {
  Deal,
  dealProbability,
  STAGE_LABELS,
  STAGE_ORDER,
  Stage,
} from "@/lib/types";
import { eur, quarterLabel, relativeDays } from "@/lib/format";
import { Badge, Card, SectionTitle, StatTile } from "@/components/ui";
import {
  computeForecastSummary,
  ForecastSummary,
  HORIZON_QUARTERS,
  Horizon,
  PERIOD_OPTIONS,
} from "@/components/ForecastSummary";
import { pipelineNarrative } from "@/lib/ai/forecast";

// Sales Manager — the one-page overview for the forecast meeting. Deep work
// stays in the left-nav tabs: Team Board for reassignment, Inbox for approvals,
// Reports for the detailed tables.
//
// The Quarter/Half/Year/All toggle is URL-driven (?horizon=) — mirrors Finance
// so the SAME horizon feeds the band, the KPIs and the board.

const ACTIVE_STAGES: Stage[] = STAGE_ORDER.filter(
  (s) => s !== "won" && s !== "lost",
);
const YEARS = [0, 1, 2] as const;
const QUARTERS = [1, 2, 3, 4] as const;

interface QuarterRow {
  label: string;
  offset: number;
  committed: number;
  weighted: number;
  target: number;
}

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

function effectiveConfidence(
  deal: Deal,
  overrides: Record<string, { value: number }>,
): number {
  const override = overrides[deal.id];
  if (override && typeof override.value === "number") {
    return Math.max(0, Math.min(100, override.value)) / 100;
  }
  return dealProbability(deal);
}

function buildForecastRows(
  open: Deal[],
  won: Deal[],
  targets: { amountEur: number }[],
  overrides: Record<string, { value: number }>,
): QuarterRow[] {
  const rows: QuarterRow[] = [];
  let offset = 0;

  for (const year of YEARS) {
    for (const quarter of QUARTERS) {
      const at = (p: { year: number; quarter: number }) =>
        p.year === year && p.quarter === quarter;
      const committed = won.reduce((sum, deal) => {
        const point = deal.forecast.find(at);
        return sum + (point ? point.deviceRevenue + point.serviceRevenue : 0);
      }, 0);
      const weighted = open.reduce((sum, deal) => {
        const point = deal.forecast.find(at);
        const value = point ? point.deviceRevenue + point.serviceRevenue : 0;
        return sum + value * effectiveConfidence(deal, overrides);
      }, 0);

      rows.push({
        label: quarterLabel(year, quarter),
        offset,
        committed,
        weighted: Math.round(weighted),
        target: targets[offset]?.amountEur ?? 0,
      });
      offset += 1;
    }
  }

  return rows;
}

export default async function SalesManagerView({
  searchParams,
}: {
  searchParams: Promise<{ horizon?: string }>;
}) {
  const sp = await searchParams;
  const horizon = parseHorizon(sp.horizon);
  const window = HORIZON_QUARTERS[horizon];

  const [open, won, targets, overrides, pendingOffers, accounts, users] =
    await Promise.all([
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

  // Horizon scoping — band, KPIs and charts all look at the same window.
  const openInScope = open.filter((d) => dealInHorizon(d, window));
  // Gap-to-target band — SAME math and SAME inputs as /finance, so the gap on
  // /sm equals the gap on /finance for the same horizon.
  const figures = computeForecastSummary(open, won, targets, horizon, overrides);

  // Stalled (14+ days) + overdue (past close) — the intervention list. The list
  // catches BOTH risks (a deal can be overdue without being idle), so an overdue
  // deal the SM must chase never hides just because it had recent activity.
  const stalledDeals = openInScope.filter(isStalled);
  const overdueDeals = openInScope.filter(isOverdue);
  const slippedCount = overdueDeals.length;
  const atRiskDeals = openInScope.filter((d) => isStalled(d) || isOverdue(d));
  // Order the intervention list so OVERDUE deals lead (most days past close
  // first), then merely-idle deals by how long they've been quiet — overdue is
  // the manager's most urgent signal and must never sit below a stale-but-
  // on-time deal.
  const attentionDeals = [...atRiskDeals].sort((a, b) => {
    const ao = isOverdue(a);
    const bo = isOverdue(b);
    if (ao !== bo) return ao ? -1 : 1;
    if (ao && bo)
      return (
        relativeDays(b.expectedCloseDate) - relativeDays(a.expectedCloseDate)
      );
    return relativeDays(b.updatedAt) - relativeDays(a.updatedAt);
  });

  // Scoped team KPIs.
  const kpiOpen = openInScope.length;
  const kpiTcv = openInScope.reduce((s, d) => s + d.tcv, 0);
  const kpiWeighted = openInScope.reduce((s, d) => s + weightedValue(d), 0);
  const forecastRows = buildForecastRows(open, won, targets, overrides).filter(
    (row) => row.offset < window,
  );
  const stageRows = ACTIVE_STAGES.map((stage) => {
    const stageDeals = openInScope.filter((d) => d.stage === stage);
    return {
      stage,
      count: stageDeals.length,
      value: stageDeals.reduce((sum, deal) => sum + weightedValue(deal), 0),
    };
  });

  // AI pipeline-health story — figures come from the SAME band the page shows.
  const narrative = await pipelineNarrative({
    figures,
    stalledCount: stalledDeals.length,
    slippedCount,
    openCount: kpiOpen,
    horizon,
  });

  const pendingApprovalValue = pendingOffers.reduce(
    (sum, offer) => sum + offer.total,
    0,
  );
  const topAttention = attentionDeals.slice(0, 6);

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">SM dashboard</h1>
        <p className="mt-1 text-sm text-muted">
          One-page overview of forecast coverage, open pipeline, and items that
          need manager attention.
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

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <ForecastChart rows={forecastRows} />
        <StageFunnel rows={stageRows} />
      </div>

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
          label="At-risk deals"
          value={String(atRiskDeals.length)}
          hint="idle 14d+ or past close"
          tone={atRiskDeals.length > 0 ? "warning" : "default"}
        />
      </div>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionTitle>Needs attention</SectionTitle>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/sm/pipeline?close=overdue"
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted hover:bg-background"
            >
              Team board
            </Link>
            <Link
              href="/sm/inbox"
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted hover:bg-background"
            >
              Inbox
            </Link>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1fr_1.6fr]">
          <Card className="p-4">
            <div className="grid grid-cols-2 gap-3">
              <AttentionMetric
                label="Overdue"
                value={String(overdueDeals.length)}
                hint="past expected close"
                tone={overdueDeals.length > 0 ? "text-warning" : "text-success"}
              />
              <AttentionMetric
                label="SM approvals"
                value={String(pendingOffers.length)}
                hint={eur(pendingApprovalValue)}
                tone={pendingOffers.length > 0 ? "text-warning" : "text-success"}
              />
            </div>
            <p className="mt-3 text-xs text-muted">
              Detailed reassignment lives on Team Board. Discount decisions live
              in Inbox.
            </p>
          </Card>
          <Card className="divide-y divide-border">
            {topAttention.length === 0 ? (
              <p className="p-4 text-sm text-muted">
                Nothing overdue or stalled in this window.
              </p>
            ) : (
              topAttention.map((deal) => {
                const account = accountById.get(deal.accountId);
                const owner = userById.get(deal.ownerId);
                const overdue = isOverdue(deal);
                const stalled = isStalled(deal);
                return (
                  <Link
                    key={deal.id}
                    href={`/sm/deals/${deal.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 p-3 transition-colors hover:bg-background"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {account?.name ?? "Unknown account"}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                        <Badge>{owner?.initials ?? "?"}</Badge>
                        <span>{STAGE_LABELS[deal.stage]}</span>
                        <span>{eur(deal.tcv)}</span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {overdue && (
                        <Badge tone="red">
                          {relativeDays(deal.expectedCloseDate)}d overdue
                        </Badge>
                      )}
                      {stalled && (
                        <Badge tone="amber">
                          {relativeDays(deal.updatedAt)}d idle
                        </Badge>
                      )}
                    </div>
                  </Link>
                );
              })
            )}
          </Card>
        </div>
      </section>
    </div>
  );
}

function ForecastChart({ rows }: { rows: QuarterRow[] }) {
  const max = Math.max(
    1,
    ...rows.map((row) => row.committed + row.weighted),
    ...rows.map((row) => row.target),
  );

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Forecast trend
          </p>
          <h2 className="mt-1 text-base font-semibold">
            Committed + weighted against target
          </h2>
        </div>
        <Link
          href="/sm/reports"
          className="text-xs font-medium text-hmd-teal-700 hover:underline"
        >
          Reports
        </Link>
      </div>
      <div className="mt-4 space-y-3">
        {rows.map((row) => {
          const total = row.committed + row.weighted;
          const committedPct = (row.committed / max) * 100;
          const weightedPct = (row.weighted / max) * 100;
          const targetPct = Math.min(100, (row.target / max) * 100);
          return (
            <div
              key={row.label}
              className="grid grid-cols-[3.5rem_1fr_4.5rem] items-center gap-3 text-xs"
            >
              <span className="font-medium text-muted">{row.label}</span>
              <div className="relative h-5 rounded-full bg-background">
                <div
                  className="absolute left-0 top-0 h-full rounded-l-full bg-success"
                  style={{ width: `${committedPct}%` }}
                />
                <div
                  className="absolute top-0 h-full rounded-r-full bg-hmd-teal"
                  style={{
                    left: `${committedPct}%`,
                    width: `${weightedPct}%`,
                  }}
                />
                {row.target > 0 && (
                  <div
                    className="absolute top-[-0.2rem] h-7 border-l-2 border-hmd-charcoal"
                    style={{ left: `${targetPct}%` }}
                    title={`Target ${eur(row.target)}`}
                  />
                )}
              </div>
              <span className="text-right font-medium">{eur(total)}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-success" /> Committed
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-hmd-teal" /> Weighted
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-3 border-l-2 border-hmd-charcoal" /> Target
        </span>
      </div>
    </Card>
  );
}

function StageFunnel({
  rows,
}: {
  rows: { stage: Stage; count: number; value: number }[];
}) {
  const max = Math.max(1, ...rows.map((row) => row.value));

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Open deals
          </p>
          <h2 className="mt-1 text-base font-semibold">Pipeline by stage</h2>
        </div>
        <Link
          href="/sm/pipeline"
          className="text-xs font-medium text-hmd-teal-700 hover:underline"
        >
          Team Board
        </Link>
      </div>
      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <Link
            key={row.stage}
            href={`/sm/pipeline?stage=${row.stage}`}
            className="block rounded-md p-1.5 transition-colors hover:bg-background"
          >
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-medium text-foreground">
                {STAGE_LABELS[row.stage]}
              </span>
              <span className="text-muted">
                {row.count} · {eur(row.value)}
              </span>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-background">
              <div
                className="h-full rounded-full bg-hmd-teal"
                style={{ width: `${Math.max(4, (row.value / max) * 100)}%` }}
              />
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}

function AttentionMetric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className={`mt-0.5 text-2xl font-semibold ${tone}`}>{value}</p>
      <p className="text-xs text-muted">{hint}</p>
    </div>
  );
}
