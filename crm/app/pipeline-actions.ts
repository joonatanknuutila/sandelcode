"use server";

// Pipeline board Server Actions. Dragging a card restages the deal AND records a
// timeline event (brief Block 3: "the drag creates a timeline event"). The board
// updates optimistically client-side, so this runs in the background; we still
// revalidate the boards + the deal page so a reload is consistent.

import { revalidatePath } from "next/cache";
import { logActivity, updateDealStage } from "@/lib/db/mutations";
import { getDeal } from "@/lib/db";
import { Stage, STAGE_LABELS, STAGE_ORDER } from "@/lib/types";

export async function moveDealStageAction(input: {
  dealId: string;
  toStage: Stage;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    // Never trust the client: a Server Action is callable directly, so the
    // board's guards must be re-enforced here.
    if (!(STAGE_ORDER as string[]).includes(input.toStage)) {
      return { ok: false, error: "Unknown stage" };
    }
    const before = await getDeal(input.dealId);
    if (!before) return { ok: false, error: "Deal not found" };
    // Reseller deals skip contract negotiation (brief Block 3).
    if (before.channel === "reseller" && input.toStage === "contract_negotiation") {
      return { ok: false, error: "Reseller deals skip contract negotiation" };
    }
    const deal = await updateDealStage(input.dealId, input.toStage);
    await logActivity({
      accountId: deal.accountId,
      eventType: "stage_change",
      title: `Stage → ${STAGE_LABELS[input.toStage]}`,
      body: `Moved from ${STAGE_LABELS[before.stage]} to ${STAGE_LABELS[input.toStage]} on the pipeline board.`,
      entityType: "deal",
      entityId: deal.id,
    });
    revalidatePath("/rep/accounts");
    revalidatePath("/rep/pipeline");
    revalidatePath("/sm/pipeline");
    revalidatePath(`/rep/deals/${deal.id}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to move deal",
    };
  }
}
