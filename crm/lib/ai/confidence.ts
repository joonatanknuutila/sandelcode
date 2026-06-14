// Per-opportunity confidence score (Stage 3 differentiator, per
// FORECAST_AND_PRICING.md). Rule logic, not a model: confidence = stage win%
// adjusted by observable signals, with a generated reasoning string so Finance
// sees *why*. Finance can override the realistic number (Stage 5) — the
// override is what should feed gap-to-target.

import { Deal, dealProbability } from "@/lib/types";
import { getActivitiesForDeal, getOffersForDeal } from "@/lib/db";
import { relativeDays } from "@/lib/format";
import { CONFIDENCE } from "@/lib/scoring";

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
  if (score < CONFIDENCE.band.lowMax) return "low";
  if (score < CONFIDENCE.band.mediumMax) return "medium";
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

  const { staleness: s } = CONFIDENCE;

  // Staleness — the single strongest live signal.
  const last = (await getActivitiesForDeal(deal.id))[0];
  const staleDays = last ? relativeDays(last.createdAt) : relativeDays(deal.updatedAt);
  if (staleDays >= s.severeDays) {
    score -= s.severePenalty;
    reasons.push(`No activity in ${staleDays} days (−${s.severePenalty}).`);
  } else if (staleDays >= s.quietDays) {
    score -= s.quietPenalty;
    reasons.push(`Quiet for ${staleDays} days (−${s.quietPenalty}).`);
  } else if (staleDays <= s.freshWithinDays) {
    score += s.freshBonus;
    reasons.push(`Recent engagement, ${staleDays}d ago (+${s.freshBonus}).`);
  }

  // Reseller = less direct control over the customer.
  if (deal.channel === "reseller") {
    score -= CONFIDENCE.resellerPenalty;
    reasons.push(`Reseller-led, less direct control (−${CONFIDENCE.resellerPenalty}).`);
  }

  // Past its own expected close while still open = slipping.
  if (relativeDays(deal.expectedCloseDate) > 0) {
    score -= CONFIDENCE.pastClosePenalty;
    reasons.push(`Past expected close date (−${CONFIDENCE.pastClosePenalty}).`);
  }

  // An approved offer on the table is real commercial momentum.
  if ((await getOffersForDeal(deal.id)).some((o) => o.status === "approved")) {
    score += CONFIDENCE.approvedOfferBonus;
    reasons.push(`Approved offer on the table (+${CONFIDENCE.approvedOfferBonus}).`);
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
