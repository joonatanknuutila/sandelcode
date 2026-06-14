// Finance forecast narrative — "give me the number, plainly" (personas.md).
//
// Computes the figures per FORECAST_AND_PRICING.md (committed / at-risk /
// upside, device vs service kept separate, near-term device units for
// component buying) and turns them into a short plain-English narrative. The
// model just phrases it; all numbers are computed deterministically here so the
// narrative can never drift from the figures. Falls back to a templated
// narrative when no model is configured.

import { ChatMessage, complete } from "./provider";
import { getAllDeals } from "@/lib/db";
import { Deal, dealProbability } from "@/lib/types";
import { eur } from "@/lib/format";
import { FORECAST_BANDS } from "@/lib/scoring";
import type { ForecastSummaryFigures } from "@/components/ForecastSummary";
import type { Horizon } from "@/components/ForecastSummary";
import { HORIZON_LABELS } from "@/components/ForecastSummary";

export interface ForecastFigures {
  /** Weighted 3-yr pipeline (Σ TCV × winProb), open deals. */
  weightedPipeline: number;
  /** Un-weighted, bankable: stages with winProb ≥ 0.8. */
  committed: number;
  /** Weighted value of mid-stage deals (0.4 ≤ winProb < 0.8). */
  atRisk: number;
  /** Weighted value of early deals (winProb < 0.4). */
  upside: number;
  /** Device vs service revenue, weighted, kept separate (brief 2.2). */
  deviceWeighted: number;
  serviceWeighted: number;
  /** Device units expected in the near term (deal year 0) — drives buying. */
  nearTermDevices: number;
}

function isOpen(d: Deal): boolean {
  return d.stage !== "lost";
}

export async function computeForecast(): Promise<ForecastFigures> {
  const open = (await getAllDeals()).filter(isOpen);

  let committed = 0;
  let atRisk = 0;
  let upside = 0;
  let deviceWeighted = 0;
  let serviceWeighted = 0;
  let nearTermDevices = 0;
  let weightedPipeline = 0;

  for (const d of open) {
    const p = dealProbability(d);
    const tcv = d.forecast.reduce((s, f) => s + f.deviceRevenue + f.serviceRevenue, 0);
    weightedPipeline += tcv * p;

    if (p >= FORECAST_BANDS.committed) committed += tcv;
    else if (p >= FORECAST_BANDS.atRisk) atRisk += tcv * p;
    else if (p > 0) upside += tcv * p;

    deviceWeighted += d.forecast.reduce((s, f) => s + f.deviceRevenue, 0) * p;
    serviceWeighted += d.forecast.reduce((s, f) => s + f.serviceRevenue, 0) * p;
    nearTermDevices += d.forecast.filter((f) => f.year === 0).reduce((s, f) => s + f.devices, 0);
  }

  return {
    weightedPipeline: Math.round(weightedPipeline),
    committed: Math.round(committed),
    atRisk: Math.round(atRisk),
    upside: Math.round(upside),
    deviceWeighted: Math.round(deviceWeighted),
    serviceWeighted: Math.round(serviceWeighted),
    nearTermDevices,
  };
}

export interface ForecastNarrative {
  figures: ForecastFigures;
  text: string;
  modelUsed: boolean;
}

export async function forecastNarrative(): Promise<ForecastNarrative> {
  const f = await computeForecast();

  const facts =
    `Weighted 3-yr pipeline ${eur(f.weightedPipeline, false)}. ` +
    `Committed (bankable, ≥80%) ${eur(f.committed, false)}. ` +
    `At-risk (mid-stage, weighted) ${eur(f.atRisk, false)}. ` +
    `Upside (early, weighted) ${eur(f.upside, false)}. ` +
    `Device ${eur(f.deviceWeighted, false)} vs service ${eur(f.serviceWeighted, false)} (kept separate). ` +
    `Near-term device units to plan component buying: ${f.nearTermDevices}.`;

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "You are a cautious finance analyst for HMD Secure. Write a 2-3 sentence plain-English forecast narrative from the FACTS. Lead with committed vs weighted, note the device/service split and the near-term device units (they drive hardware buying). Use ONLY these numbers; do not invent. No bullet points.",
    },
    { role: "user", content: facts },
  ];

  const out = await complete(messages, { temperature: 0.3, maxTokens: 200 });
  if (out) return { figures: f, text: out.trim(), modelUsed: true };

  // Deterministic narrative.
  const text =
    `Weighted 3-year pipeline stands at ${eur(f.weightedPipeline, false)}, of which ${eur(f.committed, false)} is committed (≥80% stages, bankable for component planning) and ${eur(f.atRisk, false)} is at-risk in mid-stage deals. ` +
    `Revenue splits ${eur(f.deviceWeighted, false)} device / ${eur(f.serviceWeighted, false)} service — service is back-loaded and volume-dependent. ` +
    `Near term, plan for ~${f.nearTermDevices} device units; hardware must be ordered ahead of software.`;

  return { figures: f, text, modelUsed: false };
}

