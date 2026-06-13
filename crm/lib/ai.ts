// "AI next best action" — a deterministic stub now, to be replaced by Aarni's
// Azure OpenAI agent (brief P1). Same signature; the UI doesn't change when the
// real model lands. Picks a sensible next step from the deal's stage + timeline.

import { getActivitiesForDeal } from "./api";
import { Deal, STAGE_LABELS } from "./types";
import { relativeDays } from "./format";

export interface NextBestAction {
  headline: string;
  detail: string;
  /** Suggested CTA the rep can act on in one click. */
  cta: string;
}

export function nextBestAction(deal: Deal): NextBestAction {
  const last = getActivitiesForDeal(deal.id)[0];
  const staleDays = last ? relativeDays(last.createdAt) : 99;

  if (staleDays >= 14) {
    return {
      headline: "Re-engage — this deal has gone quiet",
      detail: `No activity in ${staleDays} days at "${STAGE_LABELS[deal.stage]}". A short check-in keeps momentum before it slips.`,
      cta: "Draft a check-in email",
    };
  }

  switch (deal.stage) {
    case "interest":
      return { headline: "Qualify the opportunity", detail: "Confirm budget, timeline and the security requirements driving interest.", cta: "Log a discovery call" };
    case "rfi":
      return { headline: "Push toward an offer", detail: "RFI is answered — propose a scoped pilot to move into RFP.", cta: "Build an offer" };
    case "rfp":
      return { headline: "Follow up on the offer", detail: "An offer is out. Check the decision timeline and address open objections.", cta: "Schedule a follow-up" };
    case "customer_test":
      return { headline: "Convert the pilot", detail: "Capture pilot success metrics and line up the follow-on 3-year order.", cta: "Request test feedback" };
    case "contract_negotiation":
      return { headline: "Close the contract", detail: "Final terms in play — confirm pricing approval and target signature date.", cta: "Confirm close plan" };
    default:
      return { headline: "Review the account", detail: "Keep the timeline current so the whole team stays in sync.", cta: "Add a note" };
  }
}
