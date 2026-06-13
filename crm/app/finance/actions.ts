"use server";

// Finance Server Actions (F2 + F4). All writes go through lib/db/mutations and
// revalidate the affected pages; reads through lib/db. Never import lib/api or
// lib/mock-data.

import { revalidatePath } from "next/cache";
import * as mutations from "@/lib/db/mutations";
import { getCurrentUser, getDeal } from "@/lib/db";
import { eur } from "@/lib/format";
import type { Role } from "@/lib/types";

// --- F2: persisted confidence override + ping the rep -----------------------

export interface SaveOverrideInput {
  dealId: string;
  value: number; // 0..100
  reason: string;
}

/** Persist a Finance confidence override. The stored override is what feeds
 *  gap-to-target (computeForecastSummary reads getConfidenceOverrides). */
export async function saveOverrideAction(input: SaveOverrideInput): Promise<void> {
  const me = await getCurrentUser();
  const value = Math.max(0, Math.min(100, Math.round(input.value)));
  await mutations.saveConfidenceOverride({
    dealId: input.dealId,
    value,
    reason: input.reason.trim() || undefined,
    setBy: me?.id,
  });
  revalidatePath("/finance");
}

export interface PingRepInput {
  dealId: string;
  /** Optional note from Finance (e.g. "why only N units?"). */
  note?: string;
}

/** Notify the deal's owner that Finance is questioning the forecast on it.
 *  Deep-links the notification to the deal so the rep lands on it. */
export async function pingRepAction(input: PingRepInput): Promise<void> {
  const deal = await getDeal(input.dealId);
  if (!deal || !deal.ownerId) return;
  const me = await getCurrentUser();
  const from = me?.name ? `${me.name} (Finance)` : "Finance";
  const body =
    input.note?.trim() ||
    `${from} is reviewing your forecast on "${deal.name}". The committed number looks light versus target — can you confirm the expected device units and timing?`;
  await mutations.createNotification({
    userId: deal.ownerId,
    title: `Finance has a question on ${deal.name}`,
    body,
    entityType: "deal",
    entityId: deal.id,
  });
  revalidatePath("/finance");
}

// --- F4: approval persistence (shared by /finance and /sm) -------------------

export interface DecideOfferInput {
  offerId: string;
  /** Which gate is deciding — derived from OfferApproval's `gate` prop. */
  role: Extract<Role, "sm" | "finance">;
  decision: "approved" | "rejected";
  comment?: string;
  /** Deal owner to notify of the outcome, when known. */
  ownerId?: string;
  /** Context for the rep notification. */
  dealId?: string;
  accountName?: string;
  total?: number;
}

/** Record an approval/rejection (advances offers.status; Finance approve locks)
 *  and notify the rep of the outcome. Returns the resulting offer status. */
export async function decideOfferAction(
  input: DecideOfferInput,
): Promise<{ status: string }> {
  const me = await getCurrentUser();
  const offer = await mutations.recordApproval({
    offerId: input.offerId,
    role: input.role,
    decision: input.decision,
    comment: input.comment,
    approverId: me?.id,
  });

  if (input.ownerId) {
    const who = input.role === "sm" ? "Sales Manager" : "Finance";
    const amount = input.total != null ? ` (${eur(input.total)})` : "";
    const title =
      input.decision === "approved"
        ? `${who} approved your offer${amount}`
        : `${who} could not approve your offer${amount}`;
    const body =
      input.decision === "approved"
        ? input.role === "sm"
          ? `Approved by ${who} on ${input.accountName ?? "the account"}. It now moves to Finance for the second approval.`
          : `Approved and locked by ${who} on ${input.accountName ?? "the account"} — you're clear to send it to the customer.`
        : `${who} couldn't approve the offer on ${input.accountName ?? "the account"}.${input.comment ? ` Reason: "${input.comment}".` : ""} Please revise and resubmit.`;
    await mutations.createNotification({
      userId: input.ownerId,
      title,
      body,
      entityType: input.dealId ? "deal" : undefined,
      entityId: input.dealId,
    });
  }

  revalidatePath("/finance");
  revalidatePath("/sm");
  return { status: offer.status };
}
