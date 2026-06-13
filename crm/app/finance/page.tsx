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
import { Deal, dealProbability } from "@/lib/types";
import { eur, num, quarterLabel } from "@/lib/format";
import { SectionTitle, StatTile } from "@/components/ui";
import { OfferApproval, OfferVM } from "@/components/OfferApproval";
import {
  computeForecastSummary,
  ForecastSummary,
  HORIZON_QUARTERS,
  Horizon,
  PERIOD_OPTIONS,
} from "@/components/ForecastSummary";
import { ConfidenceOverride, DealConfidenceVM } from "./ConfidenceOverride";

// Finance — reads the pipeline without asking sales: a weighted vs committed
// forecast, time-phased across 3 years, the gap-to-target band, the confidence
// override that drives hardware ordering, and the second discount-approval gate.
//
// One opinionated view (no pivot builder). The Quarter/Half/Year/All toggle and
// the deal-size floor are URL-driven (searchParams) so the SAME horizon feeds
// both the grid and the gap-to-target band via computeForecastSummary.

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

function controlHref(horizon: Horizon, minTcv: number): string {
  const params = new URLSearchParams();
  if (horizon !== "all") params.set("horizon", horizon);
  if (minTcv > 0) params.set("minTcv", String(minTcv));
  const qs = params.toString();
  return qs ? `/finance?${qs}` : "/finance";
}

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

  // Deal-size filter applies to BOTH the band and the grid (one view).
  const openF = open.filter((d) => d.tcv >= minTcv);
  const wonF = won.filter((d) => d.tcv >= minTcv);

  // Gap-to-target band — shared math; overrides feed the committed/weighted
  // figure for any deal Finance has overridden.
  const figures = computeForecastSummary(
    openF,
    wonF,
    targets,
    horizon,
    overrides,
  );

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

  const confidenceVMs: DealConfidenceVM[] = await Promise.all(
    openF.map(async (d) => {
      const c = await confidence(d);
      const account = accountById.get(d.accountId);
      const stored = overrides[d.id];
      return {
        dealId: d.id,
        dealName: d.name,
        accountName: account?.name ?? "Unknown account",
        tcv: d.tcv,
        base: c.base,
        score: c.score,
        band: c.band,
        reasons: c.reasons,
        storedOverride: stored?.value,
        storedReason: stored?.reason ?? undefined,
      };
    }),
  );

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Forecast</h1>
        <p className="mt-1 text-sm text-muted">
          Weighted vs committed revenue across {allDeals.length} deals — gap to
          target, time-phased, no need to ask sales.
        </p>
      </div>

      {/* Period toggle (Quarter / Half / Year / All) + deal-size floor — both
          URL-driven, both feed the SAME horizon used by the band and the grid. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">
            Period
          </span>
          <div className="flex overflow-hidden rounded-lg border border-border">
            {PERIOD_OPTIONS.map((opt) => (
              <Link
                key={opt.value}
                href={controlHref(opt.value, minTcv)}
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
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">
            Deal size
          </span>
          <div className="flex overflow-hidden rounded-lg border border-border">
            {SIZE_FILTERS.map((opt) => (
              <Link
                key={opt.value}
                href={controlHref(horizon, opt.value)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  minTcv === opt.value
                    ? "bg-hmd-teal text-hmd-teal-700"
                    : "bg-surface text-muted hover:bg-background"
                }`}
              >
                {opt.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Gap-to-target band (shared with /sm via ForecastSummary). */}
      <ForecastSummary figures={figures} horizon={horizon} />

      {/* Headline forecast numbers — reconcile with the grid below. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatTile
          label="Committed (won)"
          value={eur(totals.committed)}
          hint="certain, time-phased"
          tone="success"
        />
        <StatTile
          label="Weighted pipeline"
          value={eur(totals.weighted)}
          hint="confidence-adjusted, at-risk"
        />
        <StatTile
          label="Forecast total"
          value={eur(totals.committed + totals.weighted)}
          hint="committed + weighted"
        />
      </div>

      {/* Time-phased forecast grid */}
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

      {/* Discount approvals — second gate (locks the offer) */}
      <OfferApproval offers={pendingApprovals} gate="finance" />

      {/* Confidence override — drives hardware ordering & gap-to-target */}
      <section>
        <SectionTitle>Confidence — Finance override</SectionTitle>
        <p className="mb-3 -mt-1 text-xs text-muted">
          Rules compute the score; you adjust the realistic number. The stored
          override is what feeds gap-to-target and ordering.
        </p>
        <ConfidenceOverride deals={confidenceVMs} />
      </section>
    </div>
  );
}
