// Pure finance dashboard selectors — the single source of truth for the chart
// figures so the visuals can never diverge from the tables/grid (the same rule
// ForecastSummary follows for the band math). No data fetching, no React: these
// run server-side over already-fetched typed data and are unit-testable.

import {
  Account,
  Deal,
  Offer,
  Stage,
  STAGE_LABELS,
  STAGE_ORDER,
  dealProbability,
} from "@/lib/types";
import type { ConfidenceBand } from "@/lib/ai/confidence";

const ACTIVE_STAGES: Stage[] = STAGE_ORDER.filter(
  (s) => s !== "won" && s !== "lost",
);

/** Absolute quarter index of a forecast point (year 0..2, quarter 1..4). */
function quarterOffset(p: { year: number; quarter: number }): number {
  return p.year * 4 + (p.quarter - 1);
}

/** A deal's device + service revenue landing within the first `window` quarters
 *  of the horizon — the figure every windowed chart reconciles against. Pass
 *  window = 12 for the full 3-year view (equivalent to the deal's TCV). */
export function dealRevenueInWindow(
  d: Deal,
  window: number,
): { device: number; service: number; total: number } {
  let device = 0;
  let service = 0;
  for (const f of d.forecast) {
    if (quarterOffset(f) < window) {
      device += f.deviceRevenue;
      service += f.serviceRevenue;
    }
  }
  return { device, service, total: device + service };
}

// --- Device vs service revenue split (brief keeps these separate) -----------

export interface RevenueSplit {
  device: number;
  service: number;
}

/** Weighted device vs service revenue across all non-lost deals (won counts at
 *  full probability via dealProbability). Summed from the time-phased points. */
export function deviceServiceSplit(deals: Deal[], window: number): RevenueSplit {
  let device = 0;
  let service = 0;
  for (const d of deals) {
    if (d.stage === "lost") continue;
    const p = dealProbability(d);
    const w = dealRevenueInWindow(d, window);
    device += w.device * p;
    service += w.service * p;
  }
  return { device: Math.round(device), service: Math.round(service) };
}

// --- Pipeline funnel by stage -----------------------------------------------

export interface FunnelStage {
  stage: Stage;
  label: string;
  /** Total opportunity (TCV) sitting in this stage. */
  value: number;
  count: number;
}

/** Open pipeline value by active stage, in pipeline order — the funnel.
 *  Value is the revenue landing inside the horizon window. */
export function stageFunnel(openDeals: Deal[], window: number): FunnelStage[] {
  return ACTIVE_STAGES.map((stage) => {
    const inStage = openDeals.filter((d) => d.stage === stage);
    return {
      stage,
      label: STAGE_LABELS[stage],
      value: inStage.reduce((s, d) => s + dealRevenueInWindow(d, window).total, 0),
      count: inStage.length,
    };
  });
}

// --- Revenue concentration by region / industry / channel -------------------

export type Dimension = "region" | "industry" | "channel";

export const DIMENSION_LABELS: Record<Dimension, string> = {
  region: "Region",
  industry: "Industry",
  channel: "Channel",
};

export interface DimensionSlice {
  key: string;
  /** Weighted pipeline value in this slice. */
  value: number;
  count: number;
}

/** Weighted open-pipeline value grouped by an account dimension (region /
 *  industry) or the deal's own channel. Sorted high → low. */
export function revenueByDimension(
  openDeals: Deal[],
  accounts: Account[],
  dim: Dimension,
  window: number,
): DimensionSlice[] {
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const groups = new Map<string, { value: number; count: number }>();

  for (const d of openDeals) {
    let key: string;
    if (dim === "channel") {
      key = d.channel === "reseller" ? "Reseller" : "Direct";
    } else {
      const a = accountById.get(d.accountId);
      key = a ? (dim === "region" ? a.region : a.industry) : "Unknown";
    }
    const cur = groups.get(key) ?? { value: 0, count: 0 };
    cur.value += dealRevenueInWindow(d, window).total * dealProbability(d);
    cur.count += 1;
    groups.set(key, cur);
  }

  return [...groups.entries()]
    .map(([key, v]) => ({ key, value: Math.round(v.value), count: v.count }))
    .sort((a, b) => b.value - a.value);
}

// --- Confidence distribution (value-weighted by band) -----------------------

const BAND_ORDER: ConfidenceBand[] = ["low", "medium", "high"];
const BAND_LABELS: Record<ConfidenceBand, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export interface ConfidenceBucket {
  band: ConfidenceBand;
  label: string;
  /** In-window opportunity whose confidence falls in this band. */
  value: number;
  count: number;
}

/** Aggregate per-deal confidence into low/medium/high buckets by in-window
 *  value — how much pipeline rests on shaky vs solid deals. */
export function confidenceDistribution(
  items: { band: ConfidenceBand; value: number }[],
): ConfidenceBucket[] {
  return BAND_ORDER.map((band) => {
    const inBand = items.filter((v) => v.band === band);
    return {
      band,
      label: BAND_LABELS[band],
      value: inBand.reduce((s, v) => s + v.value, 0),
      count: inBand.length,
    };
  });
}

// --- Discount / margin exposure ---------------------------------------------

export interface DiscountExposure {
  /** Σ value of offers awaiting the Finance gate. */
  totalValue: number;
  count: number;
  /** Largest single line discount across pending offers (percentage points). */
  maxDiscount: number;
  /** Mean line discount across pending offers (percentage points). */
  avgDiscount: number;
}

/** Margin risk sitting in the Finance approval queue. */
export function discountExposure(pendingOffers: Offer[]): DiscountExposure {
  const discounts = pendingOffers.flatMap((o) =>
    o.lines.map((l) => l.discountPct),
  );
  const avg =
    discounts.length > 0
      ? Math.round(discounts.reduce((s, x) => s + x, 0) / discounts.length)
      : 0;
  return {
    totalValue: pendingOffers.reduce((s, o) => s + o.total, 0),
    count: pendingOffers.length,
    maxDiscount: discounts.length > 0 ? Math.max(...discounts) : 0,
    avgDiscount: avg,
  };
}

// --- Close rate -------------------------------------------------------------

/** won / (won + lost) as a 0-100 integer, or null when nothing has closed. */
export function closeRate(wonCount: number, lostCount: number): number | null {
  const closed = wonCount + lostCount;
  return closed > 0 ? Math.round((wonCount / closed) * 100) : null;
}
