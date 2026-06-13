# MASTER BUILD PROMPT — Account & Contact Enrichment Agent ("Smart Contact View")
**Product:** HMD Secure AI-native CRM · **Agent scope:** account/contact web-enrichment only
**Audience:** AI coding agent(s) building on the existing repo · **Use:** paste as the spec

## 0. How to use this prompt
You are adding **one agent** to a multi-persona CRM that already exists. The DB, auth, data layer, AI provider scaffolding, and design system are **shared — do not rebuild them.** Your job: the enrichment agent that turns a bare account (name + domain) into a briefed one, and honestly flags what it could not verify.

**Stack discipline (non-negotiable):** Next.js **16** — read `crm/AGENTS.md` and `node_modules/next/dist/docs/` before writing. `params` is a `Promise`; pages are async Server Components; middleware is `proxy.ts`. Writes go through the **mutation layer** (`crm/lib/db/mutations.ts`) via **Server Actions** (`"use server"`) then `revalidatePath()`. Never import `@/lib/api` or `@/lib/mock-data` in shipped paths.

## 1. Shared foundation (context, reuse — don't rebuild)
- Single Supabase Postgres (eu-north-1), RLS on. Accounts are the spine; `contacts`, `deals`, `cases`, `activity_timeline` hang off them.
- Typed data layer in `crm/lib/db` (async, returns UI types from `lib/types.ts`; DB↔UI in `mappers.ts`).
- AI provider in `crm/lib/ai/provider.ts`: `complete()`, Azure OpenAI by default, **returns `null` on no-key/error so every caller falls back to deterministic logic**; `modelUsed: false` marks a fallback answer. Honor this pattern.
- **Mandatory AI safety pattern (project-wide):** grounded, no silent writes. Flow is *propose → 3–5 clarifying Qs / verify → human approves → write*. Hallucination minimisation is the #1 stated AI constraint.
- Brand: HMD Secure — anthracite chrome, Inter, lime `#e4ff00` **only as fill/accent with black text**.

