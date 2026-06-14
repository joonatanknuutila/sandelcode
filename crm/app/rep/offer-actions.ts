"use server";

import { revalidatePath } from "next/cache";
import {
  createOffer,
  setOfferLines,
  submitOffer,
  createNotification,
} from "@/lib/db/mutations";
import type { OfferLineInput } from "@/lib/db/mutations";
import { getUsers } from "@/lib/db";
import { requiresFinanceApproval } from "@/lib/scoring";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OfferLineActionInput {
  /** Either productId or serviceId must be set. */
  productId?: string;
  serviceId?: string;
  /** Human-readable description for the line item. */
  description: string;
  quantity: number;
  unitPrice: number;
  invoicingModel?: OfferLineInput["invoicingModel"];
  termYears?: number;
}

export interface CreateOfferActionInput {
  dealId: string;
  accountId: string;
  title: string;
  discountPct: number;
  discountJustification?: string;
  lines: OfferLineActionInput[];
}

export interface CreateOfferActionResult {
  success: boolean;
  offerId?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Product assumption note (surfaced in the UI)
// ---------------------------------------------------------------------------
// APPROVAL ROUTING ASSUMPTION: Every submitted offer always goes to SM first
// (pending_sm). The mutations.recordApproval function auto-advances discounts
// above the Finance threshold (lib/scoring) to Finance after the SM approves —
// this action never sets "pending_finance" directly.

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

export async function createOfferAction(
  input: CreateOfferActionInput,
): Promise<CreateOfferActionResult> {
  try {
    // 1. Create the offer header.
    const offer = await createOffer({
      accountId: input.accountId,
      dealId: input.dealId,
      title: input.title,
      discountPct: input.discountPct,
      discountJustification: input.discountJustification,
      version: 1,
    });

    // 2. Set line items (recomputes totals on the server).
    const lines: OfferLineInput[] = input.lines.map((l) => ({
      itemType: l.productId ? "product" : "service",
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      discountPct: input.discountPct,
      productId: l.productId,
      serviceId: l.serviceId,
      invoicingModel: l.invoicingModel,
      termYears: l.termYears,
    }));
    await setOfferLines(offer.id, lines);

    // 3. Submit: always goes to SM first.
    await submitOffer(offer.id, "pending_sm");

    // 4. Notify relevant users.
    const users = await getUsers();
    const salesManagers = users.filter((u) => u.role === "sm");
    const financeUsers = users.filter((u) => u.role === "finance");

    const offerHref = `/rep/deals/${input.dealId}`;

    // Notify all SMs.
    await Promise.all(
      salesManagers.map((sm) =>
        createNotification({
          userId: sm.id,
          title: "Offer pending your approval",
          body: `"${input.title}" requires SM approval${input.discountPct > 0 ? ` (${input.discountPct}% discount)` : ""}.`,
          entityType: "deal",
          entityId: input.dealId,
        }),
      ),
    );

    // If the discount needs Finance, also notify them an escalation is incoming
    // (they'll receive a formal approval request after SM approves).
    if (requiresFinanceApproval(input.discountPct)) {
      await Promise.all(
        financeUsers.map((f) =>
          createNotification({
            userId: f.id,
            title: "Offer escalation incoming",
            body: `"${input.title}" has a ${input.discountPct}% discount — expect a Finance approval request once SM approves.`,
            entityType: "offer",
            entityId: offer.id,
          }),
        ),
      );
    }

    // 5. Revalidate the deal cockpit so it reflects the new offer.
    revalidatePath(offerHref);

    return { success: true, offerId: offer.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}
