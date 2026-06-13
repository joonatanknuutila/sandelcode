"use server";

// Inbox Server Actions. Posting a reply persists a `notes` row to the chosen
// context (postInboxMessage); deciding an approval runs the same gate logic the
// /sm and /finance approval cards use (recordApproval) so the Inbox and those
// screens stay in agreement. Reads go through lib/db; writes through mutations.

import { revalidatePath } from "next/cache";
import * as mutations from "@/lib/db/mutations";
import { getCurrentUser, getDeal } from "@/lib/db";
import { ContextType } from "@/lib/types";

const INBOX_PATHS = ["/rep/inbox", "/sm/inbox", "/tam/inbox", "/finance/inbox"];

function revalidateInbox(): void {
  for (const p of INBOX_PATHS) revalidatePath(p);
}

export async function postMessageAction(input: {
  contextType: ContextType;
  contextId: string;
  body: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!input.body.trim()) return { ok: false, error: "Message is empty" };
    await mutations.postInboxMessage({
      contextType: input.contextType,
      contextId: input.contextId,
      body: input.body.trim(),
    });
    revalidateInbox();
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to send message",
    };
  }
}

export async function decideApprovalAction(input: {
  offerId: string;
  gate: "sm" | "finance";
  decision: "approved" | "rejected";
  dealId: string;
  comment?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await mutations.recordApproval({
      offerId: input.offerId,
      role: input.gate,
      decision: input.decision,
      comment: input.comment,
    });

    // Tell the deal owner what happened to their request.
    const [deal, me] = await Promise.all([getDeal(input.dealId), getCurrentUser()]);
    if (deal?.ownerId) {
      const who = input.gate === "sm" ? "Sales Manager" : "Finance";
      const verdict = input.decision === "approved" ? "approved" : "rejected";
      const tail =
        input.decision === "approved" && input.gate === "sm"
          ? " — it may now move to Finance."
          : ".";
      await mutations.createNotification({
        userId: deal.ownerId,
        title: `Discount ${verdict} on "${deal.name}"`,
        body: `${me?.name ?? who} ${verdict} the discount request${tail}`,
        entityType: "deal",
        entityId: deal.id,
      });
    }

    revalidateInbox();
    revalidatePath("/sm");
    revalidatePath("/finance");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to record decision",
    };
  }
}
