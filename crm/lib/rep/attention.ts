// "Needs your attention" + "Today's next steps" for the rep dashboard (§1.2/1.3).
//
// Pure: derived from data the dashboard already loads (deals, accounts,
// notifications) so it computes on view-open with no scheduler and no extra
// round-trips. Combines two sources into one ranked action list:
//   • computed deal-risk (going quiet, close date passing) from the deal set;
//   • resolved approvals / threatening cases / inbox replies, which already
//     arrive as notification rows with a deep link.

import { Account, Deal } from "@/lib/types";
import { AppNotification } from "@/lib/types";
import { relativeDays, shortDate } from "@/lib/format";
import { STALE_DAYS } from "@/lib/scoring";

export type AttentionTone = "risk" | "info" | "good";

export interface AttentionItem {
  id: string;
  /** Short, plain-language sentence. */
  sentence: string;
  /** The account / deal it concerns. */
  context?: string;
  href?: string;
  tone: AttentionTone;
  /** Sort weight — lower surfaces first. */
  rank: number;
}

const CLOSING_SOON_DAYS = 10;

function isOpen(d: Deal): boolean {
  return d.stage !== "won" && d.stage !== "lost";
}

/** The ranked attention list. accountsById resolves a deal's account name. */
export function buildAttention(
  deals: Deal[],
  accountsById: Map<string, Account>,
  notifications: AppNotification[],
): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const d of deals.filter(isOpen)) {
    const account = accountsById.get(d.accountId);
    const name = account?.name ?? "this account";
    const href = `/rep/deals/${d.id}`;
    const idle = relativeDays(d.updatedAt);
    const daysToClose = d.expectedCloseDate
      ? -relativeDays(d.expectedCloseDate)
      : null;

    if (daysToClose !== null && daysToClose < 0) {
      items.push({
        id: `overdue-${d.id}`,
        sentence: `Expected close date has passed — time to check in or update it.`,
        context: name,
        href,
        tone: "risk",
        rank: 0,
      });
    } else if (daysToClose !== null && daysToClose <= CLOSING_SOON_DAYS) {
      items.push({
        id: `closing-${d.id}`,
        sentence: `Expected to close ${shortDate(d.expectedCloseDate)} — keep it moving.`,
        context: name,
        href,
        tone: "info",
        rank: 2,
      });
    }

    if (idle >= STALE_DAYS) {
      items.push({
        id: `quiet-${d.id}`,
        sentence: `Going quiet — no contact in ${idle} days.`,
        context: name,
        href,
        tone: "risk",
        rank: 1,
      });
    }
  }

  // Notifications already encode resolved approvals, threatening cases and inbox
  // replies. Rank a touch below computed deal-risk, with a tone read off the text.
  for (const n of notifications) {
    const lower = n.body.toLowerCase();
    const tone: AttentionTone = /approved|resolved|won|signed/.test(lower)
      ? "good"
      : /reject|breach|risk|urgent|overdue|escalat/.test(lower)
        ? "risk"
        : "info";
    items.push({
      id: `note-${n.id}`,
      sentence: n.body,
      href: n.href,
      tone,
      rank: tone === "risk" ? 1.5 : tone === "good" ? 2.5 : 3,
    });
  }

  return items.sort((a, b) => a.rank - b.rank);
}

export interface NextStep {
  dealId: string;
  headline: string;
  context: string;
  href: string;
}

/** A cheap, deterministic "do this today" suggestion per deal that needs one.
 *  Stage- and risk-based — no model call, so it's safe to run for every deal on
 *  dashboard load. The per-deal grounded NBA still lives on the deal page. */
export function nextSteps(
  deals: Deal[],
  accountsById: Map<string, Account>,
  limit = 5,
): NextStep[] {
  const open = deals.filter(isOpen);
  const scored = open.map((d) => {
    const name = accountsById.get(d.accountId)?.name ?? "this account";
    const idle = relativeDays(d.updatedAt);
    const overdue = d.expectedCloseDate
      ? new Date(d.expectedCloseDate).getTime() < Date.now()
      : false;

    let headline: string;
    let urgency: number;
    if (overdue) {
      headline = "Check in — the expected close date has passed.";
      urgency = 0;
    } else if (idle >= STALE_DAYS) {
      headline = `Re-engage — it's gone quiet (${idle} days).`;
      urgency = 1;
    } else {
      switch (d.stage) {
        case "interest":
          headline = "Qualify the need and send across the basics.";
          urgency = 5;
          break;
        case "rfi":
          headline = "Answer their open questions and move toward an offer.";
          urgency = 4;
          break;
        case "rfp":
          headline = "Follow up on the offer you sent.";
          urgency = 3;
          break;
        case "customer_test":
          headline = "Check how the device trial is going.";
          urgency = 3;
          break;
        case "contract_negotiation":
          headline = "Push for sign-off on the terms.";
          urgency = 2;
          break;
        default:
          headline = "Keep this deal moving.";
          urgency = 6;
      }
    }
    return { dealId: d.id, headline, context: name, href: `/rep/deals/${d.id}`, urgency };
  });

  return scored
    .sort((a, b) => a.urgency - b.urgency)
    .slice(0, limit)
    .map(({ dealId, headline, context, href }) => ({ dealId, headline, context, href }));
}
