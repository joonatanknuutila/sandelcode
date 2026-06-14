"use server";

import { revalidatePath } from "next/cache";
import {
  setForecastPhases,
  createAccount,
  createDeal,
  createCase,
  createContact,
  logActivity,
  updateDeal,
} from "@/lib/db/mutations";
import { parseLead } from "@/lib/ai/lead";
import type {
  ForecastPhaseInput,
  CreateAccountInput,
  CreateDealInput,
  CreateCaseInput,
  CreateContactInput,
} from "@/lib/db/mutations";
import type { ParsedLead } from "@/lib/ai/lead";

// ---------------------------------------------------------------------------
// Forecast phases
// ---------------------------------------------------------------------------

export async function setForecastPhasesAction(
  dealId: string,
  accountId: string,
  phases: ForecastPhaseInput[],
): Promise<void> {
  await setForecastPhases(dealId, phases);
  revalidatePath(`/rep/deals/${dealId}`);
  revalidatePath(`/rep/accounts/${accountId}`);
}

// ---------------------------------------------------------------------------
// Create account
// ---------------------------------------------------------------------------

export interface CreateAccountActionInput extends CreateAccountInput {
  primaryContact?: Omit<CreateContactInput, "accountId">;
}

export async function createAccountAction(
  input: CreateAccountActionInput,
): Promise<{ id: string }> {
  const account = await createAccount(input);
  if (input.primaryContact?.name?.trim()) {
    await createContact({
      ...input.primaryContact,
      accountId: account.id,
      isPrimary: input.primaryContact.isPrimary ?? true,
    });
  }
  await logActivity({
    accountId: account.id,
    eventType: "note",
    title: "Account created",
    body: input.summary,
    entityType: "account",
    entityId: account.id,
  });
  revalidatePath("/rep");
  revalidatePath("/rep/accounts");
  return { id: account.id };
}

// ---------------------------------------------------------------------------
// Create deal
// ---------------------------------------------------------------------------

export async function createDealAction(
  input: CreateDealInput,
): Promise<{ id: string }> {
  const deal = await createDeal(input);
  await logActivity({
    accountId: input.accountId,
    eventType: "deal_created",
    title: `Deal created: ${deal.name}`,
    entityType: "deal",
    entityId: deal.id,
  });
  revalidatePath(`/rep/accounts/${input.accountId}`);
  revalidatePath("/rep");
  return { id: deal.id };
}

// ---------------------------------------------------------------------------
// Rename deal
// ---------------------------------------------------------------------------

export async function renameDealAction(input: {
  dealId: string;
  accountId: string;
  title: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const title = input.title.trim();
    if (!title) return { ok: false, error: "Deal title is required" };
    const deal = await updateDeal(input.dealId, { title });
    await logActivity({
      accountId: input.accountId,
      eventType: "note",
      title: `Deal renamed: ${deal.name}`,
      entityType: "deal",
      entityId: deal.id,
    });
    revalidatePath(`/rep/accounts/${input.accountId}`);
    revalidatePath(`/rep/deals/${input.dealId}`);
    revalidatePath("/rep/accounts");
    revalidatePath("/rep");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to rename deal",
    };
  }
}

// ---------------------------------------------------------------------------
// Parse inbound lead text
// ---------------------------------------------------------------------------

export async function parseLeadAction(text: string): Promise<ParsedLead> {
  return parseLead(text);
}

// ---------------------------------------------------------------------------
// Create service case
// ---------------------------------------------------------------------------

export async function createCaseAction(
  input: CreateCaseInput,
): Promise<{ id: string }> {
  const c = await createCase(input);
  await logActivity({
    accountId: input.accountId,
    eventType: "case_opened",
    title: `Case opened: ${c.title}`,
    entityType: "case",
    entityId: c.id,
  });
  revalidatePath(`/rep/accounts/${input.accountId}`);
  revalidatePath("/tam");
  return { id: c.id };
}

// ---------------------------------------------------------------------------
// Create contact
// ---------------------------------------------------------------------------

export async function createContactAction(
  input: CreateContactInput,
): Promise<{ id: string }> {
  const contact = await createContact(input);
  await logActivity({
    accountId: input.accountId,
    eventType: "note",
    title: `Contact added: ${contact.name}`,
    entityType: "account",
    entityId: input.accountId,
  });
  revalidatePath(`/rep/accounts/${input.accountId}`);
  return { id: contact.id };
}
