"use server";

import { revalidatePath } from "next/cache";
import { getAccount, getContactsForAccount } from "@/lib/db";
import {
  createContact,
  logActivity,
  updateAccount,
  type UpdateAccountInput,
} from "@/lib/db/mutations";
import { enrichAccount, type EnrichmentResult, type FoundItem, type ProposedContact } from "@/lib/ai/enrich";

// ---------------------------------------------------------------------------
// Propose — runs the agent, WRITES NOTHING. Only the public name/domain ever
// leaves the app (privacy: no CRM/customer-private data is sent to the web).
// ---------------------------------------------------------------------------

export async function enrichAccountAction(
  accountId: string,
): Promise<EnrichmentResult> {
  const account = await getAccount(accountId);
  if (!account) {
    return {
      summary: "Account not found.",
      found: [],
      contacts: [],
      checkYourself: [],
      modelUsed: false,
    };
  }
  const known = (await getContactsForAccount(accountId)).map((c) => c.name);
  return enrichAccount({
    accountName: account.name,
    domain: account.website,
    country: account.region,
    knownContacts: known,
  });
}

// ---------------------------------------------------------------------------
// Commit — the single write path. Applies ONLY the items the rep selected, and
// records the brief + every source URL on the account timeline (auditable).
// ---------------------------------------------------------------------------

// Account fields the enrichment can patch directly. Everything else (news,
// competitor, posture …) is informational and recorded on the timeline only.
const PATCHABLE_FIELDS: Record<string, keyof UpdateAccountInput> = {
  industry: "industry",
  country: "country",
  website: "website",
};

export interface CommitEnrichmentInput {
  accountId: string;
  summary: string;
  /** The found items the rep kept after review. */
  found: FoundItem[];
  /** The proposed contacts the rep kept after review. */
  contacts: ProposedContact[];
}

export interface CommitEnrichmentResult {
  ok: boolean;
  savedFields: string[];
  savedContacts: string[];
  error?: string;
}

export async function commitEnrichmentAction(
  input: CommitEnrichmentInput,
): Promise<CommitEnrichmentResult> {
  if (!(await getAccount(input.accountId))) {
    return { ok: false, savedFields: [], savedContacts: [], error: "Unknown account." };
  }
  if (input.found.length === 0 && input.contacts.length === 0) {
    return { ok: false, savedFields: [], savedContacts: [], error: "Nothing selected." };
  }

  // 1) Patch account header fields from the selected, mappable found items.
  const patch: UpdateAccountInput = {};
  for (const f of input.found) {
    const key = PATCHABLE_FIELDS[f.field];
    if (key && f.value) patch[key] = f.value;
  }
  if (Object.keys(patch).length > 0) await updateAccount(input.accountId, patch);

  // 2) Create the selected decision-maker contacts.
  const savedContacts: string[] = [];
  for (const c of input.contacts) {
    await createContact({
      accountId: input.accountId,
      name: c.name,
      jobTitle: c.title || undefined,
    });
    savedContacts.push(c.name);
  }

  // 3) Record the brief + sources on the timeline — institutional memory, and
  //    every stored claim stays auditable to its public source.
  const savedFields = input.found.map((f) => f.field);
  const sources = input.found.map((f) => f.sourceUrl).filter(Boolean);
  const factLines = input.found.map((f) => `• ${f.field}: ${f.value} (${f.confidence})`);
  const contactLines = input.contacts.map((c) => `• ${c.name} — ${c.title} (${c.confidence})`);
  await logActivity({
    accountId: input.accountId,
    eventType: "account_enriched",
    title: "Account enriched from public sources",
    body: [
      input.summary,
      factLines.length ? "\nSaved facts:\n" + factLines.join("\n") : "",
      contactLines.length ? "\nContacts added:\n" + contactLines.join("\n") : "",
      sources.length ? "\nSources:\n" + sources.join("\n") : "",
    ]
      .filter(Boolean)
      .join("\n"),
    entityType: "account",
    entityId: input.accountId,
    metadata: { sources, savedFields, savedContacts },
  });

  revalidatePath(`/rep/accounts/${input.accountId}`);
  return { ok: true, savedFields, savedContacts };
}
