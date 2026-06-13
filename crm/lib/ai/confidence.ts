// Per-opportunity confidence score (Stage 3 differentiator, per
// FORECAST_AND_PRICING.md). Rule logic, not a model: confidence = stage win%
// adjusted by observable signals, with a generated reasoning string so Finance
// sees *why*. Finance can override the realistic number (Stage 5) — the
// override is what should feed gap-to-target.

import { Deal, dealProbability } from "@/lib/types";
import { getActivitiesForDeal, getOffersForDeal } from "@/lib/db";
import { relativeDays } from "@/lib/format";

export type ConfidenceBand = "low" | "medium" | "high";

export interface Confidence {
  /** Base = stage win-probability × 100. */
  base: number;
  /** Adjusted score, 0-100. */
  score: number;
  band: ConfidenceBand;
  reasons: string[];
}

function band(score: number): ConfidenceBand {
  if (score < 40) return "low";
  if (score < 70) return "medium";
  return "high";
}

export async function confidence(deal: Deal): Promise<Confidence> {
  const base = Math.round(dealProbability(deal) * 100);
  const reasons: string[] = [`Stage "${deal.stage}" baseline ${base}%.`];

  // Terminal stages are certain — no adjustment, no noise.
  if (deal.stage === "won" || deal.stage === "lost") {
    return { base, score: base, band: band(base), reasons: [`Deal is ${deal.stage}.`] };
  }

  let score = base;

  // Staleness — the single strongest live signal.
  const last = (await getActivitiesForDeal(deal.id))[0];
  const staleDays = last ? relativeDays(last.createdAt) : relativeDays(deal.updatedAt);
  if (staleDays >= 21) {
    score -= 15;
    reasons.push(`No activity in ${staleDays} days (−15).`);
  } else if (staleDays >= 14) {
    score -= 8;
    reasons.push(`Quiet for ${staleDays} days (−8).`);
  } else if (staleDays <= 7) {
    score += 5;
    reasons.push(`Recent engagement, ${staleDays}d ago (+5).`);
  }

  // Reseller = less direct control over the customer.
  if (deal.channel === "reseller") {
    score -= 5;
    reasons.push("Reseller-led, less direct control (−5).");
  }

  // Past its own expected close while still open = slipping.
  if (relativeDays(deal.expectedCloseDate) > 0) {
    score -= 10;
    reasons.push("Past expected close date (−10).");
  }

  // An approved offer on the table is real commercial momentum.
  if ((await getOffersForDeal(deal.id)).some((o) => o.status === "approved")) {
    score += 8;
    reasons.push("Approved offer on the table (+8).");
  }

  score = Math.max(0, Math.min(100, score));
  return { base, score, band: band(score), reasons };
}

export interface EffectiveConfidence extends Confidence {
  /** Finance's manual number, if set. */
  override?: number;
  /** The number that feeds the forecast (override if present, else score). */
  effective: number;
  overridden: boolean;
}

/** Apply a Finance override (Stage 5). The override is what feeds gap-to-target. */
export async function withOverride(deal: Deal, override?: number): Promise<EffectiveConfidence> {
  const c = await confidence(deal);
  const has = typeof override === "number" && override >= 0 && override <= 100;
  return {
    ...c,
    override: has ? Math.round(override!) : undefined,
    effective: has ? Math.round(override!) : c.score,
    overridden: has,
  };
}
