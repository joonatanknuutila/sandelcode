// Shared forecast band + gap-to-target math (Finance F1).
//
// The single source of truth for the committed / at-risk / upside / gap band
// used on BOTH /finance and /sm. Keep ALL band math here so the two views can
// never diverge. Pure function + presentational component, no data fetching.
//
// Reconciliation note: deal forecasts are time-phased in RELATIVE quarters
// (year 0..2 × quarter 1..4 from each deal's own start — see ForecastPoint),
// while targets are an ordered list of absolute quarterly amounts. We treat the
// 12 relative quarters as the horizon axis and sum the matching count of
// (period-ordered) targets, so committed and gap are always measured over the
// same window.

import { Deal, dealProbability } from "@/lib/types";
import type { ForecastTarget, ConfidenceOverride } from "@/lib/db";
import { eur } from "@/lib/format";
import { FORECAST_BANDS } from "@/lib/scoring";
import { Card } from "@/components/ui";

// ---------------------------------------------------------------------------
// Horizon model
// ---------------------------------------------------------------------------

/** How far out the band/grid looks. Drives BOTH the deal-quarter window and the
 *  number of (period-ordered) targets summed for gap-to-target. */
export type Horizon = "quarter" | "half" | "year" | "all";

/** Quarters included in each horizon (the time-phased grid is 12 quarters). */
export const HORIZON_QUARTERS: Record<Horizon, number> = {
  quarter: 1,
  half: 2,
  year: 4,
  all: 12,
};

export const HORIZON_LABELS: Record<Horizon, string> = {
  quarter: "This quarter",
  half: "Next 6 months",
  year: "This year",
  all: "Full 3-year",
};

/** Period toggle exposed in the UI (F4). "all" stays available as the default. */
export const PERIOD_OPTIONS: { value: Horizon; label: string }[] = [
  { value: "quarter", label: "Quarter" },
  { value: "half", label: "Half" },
  { value: "year", label: "Year" },
  { value: "all", label: "All" },
];

// ---------------------------------------------------------------------------
// Pure band math (the SM page imports THIS function verbatim)
// ---------------------------------------------------------------------------

export interface ForecastSummaryFigures {
  /** Won revenue landing inside the horizon (certain, time-phased). */
  committed: number;
  /** Mid-stage weighted revenue (0.4 ≤ confidence < 0.8) — at risk. */
  atRisk: number;
  /** Early weighted revenue (confidence < 0.4) — upside. */
  upside: number;
  /** Σ targets across the horizon's quarters. */
  target: number;
  /** target − committed (positive ⇒ a shortfall Finance must cover). */
  gap: number;
}

/** Absolute quarter index of a deal forecast point (year 0..2, quarter 1..4). */
function quarterOffset(p: { year: number; quarter: number }): number {
  return p.year * 4 + (p.quarter - 1);
}

/** A deal's confidence-as-fraction: the Finance override when present (it is
 *  what feeds gap-to-target), otherwise the deal's own/stage win probability. */
function dealConfidence(
  deal: Deal,
  overrides?: Record<string, ConfidenceOverride>,
): number {
  const o = overrides?.[deal.id];
  if (o && typeof o.value === "number") return Math.max(0, Math.min(100, o.value)) / 100;
  return dealProbability(deal);
}

/**
 * The band for a selected horizon. `gap = Σ targets in horizon − committed`.
 *
 * @param openDeals  non-terminal deals (weighted into at-risk / upside)
 * @param wonDeals   won deals (committed, time-phased, no weighting)
 * @param targets    quarterly targets `{ period, amountEur }[]`, period-ordered
 * @param horizon    quarter / half / year / all
 * @param overrides  Finance confidence overrides — when set for a deal its
 *                   committed/weighted value uses the OVERRIDDEN confidence.
 */
export function computeForecastSummary(
  openDeals: Deal[],
  wonDeals: Deal[],
  targets: ForecastTarget[],
  horizon: Horizon = "all",
  overrides?: Record<string, ConfidenceOverride>,
): ForecastSummaryFigures {
  const window = HORIZON_QUARTERS[horizon];
  const inWindow = (p: { year: number; quarter: number }) =>
    quarterOffset(p) < window;

  let committed = 0;
  let atRisk = 0;
  let upside = 0;

  for (const d of wonDeals) {
    committed += d.forecast.reduce(
      (s, p) => s + (inWindow(p) ? p.deviceRevenue + p.serviceRevenue : 0),
      0,
    );
  }

  for (const d of openDeals) {
    const conf = dealConfidence(d, overrides);
    const value = d.forecast.reduce(
      (s, p) => s + (inWindow(p) ? p.deviceRevenue + p.serviceRevenue : 0),
      0,
    );
    const weighted = value * conf;
    if (conf >= FORECAST_BANDS.committed) committed += weighted;
    else if (conf >= FORECAST_BANDS.atRisk) atRisk += weighted;
    else if (conf > 0) upside += weighted;
  }

  // Targets are period-ordered; the horizon's quarter count selects how many.
  const target = targets
    .slice(0, window)
    .reduce((s, t) => s + t.amountEur, 0);

  committed = Math.round(committed);
  return {
    committed,
    atRisk: Math.round(atRisk),
    upside: Math.round(upside),
    target: Math.round(target),
    gap: Math.round(target - committed),
  };
}

// ---------------------------------------------------------------------------
// Presentational band (server-component-safe; no client hooks)
// ---------------------------------------------------------------------------

export function ForecastSummary({
  figures,
  horizon,
}: {
  figures: ForecastSummaryFigures;
  horizon: Horizon;
}) {
  const { committed, atRisk, upside, target, gap } = figures;
  const covered = gap <= 0;
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          Gap to target · {HORIZON_LABELS[horizon]}
        </p>
        <p
          className={`text-sm font-semibold ${covered ? "text-success" : "text-warning"}`}
        >
          {covered ? "On / above target" : "Shortfall"}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <BandItem label="Committed" value={eur(committed)} tone="text-success" />
        <BandItem label="At-risk" value={eur(atRisk)} tone="text-warning" />
        <BandItem label="Upside" value={eur(upside)} tone="text-muted" />
        <BandItem
          label="Gap to target"
          value={covered ? `+${eur(-gap)}` : `−${eur(gap)}`}
          tone={covered ? "text-success" : "text-danger"}
          hint={`target ${eur(target)}`}
        />
      </div>

      {/* The "why" behind the gap — Finance's trust requirement. */}
      <p className="mt-3 text-xs text-muted">
        Gap = target {eur(target)} − committed {eur(committed)}.{" "}
        {covered
          ? "Committed already covers the target for this window."
          : `Need ${eur(gap)} more committed to hit target; ${eur(atRisk)} at-risk could close it.`}
      </p>
    </Card>
  );
}

function BandItem({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone: string;
  hint?: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className={`mt-0.5 text-lg font-semibold ${tone}`}>{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}
