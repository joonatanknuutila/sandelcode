# HMD Secure CRM — UX North Stars & Build Plan

> **What this is.** A shared thinking artifact for human review. Phase 1 names the
> *one job-to-be-done* per archetype — the single moment that, if made effortless
> and genuinely enjoyable, makes that person stop fighting their old tools. Phase 2
> turns each north star into a parallelizable subagent build plan on top of the
> code that already exists.
>
> **Do not implement from this yet.** Humans are reasoning about this in parallel.
>
> **Locked decisions (from review):**
> 1. **Persist everything** — every P0 write (new deal, log activity, open case,
>    offer build/send, SM + Finance approvals, confidence override, catalog edit,
>    meeting→CRM commit, notification mark-read, reassignment) writes through a real
>    Supabase mutation layer. Today they are all local/session state.
> 2. **Equal depth, impact-ordered** — all four personas get a full plan; sections
>    run **Rep → Finance → SM → TAM** (daily-driver demo lead → most acute wedge →
>    forecast sibling → already-most-complete).
>
> **Ground truth read:** `docs/challenge-brief.md`, `docs/meeting-notes-2026-06-13.md`,
> `docs/brand-hmd-secure.md`, `crm/SCHEMA.md`, `crm/FORECAST_AND_PRICING.md`,
> `crm/lib/db/*`, `crm/lib/types.ts`, and all four `crm/app/<persona>` trees.

---

## What already exists (audit baseline)

The app is **further along than a greenfield** — the read path is wired and the
information architecture per persona is largely right. The gap is almost entirely
**writes + AI-on-real-data + one missing screen per persona**.

**Wired & good (read path, live Supabase via `crm/lib/db`):**
- Role shell + role-aware nav + role switcher (`components/AppShell.tsx`, `lib/roles.ts`,
  `proxy.ts`). Each role lands on its own home.
- Rep: dashboard pipeline-by-stage + KPIs + "needs attention" (`app/rep/page.tsx`);
  accounts list (`app/rep/accounts/page.tsx`); **account 360** and **deal cockpit**
  (`app/rep/accounts/[id]`, `app/rep/deals/[id]`) with stage stepper, forecast grid,
  offers, timeline, AI next-best-action banner.
- TAM: triaged case queue (`app/tam/page.tsx`) and a genuinely strong **case cockpit**
  (`app/tam/cases/[id]/page.tsx`) — AI summary, "waiting on" derivation, SLA badge,
  unified service-history+notes timeline with a customer-facing toggle, meeting capture.
- SM: team pipeline by stage with stalled flags + SM approval gate (`app/sm/page.tsx`).
- Finance: time-phased 3-yr forecast grid, committed/weighted headline, Finance
  approval gate, confidence-override UI (`app/finance/page.tsx`, `ConfidenceOverride.tsx`).
- AI: grounded read-only assistant + meeting→CRM **approval gate** UX + deterministic
  fallbacks that label themselves honestly (`lib/ai/*`, `app/tam/Assistant.tsx`,
  `MeetingCapture.tsx`). Azure OpenAI provider with graceful no-key degradation.

**Stubbed / not yet real (the work):**
- **No write path anywhere.** "+ New deal", "Build & send offer", "+ Log activity",
  "+ Open service case", Approve/Reject, confidence override, forecast-grid edits, and
  meeting commit are all local `useState` or a session-local array
  (`lib/ai/meeting.ts:131 appliedActivities`). Nothing survives a refresh.
- **AI layer partly reads MOCK data, not `lib/db`:** `lib/ai/confidence.ts` imports
  `getActivitiesForDeal/getOffersForDeal` from `@/lib/api`; `lib/ai/forecast.ts` imports
  `deals` from `@/lib/mock-data`; `lib/ai/meeting.ts` imports from `@/lib/api`. So the
  Finance confidence column and the forecast narrative are computed off mock rows while
  the rest of the page is live — a correctness bug, not just a TODO.
- **Missing screens:** offer builder (catalog → lines → discount slider → submit);
  pricing-catalog editor (Finance); global search / conversational query; notifications
  center with mark-read; add-note composer on a case; SM gap-to-target + period toggle +
  reassign.
