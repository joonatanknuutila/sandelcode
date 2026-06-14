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
// Add note — the zero-friction "Save" path behind the capture surface (§6).
// Writes one timeline event to the account (and a deal, when given). The richer
// "Spar & structure" path goes through /api/meeting/draft + /api/meeting/commit.
// ---------------------------------------------------------------------------

export async function addNoteAction(input: {
  accountId: string;
  dealId?: string;
  body: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const body = input.body.trim();
    if (!input.accountId) return { ok: false, error: "Pick an account first" };
    if (!body) return { ok: false, error: "Write something to save" };
    await logActivity({
      accountId: input.accountId,
      eventType: "note",
      title: "Note",
      body,
      entityType: input.dealId ? "deal" : "account",
      entityId: input.dealId ?? input.accountId,
    });
    revalidatePath("/rep");
    revalidatePath("/rep/accounts");
    revalidatePath(`/rep/accounts/${input.accountId}`);
    if (input.dealId) revalidatePath(`/rep/deals/${input.dealId}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to save note",
    };
  }
}

// ---------------------------------------------------------------------------
// Create deal — optionally seeding a 12-month forecast at creation so the rep
// can rough out year-one volumes without first opening the deal. The full
// 3-year grid is still editable on the deal page afterwards.
// ---------------------------------------------------------------------------

export interface Forecast12moInput {
  /** Total phones expected over the next 12 months (spread across 4 quarters). */
  totalPhones: number;
  /** Price per phone (€). */
  unitPrice: number;
  /** Optional service revenue per phone, per quarter (€). */
  serviceQuarterly?: number;
}

/** Spread a 12-month total across this calendar year's four quarters. */
function build12moPhases(f: Forecast12moInput): ForecastPhaseInput[] {
  const baseYear = new Date().getFullYear();
  const per = Math.floor(f.totalPhones / 4);
  const remainder = f.totalPhones - per * 4;
  const svc = f.serviceQuarterly ?? 0;
  return [1, 2, 3, 4].map((q, i) => {
    const units = per + (i < remainder ? 1 : 0); // front-load any remainder
    const month = String((q - 1) * 3 + 1).padStart(2, "0");
    return {
      periodStart: `${baseYear}-${month}-01`,
      periodLabel: `${baseYear}-Q${q}`,
      deviceUnits: units,
      deviceUnitPrice: f.unitPrice,
      serviceRevenue: units * svc,
    };
  });
}

export async function createDealAction(
  input: CreateDealInput & { forecast12mo?: Forecast12moInput },
): Promise<{ id: string }> {
  const { forecast12mo, ...dealInput } = input;
  const deal = await createDeal(dealInput);
  if (forecast12mo && forecast12mo.totalPhones > 0 && forecast12mo.unitPrice > 0) {
    await setForecastPhases(deal.id, build12moPhases(forecast12mo));
  }
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
