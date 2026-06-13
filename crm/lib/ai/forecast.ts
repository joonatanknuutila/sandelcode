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

    if (p >= 0.8) committed += tcv;
    else if (p >= 0.4) atRisk += tcv * p;
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
