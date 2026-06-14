import Link from "next/link";
import {
  getAccounts,
  getAllDeals,
  getConfidenceOverrides,
  getOffersByStatus,
  getOpenDeals,
  getTargets,
  getWonDeals,
} from "@/lib/db";
import { confidence } from "@/lib/ai/confidence";
import { Deal, STAGE_LABELS, dealProbability } from "@/lib/types";
import { eur, num, quarterLabel, quarterLabelShort } from "@/lib/format";
import { Badge, Card, SectionTitle } from "@/components/ui";
import { ExportLinks } from "@/components/ExportLinks";
import { OfferApproval, OfferVM } from "@/components/OfferApproval";
import { forecastNarrative } from "@/lib/ai/forecast";
import {
  computeForecastSummary,
  HORIZON_QUARTERS,
  HORIZON_LABELS,
  Horizon,
  PERIOD_OPTIONS,
} from "@/components/ForecastSummary";
import { ConfidenceOverride, DealConfidenceVM } from "./ConfidenceOverride";
import {
  FinanceDashboard,
  type FinanceDashboardData,
} from "@/components/finance/FinanceDashboard";
import { TargetImport } from "@/components/finance/TargetImport";
import {
  confidenceDistribution,
  dealRevenueInWindow,
  deviceServiceSplit,
  closeRate as computeCloseRate,
} from "@/lib/finance/selectors";

// Finance — built around the three pitch beats (demo step 6).
//   Beat 1: the 3-year quarter-by-quarter forecast dominates the screen —
//           Finance sees the whole picture without phoning sales.
//   Beat 2: device and service revenue kept separate (brief 2.2).
//   Beat 3: Finance overrides a deal's confidence with a written reason; both
//           the rule value and the override are stored and drive ordering.
// A thin metric strip (chips + the Quarter/Half/Year/All + deal-size filters)
// gives quick context; the working tools (detail grid, target import, the
// discount-approval gate) sit quietly below. The old report-wall (gap gauge,
// stage funnel, region/industry/channel mix, discount chart) and the separate
// Reports/Pipeline pages have been cut — they didn't serve a beat.

const YEARS = [0, 1, 2] as const;
const QUARTERS = [1, 2, 3, 4] as const;

interface QuarterRow {
  label: string;
  /** Quarter offset 0..11 (matches the horizon window). */
  offset: number;
  committed: number;
  weighted: number;
  devices: number;
}

function effectiveConfidence(
  d: Deal,
  overrides: Record<string, { value: number }>,
): number {
  const o = overrides[d.id];
  if (o && typeof o.value === "number")
    return Math.max(0, Math.min(100, o.value)) / 100;
  return dealProbability(d);
}

function buildForecast(
  open: Deal[],
  won: Deal[],
  overrides: Record<string, { value: number }>,
): QuarterRow[] {
  const rows: QuarterRow[] = [];
  let offset = 0;
  for (const year of YEARS) {
    for (const quarter of QUARTERS) {
      const at = (d: { year: number; quarter: number }) =>
        d.year === year && d.quarter === quarter;
      const committed = won.reduce((s, d) => {
        const p = d.forecast.find(at);
        return s + (p ? p.deviceRevenue + p.serviceRevenue : 0);
      }, 0);
      const weighted = open.reduce((s, d) => {
        const p = d.forecast.find(at);
        const q = p ? p.deviceRevenue + p.serviceRevenue : 0;
        return s + q * effectiveConfidence(d, overrides);
      }, 0);
      // Device units shipping this quarter — committed (won) + open pipeline,
      // the figure Finance buys components against.
      const devices = [...won, ...open].reduce((s, d) => {
        const p = d.forecast.find(at);
        return s + (p ? p.devices : 0);
      }, 0);
      rows.push({
        label: quarterLabel(year, quarter),
        offset,
        committed,
        weighted: Math.round(weighted),
        devices,
      });
      offset += 1;
    }
  }
  return rows;
}

function parseHorizon(raw: string | undefined): Horizon {
  if (raw === "quarter" || raw === "half" || raw === "year" || raw === "all")
    return raw;
  return "all";
}

// Deal-size floor options for the grid + band filter (one opinionated view).
const SIZE_FILTERS: { value: number; label: string }[] = [
  { value: 0, label: "All sizes" },
  { value: 100_000, label: "≥ €100k" },
  { value: 500_000, label: "≥ €500k" },
  { value: 1_000_000, label: "≥ €1M" },
];

/** A finance URL that preserves the controls and changes only the given ones. */
function financeHref(horizon: Horizon, minTcv: number): string {
  const params = new URLSearchParams();
  if (horizon !== "all") params.set("horizon", horizon);
  if (minTcv > 0) params.set("minTcv", String(minTcv));
  const qs = params.toString();
  return qs ? `/finance?${qs}` : "/finance";
}

