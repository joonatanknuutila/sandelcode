"use server";

import { revalidatePath } from "next/cache";
import { logActivity, updateDealStage } from "@/lib/db/mutations";
import { getDeal } from "@/lib/db";
import { ActivityType, Stage, STAGE_ORDER } from "@/lib/types";

// ---------------------------------------------------------------------------
// Log an activity (call/email/note/meeting) attached to a deal
// ---------------------------------------------------------------------------
export async function logActivityAction(input: {
  dealId: string;
  accountId: string;
  type: ActivityType;
  title: string;
  body?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await logActivity({
      accountId: input.accountId,
      eventType: input.type,
      title: input.title,
      body: input.body,
      entityType: "deal",
      entityId: input.dealId,
    });
    revalidatePath(`/rep/deals/${input.dealId}`);
    revalidatePath(`/rep/accounts`);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to log activity";
    return { ok: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Advance a deal to a new stage
// ---------------------------------------------------------------------------
export async function moveStageAction(
  dealId: string,
  accountId: string,
  stage: Stage,
): Promise<{ ok: boolean; error?: string }> {
  try {
    // Never trust the client: validate the target and re-enforce the channel
    // rule (the move modal hides it, but the action is callable directly).
    if (!(STAGE_ORDER as string[]).includes(stage)) {
      return { ok: false, error: "Unknown stage" };
    }
    const deal = await getDeal(dealId);
    if (!deal) return { ok: false, error: "Deal not found" };
    if (deal.channel === "reseller" && stage === "contract_negotiation") {
      return { ok: false, error: "Reseller deals skip contract negotiation" };
    }
    await updateDealStage(dealId, stage);
    revalidatePath(`/rep/deals/${dealId}`);
    revalidatePath(`/rep/accounts`);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update stage";
    return { ok: false, error: message };
  }
}

// ---------------------------------------------------------------------------
// Draft an email body via Azure OpenAI (AI drafts, human sends)
// Called from client via server action to keep API keys server-side.
// ---------------------------------------------------------------------------
export async function draftEmailAction(input: {
  dealName: string;
  accountName: string;
  rationale: string;
}): Promise<{ draft: string; modelUsed: boolean }> {
  const { complete } = await import("@/lib/ai/provider");

  const raw = await complete(
    [
      {
        role: "system",
        content:
          `You are a concise B2B sales assistant. Draft a short, professional check-in email ` +
          `(3-4 sentences) that the rep can review and send. Use a friendly but business tone. ` +
          `Return ONLY the email body — no subject line, no greeting header, no sign-off placeholder.`,
      },
      {
        role: "user",
        content:
          `Deal: ${input.dealName} | Account: ${input.accountName}\n` +
          `Context: ${input.rationale}`,
      },
    ],
    { temperature: 0.4, maxTokens: 200 },
  );

  if (raw) {
    return { draft: raw.trim(), modelUsed: true };
  }

  // Deterministic fallback — honest label
  return {
    draft:
      `Hi,\n\nI wanted to follow up on ${input.dealName} and check if you have any questions ` +
      `or need any additional information from us.\n\n` +
      `Please let me know if now is a good time to connect this week.\n\n` +
      `[model offline — edit before sending]`,
    modelUsed: false,
  };
}
