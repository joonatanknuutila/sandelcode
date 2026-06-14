// Pure, dependency-light confidence for the rep UI (§0.2 "one confidence").
//
// The async lib/ai/confidence.ts is the authoritative engine (it queries the
// per-deal activity + offer history) and feeds Finance's forecast. For the rep
// surface we need ONE number that looks identical everywhere a deal appears —
// dashboard cards, the deals table, the account side panel and the deal header —
// without N per-deal round-trips. dealConfidence() derives that number from the
// Deal object alone: stage win-probability nudged by recency, channel and a
// slipped close date. Same constants (CONFIDENCE) and same banding as the engine
// so the displayed figure agrees with it.

import { Deal, dealProbability } from "@/lib/types";
import { relativeDays } from "@/lib/format";
import { CONFIDENCE } from "@/lib/scoring";

export type ConfidenceBand = "low" | "medium" | "high";

export interface DealConfidence {
  /** Adjusted score, 0–100 — the number shown to the rep. */
  score: number;
  band: ConfidenceBand;
  /** Plain-language drivers, for the deal page's "Why?". */
  reasons: string[];
}

function bandFor(score: number): ConfidenceBand {
  if (score < CONFIDENCE.band.lowMax) return "low";
  if (score < CONFIDENCE.band.mediumMax) return "medium";
  return "high";
}

/** Rule-based confidence from a Deal alone — no DB. Mirrors lib/ai/confidence. */
export function dealConfidence(deal: Deal): DealConfidence {
  const base = Math.round(dealProbability(deal) * 100);
  if (deal.stage === "won" || deal.stage === "lost") {
    return { score: base, band: bandFor(base), reasons: [`Deal is ${deal.stage}.`] };
  }

  let score = base;
  const reasons: string[] = [`Stage gives a ${base}% baseline.`];
  const { staleness: s } = CONFIDENCE;

  // Recency — days since the deal was last touched.
  const idle = relativeDays(deal.updatedAt);
  if (idle >= s.severeDays) {
    score -= s.severePenalty;
    reasons.push(`No contact in ${idle} days (−${s.severePenalty}).`);
  } else if (idle >= s.quietDays) {
    score -= s.quietPenalty;
    reasons.push(`Going quiet — ${idle} days since contact (−${s.quietPenalty}).`);
  } else if (idle <= s.freshWithinDays) {
    score += s.freshBonus;
    reasons.push(`Recent contact, ${idle} day${idle === 1 ? "" : "s"} ago (+${s.freshBonus}).`);
  }

  if (deal.channel === "reseller") {
    score -= CONFIDENCE.resellerPenalty;
    reasons.push(`Partner-led, less direct control (−${CONFIDENCE.resellerPenalty}).`);
  }

  if (deal.expectedCloseDate && new Date(deal.expectedCloseDate).getTime() < Date.now()) {
    score -= CONFIDENCE.pastClosePenalty;
    reasons.push(`Past its expected close date (−${CONFIDENCE.pastClosePenalty}).`);
  }

  score = Math.max(0, Math.min(100, score));
  return { score, band: bandFor(score), reasons };
}
