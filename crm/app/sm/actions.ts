"use server";

// Sales Manager Server Actions (SM M3). All writes go through lib/db/mutations
// and revalidate the affected pages; reads through lib/db. Never import lib/api
// or lib/mock-data.

import { revalidatePath } from "next/cache";
import * as mutations from "@/lib/db/mutations";
import { getCurrentUser, getDeal, getUser } from "@/lib/db";

// --- M3: reassign a deal between reps, inline --------------------------------

/** Reassign a deal to a new owner and notify BOTH the old and the new owner.
 *  The board owner initials update after the /sm revalidate; the rep view
 *  (/rep) is revalidated too so both reps see the change. */
export async function reassignDealAction(
  dealId: string,
  newOwnerId: string,
): Promise<void> {
  // Capture the previous owner before the write so we can notify them too.
  const before = await getDeal(dealId);
  const oldOwnerId = before?.ownerId;
  if (oldOwnerId === newOwnerId) return;

  // The write and the lookups it doesn't depend on run together.
  const [deal, me, newOwner, oldOwner] = await Promise.all([
    mutations.reassignDeal(dealId, newOwnerId),
    getCurrentUser(),
    getUser(newOwnerId),
    oldOwnerId ? getUser(oldOwnerId) : Promise.resolve(null),
  ]);
  const from = me?.name ? `${me.name} (Sales Manager)` : "Sales Manager";

  // Notify both reps in parallel.
  await Promise.all([
    mutations.createNotification({
      userId: newOwnerId,
      title: `You've been assigned "${deal.name}"`,
      body: `${from} reassigned this deal to you${oldOwner ? ` from ${oldOwner.name}` : ""}. Pick it up and move it forward.`,
      entityType: "deal",
      entityId: deal.id,
    }),
    oldOwnerId && oldOwnerId !== newOwnerId
      ? mutations.createNotification({
          userId: oldOwnerId,
          title: `"${deal.name}" was reassigned`,
          body: `${from} moved this deal${newOwner ? ` to ${newOwner.name}` : " to another rep"}.`,
          entityType: "deal",
          entityId: deal.id,
        })
      : Promise.resolve(),
  ]);

  revalidatePath("/sm");
  revalidatePath("/sm/pipeline");
  revalidatePath("/rep");
  revalidatePath("/rep/pipeline");
}
