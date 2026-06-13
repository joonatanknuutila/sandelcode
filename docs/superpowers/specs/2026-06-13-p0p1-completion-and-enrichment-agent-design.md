# Design — P0/P1 Completion + Account-Enrichment Agent

> HMD Secure AI-native CRM · 2026-06-13 · brainstorming output
> Goal: build the one unbuilt agent (account/contact enrichment) **well**, and
> close the remaining P0/P1 gaps so the brief's target features are all satisfied.

## 1. P0 / P1 audit (against the live codebase, not the stale docs)

The repo is far more complete than the three `docs/agent-*.md` master prompts imply
(those call the meeting agent a "stub" — it already writes through `lib/db/mutations.ts`).

### P0 — 10/10 functionally present
Account/contact mgmt, case mgmt, deal pipeline+stages (3-yr phased forecast,
direct/reseller), offer creation+storage, **offer approval workflow** (`recordApproval`:
SM → if discount>10% → Finance, else approved — genuine two-step), product+pricing
catalog (`finance/catalog` + `CatalogEditor`), service catalog (internal/3rd-party in the
same editor), role-based access (4 role areas, own default views), personal dashboards,
case & deal notes (timestamped, polymorphic).
- **Sub-gap:** contacts are **read-only** — no `createContact` mutation or UI. "Accounts
  hold contacts" is only half-true. Closing this is also a hard dependency of the
  enrichment agent (it proposes decision-maker contacts).

### P1 — 5/7 present
Built: sales forecast view (`forecast.ts`, finance/pipeline, `weightedValue`), case
activity log (`activity_timeline`/`logActivity`), in-app notifications (inbox + `createNotification`/
`markNotificationRead`), deal-risk indicator (`isStalled`), AI next best action (`nextBestAction`
on rep deal page).
- **GAP — Search & filter:** per-view filter chips exist, but there is **no cross-entity
  search** across accounts/cases/deals.
- **GAP — Basic reporting:** only summary counts exist (`getRepSummary`/`getTeamSummary`:
  open/TCV/weighted/stalled). No close-rate, cases-by-status/service, or deals-by-stage/owner.

## 2. Scope (in priority order)

### A. PRIMARY — Account & Contact Enrichment agent (full vertical slice)
The showcase "AI analyst" moment: a bare `name + domain` account → a briefed account in
< 1 min, with an honest two-part output. Builds entirely now; lights up when the Gemini
key lands, with **no UI or call-site changes**.

- **Sensitivity (no migration):** derive "sensitive" from `industry ∈ {Defense, Government}`
  via `isSensitiveIndustry()` — the brief's sensitive customers are exactly defense/government,
  so no live-schema change is needed; a dedicated `accounts.sensitive` column can replace this
  later without touching call sites.
- **`crm/lib/ai/enrich.ts`:** new provider seam. Calls the **Gemini API with Google Search
  grounding** behind `GEMINI_API_KEY` (server-only). Returns the strict JSON shape from
  `docs/agent-account-enrichment.md §4` (`summary`, `found[]` with `sourceUrl`+`confidence`,
  `contacts[]`, `checkYourself[]`, `modelUsed`). **No key/error → `modelUsed:false`** with an
  honest "enrichment unavailable — fetch manually" message; **never fabricates**.
- **Mutations (new in `lib/db/mutations.ts`):** `updateAccount` (industry/country/website),
  `createContact` (also closes the P0 contacts gap), `logActivity` (`event_type='account_enriched'`,
  source URLs in `metadata` jsonb), and a `note` storing the full brief for institutional memory.
- **Write path:** Server Action (`"use server"`) + `revalidatePath()`. **Human-approval gate** —
  the agent proposes; nothing is written until the rep selects items and approves. Declining
  writes nothing. Mirrors the meeting→CRM gate.
- **UI:** "Fetch background" button on `app/rep/accounts/[id]`. Results render two-column —
  **"Found this"** (each a checkbox row + source link + confidence chip) / **"Worth checking
  yourself"** (muted). Brand tokens: black-on-lime only on the active Approve CTA + confidence
  chips. Sensitive/defense accounts: enrichment **off by default**, rep can opt in per-fetch;
  only the **public name/domain** ever leaves the app; in-UI "public sources only" note.

### B. Contacts create (P0 completion — folded into A)
`createContact` mutation + an "Add contact" form in `app/rep/accounts/[id]/NewRecordModals.tsx`.
Reused by A's approve-write.

### C. Cross-entity Search & filter (P1 gap)
A role-scoped grounded search across accounts / cases / deals (a ⌘K command bar reusing the
existing per-view filter semantics, with a `/search`-style results fallback). Read-only,
RLS-scoped to the asker. Independent of A.

### D. Basic reporting view (P1 gap)
A reporting surface for SM + Finance: deals by stage/owner, cases by status/service, close
rate = won/(won+lost). Deterministic from existing reads — **no AI**. Independent of A.

### E. OPTIONAL stretch (only if A–D are perfect)
Mount the existing conversational-query + meeting-capture agents on rep/sm/finance (TAM-only
today). These are brief §05 "agents to weave in," not strictly P0/P1.

## 3. Non-negotiables (project-wide)
- **Next.js 16 discipline:** read `crm/AGENTS.md` + `node_modules/next/dist/docs/` before
  writing. `params` is a `Promise`; async Server Components; middleware is `proxy.ts`.
- **No silent writes / grounded AI:** propose → human approves → write. Hallucination
  minimisation is the #1 AI constraint.
- **Degradation contract:** every AI path returns `modelUsed:false` + deterministic/honest
  fallback when no key. The demo must run with zero AI keys.
- Writes go through `lib/db/mutations.ts`; never import `@/lib/api` or `@/lib/mock-data` in
  shipped paths.
- Brand: anthracite chrome, Inter, lime `#e4ff00` only as fill/accent with black text.

## 4. Execution (subagents authorized by user)
- **A+B (enrichment + contacts):** driven in the main session — trickiest (Gemini seam,
  approval gate, brand UI), keep quality high.
- **C (search)** and **D (reporting)** are independent → parallel subagents (isolated
  worktrees), each briefed with the Next.js 16 discipline + brand + degradation contract.
- Integrate, run typecheck/build, verify against the brief's §07 "what good looks like"
  walkthrough, then seed a rich enrichment example (a bare name+domain account) so the
  "Found this / Worth checking yourself" moment is demoable end-to-end.

## 5. Acceptance
- Bare account → Fetch background → sourced "Found this" + honest "Worth checking yourself"
  → select → approve → fields/contacts persist, brief+sources on timeline, nothing written
  before approval; no `GEMINI_API_KEY` → degrades honestly (labelled, no fabrication);
  flagged sensitive account has enrichment off by default but opt-in works.
- Contacts can be created from the account 360 and appear on the account.
- Cross-entity search returns role-scoped accounts/cases/deals from one box.
- Reporting view shows deals-by-stage/owner, cases-by-status/service, and close rate.
- All P0 items demonstrably pass the §07 walkthrough; P1 search + reporting now present.
