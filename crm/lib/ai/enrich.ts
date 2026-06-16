// Account & contact enrichment — the "Smart contact view" agent.
//
// Turns a bare account (name + domain) into a briefed one, with a deliberately
// HONEST two-part output:
//   - "Found this"          — verifiable public facts, each with a source URL +
//                             confidence. Backed by live web search.
//   - "Worth checking yourself" — the gaps it could NOT ground, stated plainly
//                             rather than invented.
//
// NOTE: Live web grounding ran on the Gemini API (Google Search grounding). That
// connection was removed after the hackathon so the project no longer consumes
// Google credits. With no web-grounding provider wired up, enrichAccount now
// ALWAYS returns the honest "fetch manually" fallback (modelUsed:false) — it
// never fabricates a found fact, a person, or a number. To re-enable grounded
// enrichment later, restore a web-search-capable provider here; callers already
// handle modelUsed:false, so no UI or call-site changes are needed.
import "server-only";
import type { Industry } from "@/lib/types";

export type EnrichmentConfidence = "high" | "medium" | "low";

/** A single grounded fact the agent is confident enough to propose for save. */
export interface FoundItem {
  /** Which account field this maps to: industry | country | website | summary | news | competitor … */
  field: string;
  value: string;
  /** Public source the claim is grounded in. Empty string when ungrounded. */
  sourceUrl: string;
  confidence: EnrichmentConfidence;
}

/** A proposed decision-maker contact (professional capacity only). */
export interface ProposedContact {
  name: string;
  title: string;
  publicProfileUrl?: string;
  confidence: EnrichmentConfidence;
}

/** An honest gap — something to verify by hand, never fabricated to fill. */
export interface GapItem {
  topic: string;
  why: string;
}

export interface EnrichmentResult {
  summary: string;
  found: FoundItem[];
  contacts: ProposedContact[];
  checkYourself: GapItem[];
  /** True only when the live web-grounded model produced this. */
  modelUsed: boolean;
}

export interface EnrichmentInput {
  accountName: string;
  domain?: string;
  country?: string;
  /** Names already on the account — so we don't re-propose existing contacts. */
  knownContacts?: string[];
}

/** Defense / government customers are sensitive by default (brief: EU residency,
 *  defense sector). Enrichment is OFF by default for these — the rep must opt in.
 *  Derived from industry so no schema change is needed; a dedicated `sensitive`
 *  flag on accounts can replace this later without touching call sites. */
export function isSensitiveIndustry(industry: Industry): boolean {
  return industry === "Defense" || industry === "Government";
}

// The fields we want grounded, straight from the brief + rep journey.
const ENRICHMENT_TARGETS = [
  "decision-makers / key contacts (professional capacity only)",
  "security / IT strategy & posture",
  "competitor or incumbent relationships (e.g. is an existing vendor already in?)",
  "sector & company size",
  "country / region",
  "recent relevant news",
  "upcoming relevant events",
];

/** The honest no-fabrication fallback used whenever the model is unavailable. */
function honestFallback(input: EnrichmentInput, reason: string): EnrichmentResult {
  return {
    summary:
      `Enrichment unavailable — ${reason}. Nothing was invented. ` +
      `Research ${input.accountName}${input.domain ? ` (${input.domain})` : ""} manually using the checklist.`,
    found: [],
    contacts: [],
    checkYourself: ENRICHMENT_TARGETS.map((t) => ({
      topic: t,
      why: "Not fetched — web grounding is offline; verify from a public source.",
    })),
    modelUsed: false,
  };
}

/**
 * Enrich an account from public web sources. Returns a PROPOSAL only — this
 * function never writes. Callers gate on explicit human approval before saving.
 *
 * Web grounding was removed (see file header), so this always returns the honest
 * fallback rather than a fabricated brief.
 */
export async function enrichAccount(
  input: EnrichmentInput,
): Promise<EnrichmentResult> {
  return honestFallback(input, "web grounding has been disabled");
}