## 2. What this agent is (the job-to-be-done)
A rep creates an account with the only two facts they reliably have — **name + domain** (today that's all the Excel holds). One action turns it into a briefed account in under a minute. The agent's output is deliberately **two-part and honest**:
- **"Found this"** — verifiable public business intelligence, each item with a **source URL + confidence**.
- **"Worth checking yourself"** — the gaps: what it could not verify or fetch efficiently, stated plainly rather than invented.

This directly serves the brief's *Smart contact view → auto-enrich from name/domain, surface what matters first* and the rep journey's *Fetch background → "Found this" / "Worth checking yourself"* moment.

## 3. Triggers (when it runs)
1. **Rep-initiated (primary):** a "Fetch background" button on the account 360 (`app/rep/accounts/[id]`) and on the new-account flow.
2. **Auto-detect on insert:** when an **account** or a **decision-maker contact** is created and key fields are missing (e.g. no `industry`, no primary contact, no decision-makers), the agent offers to enrich — it **proposes**, it does not silently write.
Auto-trigger surfaces a dismissible prompt ("This account is bare — fetch background?"), never an automatic save.

## 4. Inputs / outputs
**Input:** `{ accountName, domain, country?, knownContacts? }`. For a contact target: `{ name, title?, accountDomain }`.
**Output (structured JSON the model must return; parse + map to UI):**
```
{
  summary: string,                       // 1-paragraph plain-language brief
  found: [{ field, value, sourceUrl, confidence }],   // confidence: high|medium|low
  contacts: [{ name, title, publicProfileUrl?, confidence }],  // proposed decision-makers
  checkYourself: [{ topic, why }],       // honest gaps — never fabricate to fill these
  modelUsed: boolean
}
```
**Enrichment targets** (from brief + meeting notes + rep journey): decision-makers / key contacts; the customer's **security/IT strategy & posture**; **competitor relationships** (e.g. is Samsung/incumbent already in?); **sector & size**; **country / region**; recent **relevant news**; upcoming **events**. Prompt the model to output *only fields it can ground in a source*; everything else goes to `checkYourself`.

## 5. Data it reads / writes
- **Reads:** `getAccount`, `getContactsForAccount` (existing) to know what's already filled and avoid re-proposing.
- **Writes (only after approval, via mutation layer):** `updateAccount` (industry/country/website/notes), `createContact` (proposed decision-makers, `is_primary` left to rep), `logActivity` (→ `activity_timeline`, `event_type='account_enriched'`, sources in `metadata` jsonb). A `note` (`entity_type='account'`) can store the full brief + source list for institutional memory.
- Add functions to `crm/lib/db/mutations.ts` if missing: reuse `updateAccount`/`createContact`/`logActivity` from the planned S1 layer; do **not** invent a parallel write path.

## 6. Provider & web grounding (the change we flagged)
The existing `provider.ts` is **Azure OpenAI and has no live web access** — it cannot enrich. Add a **separate, web-grounded enrichment path**:
- New module `crm/lib/ai/enrich.ts` calling the **Gemini API with Google Search grounding** (the `google_search` grounding tool), chosen specifically because it returns live web results **with source URLs** — which feed the `sourceUrl`/`confidence` fields and the honesty split. Env: `GEMINI_API_KEY` (server-only).
- Keep the project's degradation contract: **no key or error → return `{ modelUsed:false, ... }` with an honest "enrichment unavailable / fetch manually" message**, never a fabricated brief.
- A tight **system prompt** encodes: which fields are worth storing (§4 targets), "ground every claim in a source URL or move it to checkYourself", "never invent a person or a number", and the strict JSON output shape.
- ⚠️ This introduces a **second AI provider** (Gemini) alongside Azure OpenAI — confirm that's acceptable, and confirm the exact current Gemini model + grounding tool name before wiring.

## 7. The human-approval gate (do not weaken)
The agent **never writes silently.** UI flow: Fetch → show "Found this" / "Worth checking yourself" → rep edits/deselects items → **rep approves** → Server Action writes the selected items + logs sources to the timeline. Declining writes nothing. This mirrors the meeting→CRM gate already in the repo.

## 8. UI surface
- Account 360 (`app/rep/accounts/[id]/page.tsx`): a "Fetch background" button; results render in a two-column card ("Found this" left, "Worth checking yourself" right), each found item a checkbox row with its source link + confidence chip. Approve = write selected.
- Brand: confidence chips and the active "Approve" CTA use the brand tokens (black-on-lime accent only); honest-gap column stays muted/secondary.

## 9. Privacy & compliance (load-bearing here)
Customers are **government/defense + EU residency**. Enrichment must: send only the **public company name/domain** to Google (never CRM/customer-private data); enrich **business decision-makers in their professional capacity only** — no private/sensitive personal data; let the rep **discard** any item before save; store **source URLs** so every stored claim is auditable. Flag this in-UI ("public sources only").

## 10. Out of scope
Auto-creating accounts (rep decides when a lead is worth entering); writing without approval; enriching anything beyond the account/its decision-makers; scraping gated/paywalled or non-public sources.

## 11. Acceptance criteria
A rep with no training can: create an account with name+domain → click Fetch background → in <1 min see a sourced "Found this" + honest "Worth checking yourself" → select items → approve → the chosen fields/contacts persist, the brief + sources land on the account timeline, and nothing was written before approval. With no `GEMINI_API_KEY`, the feature degrades honestly (labelled, no fabrication).

## 12. Open questions (flag, don't guess)
- Confirm **Gemini as a second provider** + exact model/grounding-tool name.
- Which enrichment fields are **must-store** vs nice-to-have for HMD?
- Any **defense accounts** where external enrichment must be **off by default** (mirrors the TAM transcription opt-out)?
- Should contact-level enrichment auto-run, or rep-initiated only?