- **Brand not applied:** `docs/brand-hmd-secure.md` (lime `#e4ff00` / anthracite / Inter)
  is "design approved, implementation pending." Tokens still legacy teal in `globals.css`.
- **Auth/RLS reality:** RLS is on for all tables; `getCurrentUser()` falls back to the
  first rep; `ENFORCE_LOGIN=false`. Writes will need demo-permissive policies or a
  service-role server client (see Wave 0, S5).

---

# Phase 1 — The singular job per archetype

One job each. The wedge is the brief's *biggest frustration*. Order = build impact.

---

### 1. Sales Rep — *"Tell me where this deal stands and what to do next."*

- **The one job (their words):** *"I open a deal and in three seconds I know exactly
  where it stands and the one thing to do next — and I do that thing in one click,
  without re-reading a week of email."*
- **Wedge / friction to kill:** *"Losing where a deal stands after a week of email"*
  (brief) and *"doesn't know the next step after sending an email"* (interview). Today
  that state lives in the rep's inbox and head; logging is manual, so it doesn't happen.
- **What delight looks like:** the **deal reconstructs its own state and proposes the
  move.** Land on the deal → a grounded next-best-action at the top ("Re-engage — quiet
  11 days" / "Push toward an offer"), a glanceable stage stepper, the live 3-yr forecast,
  offers, and the timeline — then the NBA's CTA *actually does the thing* (logs the call,
  drafts the email, opens the offer builder) and persists. Zero modal-hunting, near-zero
  typing. Speed + "the system did the thinking" + one-click action.
- **The single screen (magic moment):** the **Deal Cockpit** `/rep/deals/[id]`, entered
  from the dashboard's "Needs attention." The NBA banner is the hero; the one-click CTA is
  the loop that replaces email archaeology.
- **What exists + the gap:** Cockpit layout, stepper, forecast grid, offers list, timeline,
  and an NBA banner already exist (`app/rep/deals/[id]/page.tsx`, `lib/ai/index.ts`). **Gap:**
  NBA is a stub keyed only off `lastActivity` and isn't grounded on the full timeline; every
  CTA is a dead `<Button>`; there is **no offer builder**; forecast edits don't save
  (`ForecastGrid` is local state); "+ Log activity" / "+ New deal" don't persist.

---

### 2. Finance — *"Give me the forecast that has never existed — and let me tune it."*

- **The one job:** *"Any time I want, I see a live, time-phased, weighted forecast —
  committed vs at-risk vs gap-to-target, with device units per quarter — without asking a
  single rep; and I can adjust the realistic number on any deal and ping the rep who owns it."*
- **Wedge / friction to kill:** *"There is no forecast to look at. Pipeline doesn't exist.
  None."* (brief — the most absolute frustration of the four). Finance plans **component
  buying** off this; interview: *"hardware must be ordered ahead; near-term device units
  matter as much as €."*
- **What delight looks like:** the forecast simply **exists and is theirs.** One opinionated
  view (explicitly *not* a BI toolkit — `FORECAST_AND_PRICING.md`): committed / at-risk /
  upside / **gap-to-target**, time-phased by quarter over 3 years, **device vs service kept
  separate**, **near-term device units** surfaced, and a per-deal **confidence score with its
  reasoning** that Finance can **override** (the override feeds gap-to-target) and attach a
  one-click *"why only 100 units?"* nudge to the rep. Plus a maintain-the-catalog-without-a-dev
  page. Trust comes from showing the *why* behind every number.
- **The single screen (magic moment):** the **Forecast Cockpit** `/finance` — the time-phased
  grid + committed/at-risk/gap-to-target band + device-units-per-quarter row + the confidence
  override that **persists**.
- **What exists + the gap:** Grid, committed/weighted headline, override UI, Finance approval
  gate exist (`app/finance/page.tsx`, `ConfidenceOverride.tsx`, `lib/ai/forecast.ts`,
  `confidence.ts`). **Gap:** **no gap-to-target** (no target input/table); **no period/stage/
  size filter**; **no device-units-per-quarter** on this page; confidence is computed off
  **mock** data and the **override never persists**; **no catalog editor**; near-term-units &
  device/service split live only on the TAM AI page, not Finance.

