# MASTER BUILD PROMPT — Per-Persona Conversational Query Assistant
**Product:** HMD Secure AI-native CRM · **Agent scope:** role-aware grounded Q&A (read-only)
**Audience:** AI coding agent(s) building on the existing repo · **Use:** paste as the spec

## 0. How to use this prompt
You are extending **one agent** that already exists in skeleton form (`crm/lib/ai/assistant.ts`, `POST /api/assistant {role, question, accountId?}`). The DB, auth, data layer, AI provider, and design system are **shared — do not rebuild them.** Your job: make the per-persona assistant genuinely answer the role-relevant questions each user actually asks, grounded in their own permitted data.

**Stack discipline (non-negotiable):** Next.js **16** — read `crm/AGENTS.md` and `node_modules/next/dist/docs/` first. `params` is a `Promise`; async Server Components; middleware is `proxy.ts`. This agent is **read-only** — no Server-Action writes. Never import `@/lib/api` or `@/lib/mock-data` in shipped paths; read through `crm/lib/db`.

## 1. Shared foundation (reuse — don't rebuild)
- `crm/lib/ai/assistant.ts` + `app/api/assistant` already define the entry shape `{role, question, accountId?}` → read-only answer. Build on this, don't fork it.
- AI provider `crm/lib/ai/provider.ts`: `complete()`, Azure OpenAI default, **returns `null` on no-key/error → deterministic fallback**; `modelUsed:false` marks a fallback answer. Honor this.
- Typed reads in `crm/lib/db` (async, return UI types). RLS on all tables; `getCurrentUser()` resolves the asker + role.
- Brand: HMD Secure — anthracite chrome, Inter, lime `#e4ff00` only as fill/accent with black text.

## 2. What this agent is (the job-to-be-done)
Each of the **four roles** (Rep, TAM, SM, Finance) gets a chat box where they ask plain-language, role-relevant questions and get a grounded answer that **eases their daily work** — e.g. *"any enterprise deals at risk in the DACH region?"* → the assistant retrieves matching deals, evaluates the risk rule, and answers in plain language (optionally narrowing the current view). It is **the analyst on the team**, not a search box.

## 3. Trigger-based, scoped retrieval (explicit refinements — load-bearing)
1. **The user's message is the trigger.** The agent does **not** continuously read or watch the database. On each question it fetches **only the relevant slice** for that question, then answers. No background polling, no whole-DB ingestion.
2. **It reads only data the asker is permitted to see.** Retrieval is always *directed* and *scoped to the person*: Rep → own accounts/deals; TAM → accounts they're TAM for + case/service history; SM → all reps' deals (team); Finance → aggregate pipeline + weighted forecast (read-only). Enforce scope in the query layer, not just RLS.
3. **The answer must be relevant to the asker, and grounded.** Resolve the question against that person's permitted data; if the facts aren't actually there, say so honestly ("no deals match that in your accounts") rather than inventing. Relevance + groundedness over completeness.

## 4. The four lenses (scope + tone + the questions each actually asks)
- **Sales Rep** — *own accounts/deals only*, tone brisk/action-oriented. "What's the status of deal X?" · "What changed since I last looked?" · "Which of my deals are stalled?"
- **TAM** — *their accounts + case/service history*, tone precise/technical. "Status on the Account X case?" · "What did we promise this account during the sale?" · "Which cases are near SLA?"
- **Sales Manager** — *whole team's deals*, tone concise/exec. "Which deals haven't moved in 14+ days?" · "How does this rep's close-rate compare?" · "What's our gap-to-target this quarter?"
- **Finance** — *aggregate pipeline + weighted forecast, read-only*, tone neutral/numeric/cautious. "Committed vs at-risk next quarter?" · "Why did the number change?" · "Which big deals carry the forecast?"

## 5. Resolving fuzzy terms (a decision we owe HMD)
Plain-language queries use words the data must map to. Define them once, centrally, and label them as assumptions on-screen:
- **"at risk"** — propose **two** meanings the assistant disambiguates between: (a) **deal-risk** = not updated 14+ days OR past `expected_close` (the existing `isStalled` rule + overdue), and (b) **forecast at-risk band** = weighted revenue from stages 40–60% (`rfp`/`customer_test`), per `FORECAST_AND_PRICING.md`. Default to (a) for Rep/SM, (b) for Finance; let the question's wording override. **Confirm with HMD.**
- **region / "DACH"** → filter on `accounts.country` (DACH = DE/AT/CH; note CH ≠ EU, residency is EU-only).
- **"enterprise"** → `accounts.sector = enterprise` (vs government).

## 6. Output
- A **plain-language answer**, grounded, citing the specific records it used (deal/account/case names — not raw IDs).
- Optional **structured filter** the UI can apply to the current persona view (the brief's *"live answer + filter"*), e.g. `{ sector:'enterprise', risk:true, country:['DE','AT','CH'] }`.
- `modelUsed` boolean so a fallback answer is labelled honestly.

## 7. Provider & fallback
Route through `provider.complete()`. **No key / error → deterministic fallback**: run the scoped DB query directly and return a templated answer + the structured filter, `modelUsed:false`. The feature must work with no LLM key (demo-safe) — the model phrases the answer; the DB query produces the facts.

## 8. UI surface
- Per-persona **chat box** on each role's home/relevant view (Rep account view, TAM account+case list, SM team dashboard, Finance forecast view) — surfaces already named in `personas.md`.
- Optional shared **⌘K command bar** (the P1 idea in `docs/ux-north-stars-and-plan.md`) reusing this same grounding + filter path.
- Answers render in-chat; an "apply filter" affordance narrows the visible board.

## 9. Out of scope
No writes of any kind (read-only agent). No always-on/background reading. No cross-scope data (a rep can never get another rep's deals through it). No BI/pivot/report-builder behaviour — one grounded answer, optionally one filter.

## 10. Acceptance criteria
For each role, a user can ask a role-relevant plain-language question and get a grounded answer drawn **only** from their permitted data, with the records named; the same query can narrow the current view; an out-of-scope or no-match question yields an honest "nothing matches", not a fabrication; with no LLM key the deterministic path still answers from the DB (`modelUsed:false`).

## 11. Open questions (flag, don't guess)
- Lock the **"at risk"** definition(s) per role.
- Should the assistant be allowed to **apply** the filter automatically, or only propose it?
- Do we want the **⌘K global** bar in the demo, or per-view chat boxes only?