// Riskiest deals to surface in the override list (Beat 3) — kept tight so the
// crown jewel reads cleanly. Full picture still lives in the distribution above.
const OVERRIDE_LIMIT = 10;

export default async function FinanceView({
  searchParams,
}: {
  searchParams: Promise<{ horizon?: string; minTcv?: string }>;
}) {
  const sp = await searchParams;
  const horizon = parseHorizon(sp.horizon);
  const minTcv = Math.max(0, Number(sp.minTcv) || 0);

  const [allDeals, open, won, pendingOffers, accounts, targets, overrides] =
    await Promise.all([
      getAllDeals(),
      getOpenDeals(),
      getWonDeals(),
      getOffersByStatus("pending_finance"),
      getAccounts(),
      getTargets(),
      getConfidenceOverrides(),
    ]);
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const dealById = new Map(allDeals.map((d) => [d.id, d]));

  // Plain-English forecast story (brief P2 places the narrative on Finance).
  const narrative = await forecastNarrative();

  // Deal-size filter applies to BOTH the band and the grid (one view).
  const openF = open.filter((d) => d.tcv >= minTcv);
  const wonF = won.filter((d) => d.tcv >= minTcv);

  // Shared band math; overrides feed the committed/weighted figure for any deal
  // Finance has overridden. Drives the metric strip chips.
  const figures = computeForecastSummary(openF, wonF, targets, horizon, overrides);
  const forecastTotal = figures.committed + figures.atRisk + figures.upside;
  const covered = figures.gap <= 0;

  const window = HORIZON_QUARTERS[horizon];
  const rows = buildForecast(openF, wonF, overrides).filter(
    (r) => r.offset < window,
  );
  const totals = rows.reduce(
    (acc, r) => ({
      committed: acc.committed + r.committed,
      weighted: acc.weighted + r.weighted,
      devices: acc.devices + r.devices,
    }),
    { committed: 0, weighted: 0, devices: 0 },
  );

  const lostCount = allDeals.filter((d) => d.stage === "lost").length;
  const closeRate = computeCloseRate(won.length, lostCount);

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

  // Beat 3 source — one VM per open deal, with its in-window value (for the
  // distribution) and value-at-risk (for the riskiest-first ordering).
  const enriched = await Promise.all(
    openF.map(async (d) => {
      const c = await confidence(d);
      const account = accountById.get(d.accountId);
      const stored = overrides[d.id];
      const vm: DealConfidenceVM = {
        dealId: d.id,
        dealName: d.name,
        accountName: account?.name ?? "Unknown account",
        stageLabel: STAGE_LABELS[d.stage],
        tcv: d.tcv,
        base: c.base,
        score: c.score,
        band: c.band,
        reasons: c.reasons,
        storedOverride: stored?.value,
        storedReason: stored?.reason ?? undefined,
      };
      const effective = vm.storedOverride ?? vm.score;
      return {
        vm,
        windowValue: dealRevenueInWindow(d, window).total,
        valueAtRisk: d.tcv * (1 - effective / 100),
      };
    }),
  );

  const confidenceDist = confidenceDistribution(
    enriched.map((e) => ({ band: e.vm.band, value: e.windowValue })),
  );
  const riskiest = [...enriched]
    .sort((a, b) => b.valueAtRisk - a.valueAtRisk)
    .slice(0, OVERRIDE_LIMIT)
    .map((e) => e.vm);

  const dashboardData: FinanceDashboardData = {
    // Chart axis uses the compact "26 Q1" form so 12 quarters don't overlap;
    // the detail grid below keeps the full year.
    rows: rows.map((r) => ({
      label: quarterLabelShort(
        Math.floor(r.offset / 4) as 0 | 1 | 2,
        ((r.offset % 4) + 1) as 1 | 2 | 3 | 4,
      ),
      committed: r.committed,
      weighted: r.weighted,
    })),
    quarterTargets: targets.slice(0, window).map((t) => t.amountEur),
    horizonLabel: HORIZON_LABELS[horizon],
    split: deviceServiceSplit([...openF, ...wonF], window),
    confidence: confidenceDist,
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Finance</h1>
          <p className="mt-1 text-sm text-muted">
            The 3-year forecast, quarter by quarter — straight from the data, no
            need to phone sales. {allDeals.length} deals.
          </p>
        </div>
        <ExportLinks kinds={["pipeline"]} />
      </div>

      {/* ---- Thin metric strip — quick context, small and quiet ------------- */}
      <div className="flex flex-wrap items-center gap-3">
        <Chip label="Forecast total" value={eur(forecastTotal)} />
        <Chip label="Committed" value={eur(figures.committed)} tone="success" />
        <Chip
          label="Gap to target"
          value={covered ? `+${eur(-figures.gap)}` : `−${eur(figures.gap)}`}
          tone={covered ? "success" : "danger"}
        />
        <Chip
          label="Close rate"
          value={closeRate === null ? "—" : `${closeRate}%`}
        />

        <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2">
          <FilterGroup label="Period">
            {PERIOD_OPTIONS.map((opt) => (
              <FilterLink
                key={opt.value}
                href={financeHref(opt.value, minTcv)}
                active={horizon === opt.value}
              >
                {opt.label}
              </FilterLink>
            ))}
          </FilterGroup>
          <FilterGroup label="Deal size">
            {SIZE_FILTERS.map((opt) => (
              <FilterLink
                key={opt.value}
                href={financeHref(horizon, opt.value)}
                active={minTcv === opt.value}
              >
                {opt.label}
              </FilterLink>
            ))}
          </FilterGroup>
        </div>
      </div>

      {/* ---- Beats 1 & 2 + the confidence-distribution lead-in ------------- */}
      <FinanceDashboard data={dashboardData} />

      {/* ---- Beat 3 (crown jewel) — Finance decides ------------------------ */}
      <section>
        <SectionTitle>Confidence — Finance override</SectionTitle>
        <p className="mb-3 -mt-1 text-xs text-muted">
          Riskiest deals first. Rules compute the score; you set the realistic
          number with a reason. The stored override feeds gap-to-target and
          component ordering.
          {enriched.length > OVERRIDE_LIMIT
            ? ` Showing the ${OVERRIDE_LIMIT} highest-risk of ${enriched.length} open deals.`
            : ""}
        </p>
        <ConfidenceOverride deals={riskiest} />
      </section>

      {/* ---------------- Working tools (quiet, below) ---------------- */}

      {/* AI forecast narrative — "give me the number, plainly". */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Forecast narrative
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

      {/* Time-phased forecast grid — the exact detail behind the chart. */}
      <section>
        <SectionTitle>Time-phased forecast · {rows.length} quarters</SectionTitle>
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-background text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Quarter</th>
                <th className="px-3 py-2 text-right font-medium">Committed €</th>
                <th className="px-3 py-2 text-right font-medium">
                  Weighted (at-risk) €
                </th>
                <th className="px-3 py-2 text-right font-medium">Total €</th>
                <th className="px-3 py-2 text-right font-medium">
                  Device units
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-t border-border">
                  <td className="px-3 py-1.5 text-muted">{r.label}</td>
                  <td className="px-3 py-1.5 text-right text-success">
                    {r.committed ? eur(r.committed) : "—"}
                  </td>
                  <td className="px-3 py-1.5 text-right text-muted">
                    {r.weighted ? eur(r.weighted) : "—"}
                  </td>
                  <td className="px-3 py-1.5 text-right font-medium">
                    {eur(r.committed + r.weighted)}
                  </td>
                  <td className="px-3 py-1.5 text-right text-foreground">
                    {r.devices ? num(r.devices) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-background font-semibold">
                <td className="px-3 py-2">Horizon total</td>
                <td className="px-3 py-2 text-right">{eur(totals.committed)}</td>
                <td className="px-3 py-2 text-right">{eur(totals.weighted)}</td>
                <td className="px-3 py-2 text-right">
                  {eur(totals.committed + totals.weighted)}
                </td>
                <td className="px-3 py-2 text-right">{num(totals.devices)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">
          Device units = committed + open pipeline shipping per quarter — the
          figure to buy components against. Weighted uses each deal&apos;s
          Finance override when one is set.
        </p>
      </section>

      {/* CSV target import — bulk-load the quarterly gap-to-target numbers. */}
      <TargetImport />

      {/* Discount approvals — Finance is the second gate (locks the offer). */}
      <OfferApproval offers={pendingApprovals} gate="finance" />
    </div>
  );
}

// --- Small presentational helpers (server-component-safe) -------------------

function Chip({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "danger"
        ? "text-danger"
        : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
        {label}
      </span>
      <span className={`ml-2 text-sm font-semibold tabular-nums ${toneClass}`}>
        {value}
      </span>
    </div>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
        {label}
      </span>
      <div className="flex overflow-hidden rounded-lg border border-border">
        {children}
      </div>
    </div>
  );
}

function FilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-hmd-teal text-hmd-teal-700"
          : "bg-surface text-muted hover:bg-background"
      }`}
    >
      {children}
    </Link>
  );
}
