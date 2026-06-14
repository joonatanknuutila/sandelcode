// "AI next best action" — async, grounded in the live timeline and offers.
// Falls back to deterministic logic when the model is offline; honest labeling.

import { Activity, Deal, Offer, REP_STAGE_LABELS } from "../types";
import { relativeDays } from "../format";
import { STALE_DAYS } from "../scoring";
import { ChatMessage, complete } from "./provider";

export type NbaCTAKind =
  | "log_call"
  | "draft_email"
  | "open_offer"
  | "move_stage";

export interface NbaCTA {
  kind: NbaCTAKind;
  label: string;
}

export interface NextBestAction {
  headline: string;
  /** One-line rationale grounded in the timeline / offers. */
  detail: string;
  /** The suggested CTA the rep can act on in one click. */
  cta: NbaCTA;
  /** True when the Azure model produced this result. */
  modelUsed: boolean;
}

/** Days since the most recent activity. With no activity at all the deal reads
 *  as maximally stale, so we return a large sentinel rather than 0. */
const NO_ACTIVITY_STALE_DAYS = 99;
function daysSinceLastActivity(activities: Activity[]): number {
  return activities.length > 0
    ? relativeDays(activities[0].createdAt)
    : NO_ACTIVITY_STALE_DAYS;
}

// ---------------------------------------------------------------------------
// Deterministic fallback — always works without a model key
// ---------------------------------------------------------------------------
function deterministicNBA(
  deal: Deal,
  activities: Activity[],
  offers: Offer[],
): NextBestAction {
  const staleDays = daysSinceLastActivity(activities);

  if (staleDays >= STALE_DAYS) {
    return {
      headline: `Re-engage — quiet ${staleDays} days`,
      detail: `No activity in ${staleDays} days at stage "${REP_STAGE_LABELS[deal.stage]}". A short check-in keeps momentum before this deal slips.`,
      cta: { kind: "log_call", label: "Log a check-in call" },
      modelUsed: false,
    };
  }

  const openOffers = offers.filter(
    (o) => o.status === "pending_sm" || o.status === "pending_finance" || o.status === "approved",
  );

  if (deal.stage === "rfp" && openOffers.length > 0) {
    return {
      headline: "Follow up on the offer",
      detail: `Offer v${openOffers[0].version} (${openOffers[0].status.replace("_", " ")}) is outstanding. Check the decision timeline and address open objections.`,
      cta: { kind: "open_offer", label: "View offer" },
      modelUsed: false,
    };
  }

  switch (deal.stage) {
    case "interest":
      return {
        headline: "Qualify the opportunity",
        detail: "Confirm budget, timeline, and the security requirements driving interest.",
        cta: { kind: "log_call", label: "Log a discovery call" },
        modelUsed: false,
      };
    case "rfi":
      return {
        headline: "Push toward an offer",
        detail: "The customer's questions are answered — propose a scoped pilot and send your offer.",
        cta: { kind: "draft_email", label: "Draft proposal email" },
        modelUsed: false,
      };
    case "rfp":
      return {
        headline: "Follow up on the offer",
        detail: "An offer is out. Check the decision timeline and address open objections.",
        cta: { kind: "draft_email", label: "Draft follow-up email" },
        modelUsed: false,
      };
    case "customer_test":
      return {
        headline: "Convert the pilot",
        detail: "Capture pilot success metrics and line up the follow-on 3-year order.",
        cta: { kind: "log_call", label: "Log pilot review call" },
        modelUsed: false,
      };
    case "contract_negotiation":
      return {
        headline: "Close the contract",
        detail: "Final terms in play — confirm pricing approval and target signature date.",
        cta: { kind: "move_stage", label: "Mark as Won" },
        modelUsed: false,
      };
    default:
      return {
        headline: "Review the account",
        detail: "Keep the timeline current so the whole team stays in sync.",
        cta: { kind: "log_call", label: "Add a note" },
        modelUsed: false,
      };
  }
}

// ---------------------------------------------------------------------------
// Main export — async, grounded
// ---------------------------------------------------------------------------
export async function nextBestAction(
  deal: Deal,
  activities: Activity[],
  offers: Offer[],
): Promise<NextBestAction> {
  const recentSummary = activities
    .slice(0, 5)
    .map((a) => `[${a.type}] ${a.body ?? ""}`.trim())
    .join("\n");
  const offerSummary = offers
    .map((o) => `Offer v${o.version} status=${o.status} total=${o.total}`)
    .join("; ");

  const staleDays = daysSinceLastActivity(activities);

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        `You are a CRM copilot for a B2B security hardware sales rep. ` +
        `Analyse the deal context below and return exactly one JSON object: ` +
        `{"headline": string, "detail": string, "cta_kind": "log_call"|"draft_email"|"open_offer"|"move_stage", "cta_label": string}. ` +
        `headline: ≤8 words. detail: one grounded sentence citing the timeline or offer. ` +
        `Pick the CTA kind that would most advance the deal right now. ` +
        `All amounts are in euros (€) — never write "$" or any other currency. ` +
        `Write for the rep in plain language; never use internal acronyms or jargon ` +
        `(no RFI, RFP, TCV, SLA, "weighted", "% confidence", "win probability"). ` +
        `Do NOT invent facts not present in the context.`,
    },
    {
      role: "user",
      content:
        `Deal: ${deal.name} | Stage: ${REP_STAGE_LABELS[deal.stage]} | ` +
        `Days since last activity: ${staleDays}\n` +
        `Recent activity:\n${recentSummary || "none"}\n` +
        `Offers: ${offerSummary || "none"}`,
    },
  ];

  const raw = await complete(messages, { temperature: 0.2, maxTokens: 300, json: true });
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const validKinds: NbaCTAKind[] = ["log_call", "draft_email", "open_offer", "move_stage"];
      const kind: NbaCTAKind = validKinds.includes(parsed.cta_kind)
        ? parsed.cta_kind
        : "log_call";
      return {
        headline: String(parsed.headline ?? ""),
        detail: String(parsed.detail ?? ""),
        cta: { kind, label: String(parsed.cta_label ?? "Take action") },
        modelUsed: true,
      };
    } catch {
      // fall through to deterministic
    }
  }

  return deterministicNBA(deal, activities, offers);
}
