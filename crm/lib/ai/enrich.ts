// Account & contact enrichment — the "Smart contact view" agent.
//
// Turns a bare account (name + domain) into a briefed one, with a deliberately
// HONEST two-part output:
//   - "Found this"          — verifiable public facts, each with a source URL +
//                             confidence. Backed by live web search.
//   - "Worth checking yourself" — the gaps it could NOT ground, stated plainly
//                             rather than invented.
//
// Provider: this is the ONE place that needs LIVE WEB ACCESS, so it does NOT go
// through lib/ai/provider.ts (Azure OpenAI, no web). It calls the Gemini API
// with Google Search grounding — chosen because grounding returns source URLs,
// which feed the sourceUrl/confidence fields and the honesty split.
//
// Degradation contract (project-wide): no GEMINI_API_KEY or any error ->
// returns { modelUsed:false } with an honest "fetch manually" brief. It NEVER
// fabricates a found fact, a person, or a number.
//
// Env (.env.local, server-only, never hardcoded):
//   GEMINI_API_KEY    — server-only key. Absent => honest degradation.
//   GEMINI_MODEL      — optional, default "gemini-2.5-flash".
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

const SYSTEM_PROMPT =
  `You are a B2B account-research analyst for HMD Secure, which sells secure ` +
  `smartphones and device services to government, defense and enterprise ` +
  `customers in the EU. Given ONLY a public company name and domain, research ` +
  `the company using web search and return a briefing.\n\n` +
  `HARD RULES:\n` +
  `- Ground EVERY claim in "found" with a real public source URL. If you cannot ` +
  `find a source, DO NOT put it in "found" — move the topic to "checkYourself".\n` +
  `- NEVER invent a person, a number, a contact, or a fact. Honesty over completeness.\n` +
  `- Only business decision-makers in their PROFESSIONAL capacity. No private/personal data.\n` +
  `- Prefer these topics: ${ENRICHMENT_TARGETS.join("; ")}.\n` +
  `- "field" must be one of: industry, country, website, summary, security_posture, ` +
  `competitor, size, news, event. Use industry/country/website only when the value ` +
  `maps cleanly to that account field.\n\n` +
  `Return STRICT JSON only (no prose, no code fence) with this exact shape:\n` +
  `{"summary": string, "found": [{"field": string, "value": string, "sourceUrl": string, ` +
  `"confidence": "high"|"medium"|"low"}], "contacts": [{"name": string, "title": string, ` +
  `"publicProfileUrl": string, "confidence": "high"|"medium"|"low"}], ` +
  `"checkYourself": [{"topic": string, "why": string}]}`;

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

function isConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

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

/** Strip a ```json fence / surrounding prose and parse the first JSON object. */
function parseModelJson(text: string): unknown {
  const fenced = text.replace(/```(?:json)?/gi, "").trim();
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) throw new Error("no json object");
  return JSON.parse(fenced.slice(start, end + 1));
}

function asConfidence(v: unknown): EnrichmentConfidence {
  return v === "high" || v === "low" ? v : "medium";
}

/**
 * Enrich an account from public web sources. Returns a PROPOSAL only — this
 * function never writes. Callers gate on explicit human approval before saving.
 */
export async function enrichAccount(
  input: EnrichmentInput,
): Promise<EnrichmentResult> {
  if (!isConfigured()) {
    return honestFallback(input, "no web-grounding key configured");
  }

  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const url = `${GEMINI_BASE}/${model}:generateContent`;
  const userPrompt =
    `Company: ${input.accountName}\n` +
    `Domain: ${input.domain ?? "unknown"}\n` +
    `Country (claimed): ${input.country ?? "unknown"}\n` +
    `Already-known contacts (do not re-propose): ${input.knownContacts?.join(", ") || "none"}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY!,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        // Live Google Search grounding — the reason we use Gemini here.
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.2 },
      }),
      signal: AbortSignal.timeout(25_000),
    });

    if (!res.ok) {
      console.error("Gemini enrich error", res.status, await res.text());
      return honestFallback(input, `web search failed (${res.status})`);
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    const text: string = (candidate?.content?.parts ?? [])
      .map((p: { text?: string }) => p.text ?? "")
      .join("");
    if (!text.trim()) return honestFallback(input, "empty model response");

    const parsed = parseModelJson(text) as Partial<EnrichmentResult>;

    // Collect the grounded source URLs the model actually used, so we can
    // backfill any found item the model left without a sourceUrl.
    const groundingUrls: string[] = (
      candidate?.groundingMetadata?.groundingChunks ?? []
    )
      .map((c: { web?: { uri?: string } }) => c.web?.uri)
      .filter((u: string | undefined): u is string => Boolean(u));

    const found: FoundItem[] = Array.isArray(parsed.found)
      ? parsed.found
          .map((f) => ({
            field: String(f.field ?? "summary"),
            value: String(f.value ?? "").trim(),
            sourceUrl: String(f.sourceUrl ?? "").trim() || groundingUrls[0] || "",
            confidence: asConfidence(f.confidence),
          }))
          // Honesty gate: a "found" item with no source is not grounded — drop it.
          .filter((f) => f.value && f.sourceUrl)
      : [];

    const contacts: ProposedContact[] = Array.isArray(parsed.contacts)
      ? parsed.contacts
          .map((c) => ({
            name: String(c.name ?? "").trim(),
            title: String(c.title ?? "").trim(),
            publicProfileUrl: c.publicProfileUrl
              ? String(c.publicProfileUrl)
              : undefined,
            confidence: asConfidence(c.confidence),
          }))
          .filter((c) => c.name)
      : [];

    const checkYourself: GapItem[] = Array.isArray(parsed.checkYourself)
      ? parsed.checkYourself.map((g) => ({
          topic: String(g.topic ?? "").trim(),
          why: String(g.why ?? "").trim(),
        }))
      : [];

    return {
      summary: String(parsed.summary ?? "").trim(),
      found,
      contacts,
      checkYourself,
      modelUsed: true,
    };
  } catch (err) {
    console.error("Gemini enrich call failed", err);
    return honestFallback(input, "web search errored");
  }
}