// ---------------------------------------------------------------------------
// Sales Manager pipeline-health narrative (SM M4)
// ---------------------------------------------------------------------------
//
// The story the SM opens the forecast meeting with. It reads the SAME band
// figures the board shows (passed in, computed by computeForecastSummary) plus
// the stalled count and the count of deals that have slipped past their close
// date — so the narrative can never drift from the numbers on screen. The model
// only phrases the supplied facts; falls back to a deterministic template with
// an honest "model offline" label, exactly like the Finance narrative above.

export interface PipelineNarrativeInput {
  /** Shared band figures (committed / at-risk / upside / target / gap). */
  figures: ForecastSummaryFigures;
  /** Open deals untouched for 14+ days (isStalled). */
  stalledCount: number;
  /** Open deals whose expected close date is already in the past. */
  slippedCount: number;
  /** Open deals in scope for this horizon (context only). */
  openCount: number;
  /** The selected horizon — phrases the window in the narrative. */
  horizon: Horizon;
}

export interface PipelineNarrative {
  text: string;
  modelUsed: boolean;
}

export async function pipelineNarrative(
  input: PipelineNarrativeInput,
): Promise<PipelineNarrative> {
  const { figures, stalledCount, slippedCount, openCount, horizon } = input;
  const window = HORIZON_LABELS[horizon].toLowerCase();
  const covered = figures.gap <= 0;
  const gapPhrase = covered
    ? `committed already covers the target by ${eur(-figures.gap, false)}`
    : `a ${eur(figures.gap, false)} gap to target`;

  const facts =
    `Window: ${window}. ` +
    `Committed ${eur(figures.committed, false)} against target ${eur(figures.target, false)} — ${gapPhrase}. ` +
    `At-risk ${eur(figures.atRisk, false)} (mid-stage), upside ${eur(figures.upside, false)} (early). ` +
    `${openCount} open deals in scope. ` +
    `${stalledCount} stalled 14+ days. ` +
    `${slippedCount} slipped past their expected close date.`;

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "You are a sharp sales manager opening the team's forecast meeting. Write a 2-3 sentence plain-English pipeline-health story from the FACTS. Lead with committed vs target and the gap, then call out what needs intervention (stalled and slipped deals). Use ONLY these numbers; do not invent. Be direct, no bullet points.",
    },
    { role: "user", content: facts },
  ];

  const out = await complete(messages, { temperature: 0.3, maxTokens: 180 });
  if (out) return { text: out.trim(), modelUsed: true };

  // Deterministic fallback.
  const lead = covered
    ? `Committed ${eur(figures.committed, false)} for ${window} — on target, with ${eur(-figures.gap, false)} of headroom.`
    : `Committed ${eur(figures.committed, false)} for ${window} leaves a ${eur(figures.gap, false)} gap to target; ${eur(figures.atRisk, false)} at-risk in mid-stage deals could close it.`;
  const risk =
    stalledCount === 0 && slippedCount === 0
      ? "Nothing stalled and nothing slipped — the pipeline is moving."
      : `${stalledCount} ${stalledCount === 1 ? "deal is" : "deals are"} stalled 14+ days` +
        (slippedCount > 0
          ? ` and ${slippedCount} ${slippedCount === 1 ? "has" : "have"} slipped past close — both need intervention now.`
          : " and need intervention now.");

  return { text: `${lead} ${risk}`, modelUsed: false };
}
