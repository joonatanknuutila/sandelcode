"use server";

import { revalidatePath } from "next/cache";
import {
  setForecastPhases,
  createDeal,
  createCase,
  createContact,
  logActivity,
} from "@/lib/db/mutations";
import type {
  ForecastPhaseInput,
  CreateDealInput,
  CreateCaseInput,
  CreateContactInput,
} from "@/lib/db/mutations";

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
