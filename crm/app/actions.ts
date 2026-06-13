"use server";

import { revalidatePath } from "next/cache";
import { markNotificationRead } from "@/lib/db/mutations";

/**
 * Mark a single notification as read and revalidate the entire layout so
 * the bell badge reflects the new state on the next render.
 */
export async function markReadAction(id: string): Promise<void> {
  await markNotificationRead(id);
  revalidatePath("/", "layout");
}
