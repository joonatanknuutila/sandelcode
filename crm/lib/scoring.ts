// Tunable business constants for pipeline scoring, deal-risk and forecasting.
//
// These were previously magic numbers duplicated across lib/db/index.ts and
// lib/ai/* (the 14-day stalled threshold, the confidence weights, the forecast
// probability bands). Centralised here so each rule is
// documented in one place and can be tuned without hunting through the
// codebase. Pure data — no logic, no imports — safe on both server and client.

/**
 * A deal counts as "stalled" / at deal-risk when it is open and has not been
 * touched for at least this many days (brief P1). Single source of truth for
 * the db layer's isStalled and the SM/rep deal-risk flags.
 */
export const STALE_DAYS = 14;

/**
 * Per-opportunity confidence scoring (lib/ai/confidence.ts). Confidence starts
 * at the stage win-probability (×100) and is nudged by observable signals.
 */
export const CONFIDENCE = {
  /** score < lowMax → "low"; < mediumMax → "medium"; otherwise "high". */
  band: { lowMax: 40, mediumMax: 70 },
  /** Staleness adjustments — the strongest live signal. Days since last activity. */
  staleness: {
    severeDays: 21,
    severePenalty: 15,
    quietDays: STALE_DAYS,
    quietPenalty: 8,
    freshWithinDays: 7,
    freshBonus: 5,
  },
  /** Reseller-led deals — less direct control over the customer. */
  resellerPenalty: 5,
  /** Open deal already past its own expected close date — slipping. */
  pastClosePenalty: 10,
  /** An approved offer on the table — real commercial momentum. */
  approvedOfferBonus: 8,
} as const;

/**
 * Offer discount approval routing. Every submitted offer goes to the Sales
 * Manager first; once they approve, a discount strictly above this threshold
 * escalates to a second Finance approval (otherwise it's approved outright).
 * Used by both the submit action and the approval mutation so they agree.
 */
export const OFFER = {
  /** Discounts > this % require Finance approval after the SM signs off. */
  financeApprovalDiscountPct: 10,
} as const;

/** True when a discount needs the second (Finance) approval gate. */
export function requiresFinanceApproval(discountPct: number): boolean {
  return discountPct > OFFER.financeApprovalDiscountPct;
}

/**
 * Forecast probability bands (lib/ai/forecast.ts). A deal's win-probability
 * sorts it into committed (bankable) / at-risk / upside buckets.
 */
export const FORECAST_BANDS = {
  /** winProb ≥ committed → committed (un-weighted, bankable). */
  committed: 0.8,
  /** committed > winProb ≥ atRisk → at-risk (weighted). Below → upside. */
  atRisk: 0.4,
} as const;
