// The "what's going on / what to do" brief shown when the Agent Dock opens.
//
// Deterministic and grounded — built straight from the read layer (no model
// needed), so it's instant and always honest. Returns a short headline, a few
// situational items, and one-tap SUGGESTIONS whose `prompt` is sent back to the
// agent as a normal turn (so a suggestion can lead to a real action).
import "server-only";
import {
  getAccounts,
  getAllCases,
  getCasesForTam,
  getDealsForRep,
  getOffersByStatus,
  getOpenDeals,
  isAtRisk,
  isOverdue,
  isStalled,
  weightedValue,
} from "@/lib/db";
import { computeForecast } from "./forecast";
import { slaInfo, triageSort } from "@/lib/tam";
import { Role, STAGE_LABELS } from "@/lib/types";
import { eur } from "@/lib/format";

export interface Suggestion {
  label: string;
  /** Prompt sent to the agent when the chip is tapped. */
  prompt: string;
}

export interface Brief {
  headline: string;
  items: string[];
  suggestions: Suggestion[];
}

export async function buildBrief(role: Role, userId: string | null): Promise<Brief> {
  if (role === "tam") return tamBrief(userId);
  if (role === "finance") return financeBrief();
  return salesBrief(role, userId);
}

// Finance gets a numbers-first lens (not the sales-manager pipeline view):
// weighted forecast bands + the approvals actually sitting in their queue.
async function financeBrief(): Promise<Brief> {
  const [f, pendingFinance] = await Promise.all([
    computeForecast(),
    getOffersByStatus("pending_finance"),
  ]);

  const items: string[] = [
    `Weighted pipeline ${eur(f.weightedPipeline, false)} · bankable (committed) ${eur(f.committed, false)}.`,
    `${eur(f.atRisk, false)} weighted sits in mid-stage (at-risk) deals.`,
    pendingFinance.length
      ? `${pendingFinance.length} offer${pendingFinance.length === 1 ? "" : "s"} awaiting your finance sign-off.`
      : "No offers waiting on finance approval.",
  ];

  const suggestions: Suggestion[] = [];
  if (pendingFinance.length) {
    suggestions.push({
      label: "Review offers awaiting approval",
      prompt: "Which offers are awaiting finance approval, and what discount does each carry?",
    });
  }
  suggestions.push({
    label: "Break down the forecast",
    prompt: "Break down the weighted forecast into committed, at-risk and upside.",
  });
  suggestions.push({
    label: "Where's the revenue risk?",
    prompt: "Which deals carry the most weighted revenue at risk right now?",
  });

  return {
    headline: pendingFinance.length
      ? `${pendingFinance.length} offer${pendingFinance.length === 1 ? "" : "s"} need finance sign-off`
      : "Forecast is in good shape",
    items,
    suggestions,
  };
}

async function salesBrief(role: Role, userId: string | null): Promise<Brief> {
  const accounts = await getAccounts();
  const acctName = new Map(accounts.map((a) => [a.id, a.name]));
  const deals =
    role === "rep" && userId
      ? (await getDealsForRep(userId)).filter((d) => d.stage !== "won" && d.stage !== "lost")
      : await getOpenDeals();

  const atRisk = deals.filter(isAtRisk);
  const weighted = deals.reduce((s, d) => s + weightedValue(d), 0);
  const top = [...atRisk].sort((a, b) => b.tcv - a.tcv)[0];

  const items: string[] = [
    `${deals.length} open deal${deals.length === 1 ? "" : "s"} · weighted pipeline ${eur(weighted, false)}.`,
  ];
  if (atRisk.length) {
    items.push(`${atRisk.length} need attention (stalled or past expected close).`);
  } else {
    items.push("Nothing at risk right now — pipeline is moving.");
  }
  if (top) {
    const why = isOverdue(top) ? "past expected close" : isStalled(top) ? "no update in 14d+" : "needs a push";
    items.push(`Top focus: "${top.name}" (${acctName.get(top.accountId) ?? "?"}) — ${STAGE_LABELS[top.stage]}, ${why}.`);
  }

  const suggestions: Suggestion[] = [];
  if (top) {
    suggestions.push({ label: `Log a follow-up on ${top.name}`, prompt: `Log a follow-up note on the deal "${top.name}" to chase the next step.` });
    suggestions.push({ label: `Advance ${top.name}`, prompt: `Move the deal "${top.name}" to the next stage.` });
  }
  suggestions.push({ label: "What should I focus on today?", prompt: "What should I focus on today? Give me my top 3 priorities." });

  return {
    headline: atRisk.length ? `${atRisk.length} deal${atRisk.length === 1 ? "" : "s"} need your attention` : "You're on top of your pipeline",
    items,
    suggestions,
  };
}

async function tamBrief(userId: string | null): Promise<Brief> {
  const accounts = await getAccounts();
  const acctName = new Map(accounts.map((a) => [a.id, a.name]));
  const open = (userId ? await getCasesForTam(userId) : await getAllCases()).filter(
    (c) => c.status !== "resolved",
  );
  const triaged = triageSort(open);
  const pressing = triaged.filter((c) => ["breach", "soon"].includes(slaInfo(c).state));
  const top = triaged[0];

  const items: string[] = [
    `${open.length} open case${open.length === 1 ? "" : "s"} in your queue.`,
  ];
  if (pressing.length) items.push(`${pressing.length} at or near SLA breach.`);
  else items.push("No SLA breaches imminent.");
  if (top) items.push(`Top case: "${top.title}" (${acctName.get(top.accountId) ?? "?"}) — ${top.priority} priority, ${slaInfo(top).label}.`);

  const suggestions: Suggestion[] = [];
  if (top) {
    suggestions.push({ label: `Note on "${top.title}"`, prompt: `Add an internal note on case "${top.title}" with the current status.` });
    suggestions.push({ label: `Mark "${top.title}" in progress`, prompt: `Set case "${top.title}" status to in progress.` });
  }
  suggestions.push({ label: "Which cases breach SLA first?", prompt: "Which cases are at risk of breaching SLA, soonest first?" });

  return {
    headline: pressing.length ? `${pressing.length} case${pressing.length === 1 ? "" : "s"} near SLA` : "Your case queue is under control",
    items,
    suggestions,
  };
}