---

### 3. Sales Manager — *"Walk into the forecast meeting already knowing the truth."*

- **The one job:** *"I open one screen and it IS the forecast meeting — the whole team's
  pipeline by stage and owner, what's stalled, committed vs at-risk vs gap-to-target — and I
  can reassign or approve right there, without asking anyone for a verbal update."*
- **Wedge / friction to kill:** *"Forecast meetings run on verbal updates"* (brief); *"doesn't
  know what the data says underneath … coffee-room chats"* (interview).
- **What delight looks like:** the screen **replaces the verbal round-robin.** Objective team
  roll-up, a one-glance **stalled (14+ days)** list to intervene on, drill into any owner, and
  the two manager actions — **reassign** a deal/case and **approve/reject** discounts — done
  inline. A short AI **pipeline-health narrative** ("committed €X, gap €Y to target; 3 deals
  slipped past close") so the meeting opens with the story, not the spreadsheet.
- **The single screen (magic moment):** the **Pipeline War-Room** `/sm` — team KPIs + gap-to-
  target band + stalled list + by-stage/owner board + approval queue, with a quarter / half /
  full-year toggle.
- **What exists + the gap:** By-stage board with owner initials + stalled highlighting + SM
  approval gate exist (`app/sm/page.tsx`). **Gap:** **no committed/at-risk/gap-to-target**
  summary (only open-pipeline KPIs); **no period toggle**; **no reassignment**; **no dedicated
  stalled list**; **no SM-tailored narrative**; approvals don't persist or notify.

---

### 4. Technical Account Manager — *"Catch me up on this case in five seconds."*

- **The one job:** *"I open a case I've never seen and I'm fully caught up at a glance —
  the whole service history and every note on one timeline, what it's blocked on, whose move
  it is, and how close the SLA is."*
- **Wedge / friction to kill:** *"CC'd on a 3-day-old email thread with no context"* (brief &
  interview — verbatim).
- **What delight looks like:** **no reconstruction, ever.** The case opens with an AI summary
  (what happened, likely-related prior incident, suggested next step), a "**waiting on**"
  chip (HMD / customer / 3rd-party), the SLA countdown, and **one unified timeline** of service
  events + notes with a customer-facing toggle. Then the TAM can **add a note**, **escalate to
  3rd party**, or **resolve** in place — and drop a meeting transcript that, behind the approval
  gate, writes itself onto the timeline.
- **The single screen (magic moment):** the **Case Cockpit** `/tam/cases/[id]` — already the
  most complete screen in the app.
- **What exists + the gap:** AI summary, "waiting on", SLA, unified timeline + customer toggle,
  triaged queue, meeting capture, account-scoped assistant all exist (`app/tam/cases/[id]/*`,
  `lib/tam.ts`, `Assistant.tsx`, `MeetingCapture.tsx`). **Gap:** **no add-note composer** (the
  timeline is read-only); **resolve / escalate / reassign** are absent; meeting commit is a
  session stub; case `assistant`/`summary` read live data but `meeting.ts` still imports mock.
  This is the **smallest** gap — mostly the shared write layer plus three inline actions.

---

# Phase 2 — Subagent build plans (per archetype)

**Operating rules for every task below**
- **Stack discipline:** Next.js **16** has breaking changes vs training data — read
  `crm/AGENTS.md` and the relevant guide in `node_modules/next/dist/docs/` before writing.
  `params` is a `Promise`; pages are async Server Components; `proxy.ts` (not `middleware.ts`).
  Writes use **Server Actions** (`"use server"`) calling the new mutation layer, then
  `revalidatePath()`. Client widgets call actions via `useActionState`/form actions or `fetch`
  to a route handler.
- **Data discipline:** read through existing `crm/lib/db/index.ts` functions; new reads/writes
  go in `crm/lib/db/` and **return UI types** (`lib/types.ts`) — DB↔UI translation in
  `mappers.ts` (see the divergence table in `lib/db/README.md`; mutations need the **inverse**
  mappers). Never import `@/lib/api` or `@/lib/mock-data` in shipped paths.
- **Brand discipline:** honor `docs/brand-hmd-secure.md` — lime `#e4ff00` only as a fill/accent
  with **black text**, anthracite chrome, Inter, security-grade restraint.
- **Verify discipline:** each task ends with `cd crm && npm run build` clean **and** a named
  route to open in `npm run dev` with the concrete thing to look at. Seed data already exists.
- **Parallelism:** tasks marked `[parallel]` within a wave have no shared files; tasks marked
  `[after Sx]` depend on a Wave-0 deliverable. One subagent per task.

---

## Wave 0 — Cross-persona shared foundation (land FIRST; do not duplicate)

These unblock every persona. **S1–S5 gate the persona waves.**

### S1 — Mutation layer in `lib/db` `[foundational]`
- **Goal:** one server-only write surface returning UI types, so persona Server Actions stay thin.
- **Files:** Create `crm/lib/db/mutations.ts` (`import "server-only"`); extend
  `crm/lib/db/mappers.ts` with inverse UI→DB mappers (`stageToDb`, `roleToDb`, `priorityToDb`,
  `offerStatusToDb`, `caseStatusToDb`).
- **Functions to add (names are the contract for later tasks):**
  `createDeal`, `updateDealStage`, `setForecastPhases` (→ `deal_forecast_phases`),
  `logActivity` (→ `activity_timeline`), `createCase`, `updateCaseStatus`, `escalateCase`,
  `addCaseNote` (→ `notes`, `entity_type='case'`), `createOffer` + `setOfferLines`
  (→ `offers`/`offer_line_items`), `submitOffer`, `recordApproval` (→ `approvals` + advance
  `offers.status`), `saveConfidenceOverride` (→ new table, S4), `upsertProduct`/`retireProduct`/
  `upsertService` (catalog), `markNotificationRead`/`createNotification`, `reassignDeal`/`reassignCase`,
  `commitMeeting` (real `activity_timeline`/`notes` inserts; replaces the session array).
- **Data:** writes to real tables already mapped on the read side: `deals`, `deal_forecast_phases`,
  `activity_timeline`, `cases`, `notes`, `offers`, `offer_line_items`, `approvals`, `products`,
  `services`, `notifications`.
- **Verify:** add a temporary `app/api/_smoke/route.ts` that calls `logActivity` then
  `getActivitiesForAccount`; hit it, confirm the row round-trips; delete the smoke route.

### S2 — Point the AI layer at `lib/db` (correctness fix) `[parallel with S1 read-side]`
- **Goal:** kill the mock-data reads so Finance/SM/TAM AI reflect live pipeline.
- **Files:** `crm/lib/ai/confidence.ts` (swap `@/lib/api` → `@/lib/db`; make `confidence()`
  **async** — it now awaits `getActivitiesForDeal`/`getOffersForDeal`), `crm/lib/ai/forecast.ts`
  (drop `mock-data`; compute from `getOpenDeals()`/`getWonDeals()`), `crm/lib/ai/meeting.ts`
  (`@/lib/api` → `@/lib/db`; commit calls `commitMeeting` from S1). Ripples: `app/finance/page.tsx`
  and `app/tam/ai/page.tsx` must `await confidence(d)` (e.g. `Promise.all(open.map(confidence))`).
- **Verify:** `npm run build` clean; `/finance` confidence column and `/tam/ai` narrative match the
  live deals shown elsewhere on the page (no divergence between mock and live numbers).

### S3 — Design-system primitives + brand application `[parallel]`
- **Goal:** the write flows need inputs/overlays the kit lacks, and the app must look like HMD Secure.
- **Files:** `crm/app/globals.css` + `crm/lib/brand.ts` (token remap per `brand-hmd-secure.md`);
  extend `crm/components/ui.tsx` with `Input`, `Textarea`, `Select`, `Slider`, `Modal`/`Drawer`,
  `Toast`/`toast()`. Keep it dependency-free (matches the existing "no shadcn" choice).
- **Verify:** `/rep` renders anthracite sidebar + lime active nav + Inter; a Storybook-less smoke
  page (`app/_kitchen-sink/page.tsx`, deleted after) shows every primitive; black-on-lime only.

### S4 — Forecast targets + confidence-override persistence (schema) `[after S1 mappers]`
- **Goal:** gap-to-target (SM + Finance) and a durable Finance override need storage.
- **Files:** new migration via `mcp__supabase__apply_migration`: `forecast_targets`
  (`period text, amount_eur numeric`) and `deal_confidence_overrides`
  (`deal_id, value int, reason text, set_by, set_at`). Regenerate `crm/lib/types.db.ts`
  (`mcp__supabase__generate_typescript_types`). Add reads `getTargets()`,
  `getConfidenceOverrides()` and writes `setTarget()`, `saveConfidenceOverride()` to `lib/db`.
- **Verify:** `list_tables` shows both; `getTargets()` returns seeded rows; build clean.

### S5 — Demo write-auth / RLS posture `[after S1]`
- **Goal:** writes must succeed under RLS while real auth is stubbed.
- **Files:** either demo-permissive `INSERT/UPDATE` policies (migration) **or** a service-role
  server client for mutations in `crm/lib/supabase/server.ts` (kept out of client bundles).
  Document the production swap (Entra ID) inline — query layer unaffected.
- **Verify:** S1 smoke write succeeds while signed out (demo fallback user); `get_advisors`
  shows no new critical RLS hole beyond the intended demo scope.

**Wave-0 dependency note:** S1 → (S4, S5); S2 needs S1's `commitMeeting`; S3 is independent.
Persona waves below assume S1–S5 merged.

---

## Wave 1 — Sales Rep (highest impact; demo lead)

### R1 — Real Next-Best-Action, grounded on the full timeline `[after S2]`
- **Goal:** make the cockpit's hero banner trustworthy and specific.
- **Files:** `crm/lib/ai/index.ts` (`nextBestAction` → async, accept the full `Activity[]` +
  offers + SLA-adjacent signals, keep deterministic fallback + Azure path & honest "model offline"
  label); `crm/app/rep/deals/[id]/page.tsx` (pass full timeline).
- **Data:** `getActivitiesForDeal`, `getOffersForDeal`, `getDeal` (all existing).
- **Verify:** `/rep/deals/[id]` for a 14-day-quiet deal shows the re-engage NBA; for an `rfp` deal
  with an open offer, a "follow up on the offer" NBA. Build clean.

### R2 — NBA one-click actions that persist `[after S1, R1]`
- **Goal:** the CTA *does the thing* — log call / draft+log email / open offer builder / move stage.
- **Files:** Create `crm/app/rep/actions.ts` (`"use server"`: `logActivityAction`,
  `moveStageAction` → S1 `logActivity`/`updateDealStage` + `revalidatePath`); wire the banner CTA
  and the dead "+ Log activity" button in `app/rep/deals/[id]/page.tsx` (client sub-component for
  the form). Draft-email uses the Azure path with the "AI drafts, human sends" pattern.
- **Data:** S1 `logActivity`, `updateDealStage`.
- **Verify:** click "Log a discovery call" → row appears in the deal timeline after revalidate and
  survives refresh; stage stepper advances on stage move.

### R3 — Offer builder (catalog → lines → discount slider → submit) `[after S1, S3]`
- **Goal:** the missing P0 screen and the rep's second magic moment.
- **Files:** Create `crm/app/rep/deals/[id]/offer/page.tsx` + a client `OfferBuilder.tsx`
  (catalog picker, qty, **discount slider** with live total per `FORECAST_AND_PRICING.md`,
  justification required > 0%); `app/rep/actions.ts` add `createOfferAction`/`submitOfferAction`.
  Routing: `0% → none · ≤10% → SM only · >10% → SM then Finance` (assumption, label it).
- **Data:** reads `getProducts`, `getServices` (existing); writes S1 `createOffer`/`setOfferLines`/
  `submitOffer`; on submit, S1 `createNotification` to SM (and Finance if >10%).
- **Verify:** build an offer with a 12% discount + justification → `offers` row at
  `pending_sm_approval`, lines persisted, SM dashboard shows it in the queue.

### R4 — Persisting forecast grid + new-deal + open-case actions `[after S1]` `[parallel with R3]`
- **Goal:** make the remaining rep writes real.
- **Files:** `crm/components/ForecastGrid.tsx` (debounced save via `setForecastPhases`);
  account 360 `app/rep/accounts/[id]/page.tsx` "+ New deal" / "+ Open service case" → a `Modal`
  (S3) backed by `createDealAction`/`createCaseAction` in `app/rep/actions.ts`.
- **Data:** S1 `setForecastPhases`, `createDeal`, `createCase`, `logActivity` (stamp a
  `stage_change`/`case_opened` activity).
- **Verify:** edit Q1 devices → TCV recomputes and persists on refresh; new deal appears on the
  dashboard board; new case shows on the account *and* in the TAM queue.

---

## Wave 2 — Finance (most acute wedge; the "analyst on the team" showcase)

### F1 — Gap-to-target band + device-units-per-quarter on `/finance` `[after S2, S4]`
- **Goal:** complete the forecast spine (committed / at-risk / **gap-to-target** + units).
- **Files:** `crm/app/finance/page.tsx` (add committed/at-risk/upside/gap band using
  `lib/ai/forecast.ts` figures + `getTargets()`; add a device-units-per-quarter row to the
  time-phased grid). Reuse `computeForecast()` figures from S2-fixed `forecast.ts`.
- **Data:** `getOpenDeals`, `getWonDeals`, `getTargets` (S4); figures already split device/service
  and expose `nearTermDevices`.
- **Verify:** `/finance` shows gap = target − committed for the selected horizon; the grid shows a
  units row per quarter; numbers reconcile with the headline.

### F2 — Persisted confidence override + "ping the rep" `[after S1, S4, S2]`
- **Goal:** the override that drives ordering becomes durable and actionable.
- **Files:** `crm/app/finance/ConfidenceOverride.tsx` (save via action, show "Finance override"
  badge from stored value, not just local state); `crm/app/finance/actions.ts`
  (`saveOverrideAction` → S1/S4 `saveConfidenceOverride`; `pingRepAction` → S1 `createNotification`
  to the deal's `ownerId` with the "why only N units?" body).
- **Data:** S4 `saveConfidenceOverride`/`getConfidenceOverrides`; `getDeal().ownerId`.
- **Verify:** set 55% + reason → persists on refresh and feeds gap-to-target; rep's dashboard
  "Needs attention" shows the ping.

### F3 — Pricing-catalog editor (no developer) `[after S1, S3]` `[parallel with F1/F2]`
- **Goal:** the missing P0 — Finance maintains products/services in-app.
- **Files:** Create `crm/app/finance/catalog/page.tsx` + `CatalogEditor.tsx` (table + add/edit
  price/retire); add `Catalog` to Finance nav in `lib/roles.ts`; `app/finance/actions.ts`
  `upsertProductAction`/`retireProductAction`/`upsertServiceAction`.
- **Data:** `getProducts`/`getServices` (existing); S1 `upsertProduct`/`retireProduct`/`upsertService`
  (set `is_active=false` to retire).
- **Verify:** edit a list price → reflected in the offer builder picker (R3); retire a product →
  drops out of the active catalog; build clean.

### F4 — Finance approval persistence + period/size filters `[after S1]` `[parallel]`
- **Goal:** make the second approval gate real and add the one allowed filter set.
- **Files:** `crm/components/OfferApproval.tsx` (decision → `recordApproval` action; on Finance
  approve, set offer `approved`/locked + notify rep); `app/finance/page.tsx` add period (Q/H/Y) +
  deal-size filter controls over the grid. Keep it one opinionated view (no pivot builder).
- **Data:** S1 `recordApproval`, `createNotification`; existing `getOffersByStatus("pending_finance")`.
- **Verify:** approve a `pending_finance` offer → `approvals` row + `offers.status=approved`,
  rep notified; switching to "Year 1" filters the grid.

---

## Wave 3 — Sales Manager (forecast sibling; shares Wave-2 infra)

### M1 — Committed/at-risk/gap-to-target + period toggle on `/sm` `[after S2, S4]`
- **Goal:** the war-room roll-up that replaces verbal updates; reuse Finance's forecast math.
- **Files:** `crm/app/sm/page.tsx` (add the gap band + quarter/half/year toggle, mirroring F1 so
  SM and Finance agree on numbers). Extract the band into a shared
  `crm/components/ForecastSummary.tsx` to avoid F1/M1 divergence.
- **Data:** `getTeamSummary` (existing), `computeForecast()` figures (S2), `getTargets` (S4).
- **Verify:** `/sm` gap-to-target equals `/finance` for the same horizon; toggle changes both KPIs
  and board scoping.

### M2 — Dedicated "stalled / not moved 14+ days" intervention list `[after S1]` `[parallel]`
- **Goal:** make the brief's "spot deals not moved 14+ days" a first-class list, not a badge.
- **Files:** `crm/app/sm/page.tsx` (a sorted stalled section above the board using existing
  `isStalled`); each row gets the reassign control (M3).
- **Data:** `getAllDeals` + `isStalled` (existing), `getUsers` for owners.
- **Verify:** seed a 20-day-idle deal → it tops the stalled list with "20d idle".

### M3 — Reassign deals/cases between reps/TAMs `[after S1]`
- **Goal:** the manager's core intervention action, inline.
- **Files:** `crm/app/sm/actions.ts` (`reassignDealAction` → S1 `reassignDeal` + `createNotification`
  to old & new owner); a `Select` (S3) of users on each board/stalled card.
- **Data:** S1 `reassignDeal`/`reassignCase`, `getUsers`.
- **Verify:** reassign a deal to another rep → owner initials update after revalidate; the new
  owner's `/rep` board shows it; both reps notified.

### M4 — SM pipeline-health narrative `[after S2]` `[parallel]`
- **Goal:** open the meeting with the story.
- **Files:** add an SM branch to `lib/ai/forecast.ts` (or a small `pipelineNarrative()` reading
  team figures + stalled + gap); render an AI card on `app/sm/page.tsx`. Deterministic fallback,
  honest "model offline" label.
- **Data:** `getOpenDeals`, `isStalled`, `getTargets`.
- **Verify:** card reads e.g. "Committed €X, €Y gap to target; 3 deals slipped past close" and the
  figures match the board.

---

## Wave 4 — TAM (smallest gap; mostly write actions on a strong screen)

### T1 — Add-note composer on the case timeline `[after S1]`
- **Goal:** make the unified timeline writable (internal vs working note).
- **Files:** `crm/app/tam/cases/[id]/page.tsx` + a client `AddNote.tsx`; `app/tam/actions.ts`
  `addNoteAction` → S1 `addCaseNote` (visibility toggle); `revalidatePath`.
- **Data:** S1 `addCaseNote`; existing `getNotesForCase`.
- **Verify:** add a working note ending in "?" → appears on the timeline and flips "waiting on" to
  *customer* (per `requestStatus`); survives refresh; customer-facing toggle hides internal notes.

### T2 — Resolve / escalate / reassign case actions `[after S1]` `[parallel with T1]`
- **Goal:** the three inline state changes a TAM needs from the cockpit + queue.
- **Files:** `app/tam/cases/[id]/page.tsx` header actions + `app/tam/actions.ts`
  (`resolveCaseAction`, `escalateCaseAction`, `reassignCaseAction`); also expose resolve on the
  queue rows (`app/tam/page.tsx`).
- **Data:** S1 `updateCaseStatus`, `escalateCase`, `reassignCase`; stamp an `activity_timeline`
  event so the change shows on the timeline.
- **Verify:** escalate → `ThirdPartyFlag` + "waiting on 3rd-party" appear and persist; resolve →
  case drops out of the open queue into "recently resolved"; KPIs update.

### T3 — Real meeting→CRM commit (keep the approval gate) `[after S1, S2]`
- **Goal:** the differentiator write path becomes durable without weakening the human gate.
- **Files:** `crm/lib/ai/meeting.ts` (`commitMeeting` → S1 inserts into `activity_timeline`/`notes`,
  replacing `appliedActivities`); `app/api/meeting/commit/route.ts` (call the real path; keep
  `approved===true` hard gate); `MeetingCapture.tsx` unchanged UX.
- **Data:** S1 `commitMeeting`, `logActivity`, `addCaseNote`.
- **Verify:** paste a transcript → draft + follow-ups (nothing saved) → approve 2 changes → exactly
  those 2 rows land on the account timeline and survive refresh; declining writes nothing.

### T4 — Notifications center + mark-read (shared, surfaced first for TAM/Rep) `[after S1]` `[parallel]`
- **Goal:** the brief's in-app notifications with mark-read + jump-to-record (used by R3/F2/M3 pings).
- **Files:** Create `crm/components/NotificationCenter.tsx` in `AppShell.tsx` top bar (bell + unread
  count + list); `app/actions.ts` `markReadAction` → S1 `markNotificationRead`.
- **Data:** existing `getNotifications`; S1 `markNotificationRead`.
- **Verify:** a ping from F2/R3 appears in the bell; clicking marks read and deep-links to the record;
  count decrements and persists.

---

## Cross-cutting P1 (optional, after the four waves) — global conversational query
- **Goal:** the brief's "at-risk enterprise deals in DACH → live answer + filter" and a command bar.
- **Files:** `crm/components/CommandBar.tsx` (⌘K) in `AppShell.tsx`; reuse `lib/ai/assistant.ts`
  grounding; a route handler that returns an answer **and** a structured filter applied to the
  current persona view.
- **Verify:** query returns a grounded answer and narrows the visible board; degrades to keyword
  filter when the model is offline.

---

## Dependency graph (what blocks what)

```
S1 ─┬─> S4 ─┬─> F1, F2, M1
    ├─> S5  │
    ├─> R2, R3, R4, F3, F4, M2, M3, T1, T2, T3, T4
S2 ─┴─> R1, F1, M1, M4, T3
S3 ────> R3, F3, T4, CommandBar   (UI primitives + brand)
```
- **Parallelizable within a wave** (no shared files): R3∥R4 · F1∥F2∥F3∥F4 · M2∥M3∥M4 · T1∥T2∥T4.
- **Serialize where a file is shared:** R1→R2 (both touch the cockpit/banner); F1 & M1 share
  `ForecastSummary.tsx` (build it in F1, consume in M1); `OfferApproval.tsx` is touched by R3
  (producer) and F4 (consumer) — land S1 first, then they're independent.

## Trade-offs & alternatives (for the humans reasoning in parallel)
- **Persist-everything vs hero-only:** chosen *persist everything*. Risk in a 2-day window is
  breadth over polish — if time compresses, **fall back to hero writes** (R2/R3, F2, M3, T3) and
  leave the rest labelled-stub; the plan's task boundaries make that downgrade clean.
- **Server Actions vs route handlers:** plan uses Server Actions for form writes (less plumbing,
  native revalidate) and keeps route handlers only where a client widget already posts
  (`/api/meeting/*`, `/api/assistant`). Alternative: all-route-handlers for a cleaner future Azure
  API swap — heavier now.
- **Confidence override storage:** new `deal_confidence_overrides` table (audit-friendly, keeps the
  rule score visible beside the human number) vs a column on `deals` (simpler, loses history). Plan
  picks the table per `FORECAST_AND_PRICING.md`'s "keep both the rule value and Finance's override."
- **One forecast math, two views:** F1 and M1 deliberately share `computeForecast()` +
  `ForecastSummary.tsx` so SM and Finance can never quote different numbers in the same meeting.
- **AI scope:** every AI surface keeps a deterministic, honestly-labelled fallback (interview:
  "hallucination minimisation is critical; the user always approves"). No autonomous writes — the
  only write AI participates in is the gated meeting→CRM commit.

> **Stop here.** This is the plan. Implementation begins only after human review.
