# MASTER BUILD PROMPT — P2 Features + "What Good Looks Like" Evals
**Product:** HMD Secure AI-native CRM · **Scope:** P2 stretch features + an executable acceptance/eval suite
**Audience:** the next AI coding session building on the existing repo · **Use:** paste as the spec

## 0. How to use this prompt
P0 and P1 are complete and deployed (see `docs/superpowers/specs/2026-06-13-p0p1-completion-and-enrichment-agent-design.md`).
Your job is the **P2 stretch features** AND to stand up the brief's **§07 "What good looks like"**
scenario as a repeatable **eval suite** that we run before the demo. Do P2 only after the evals
pass on `main` as-is — the evals are the safety net for everything already built.

**Audit before you build. The `docs/*.md` prompts and any "stub" notes are STALE** — last session found the
"meeting agent stub" already wrote for real. Verify each P2 item against the live code first (pointers in §1).

## 1. Current state — what already exists (do NOT rebuild)
Run a quick audit; here's what was true on 2026-06-13:
- **AI forecast narrative — BUILT.** `lib/ai/forecast.ts` exports `forecastNarrative()` + `pipelineNarrative()`,
  model-routed through `lib/ai/provider.ts`, mounted on `app/sm/page.tsx` and `app/tam/ai/page.tsx`. → **Verify + polish only.**
- **SLA & due-date tracking — MOSTLY BUILT.** `lib/tam.ts` `slaInfo()` gives `none|ok|soon|breach` (24h "soon"
  window), surfaced on `app/tam/page.tsx`, the case detail, the TAM assistant, and `AccountDetailView`. → **Verify
  "approaching/overdue" is prominent enough; close any gap, don't re-architect.**
- **AI case summary — PARTIAL.** `lib/tam.ts` `summariseCase()` exists and is mounted on `app/tam/cases/[id]/page.tsx`,
  but it is **deterministic**, not model-backed, and is not gated on "5+ notes". → **Upgrade (see §3.B).**
- **Excel / CSV export — MISSING.** No `csv`/`xlsx`/export code anywhere. → **Real gap (see §3.A).**
- **Email-to-case (MS Graph) / Outlook calendar (MS Graph) — NOT BUILT, platform-blocked.** The demo runs on
  **Supabase (eu-north-1)**, not Azure; Microsoft Graph is part of the *final* Azure solution only. → **Seam + honest
  defer (see §3.E), do not fake an integration.**

## 2. Stack discipline (non-negotiable)
- **Next.js 16** — read `crm/AGENTS.md` and `crm/node_modules/next/dist/docs/` before writing. `params` is a
  `Promise`; async Server Components; middleware is `proxy.ts`; Server Actions use `"use server"` + `revalidatePath()`.
- Reads through `crm/lib/db`; writes through `crm/lib/db/mutations.ts`. Never import `@/lib/api` or `@/lib/mock-data`
  in shipped paths.
- **Degradation contract:** every AI path returns `modelUsed:false` + a deterministic fallback when no key is set.
  **The demo and the evals must pass with ZERO AI keys.** The model only rephrases; the DB/logic produces the facts.
- **Mandatory AI safety pattern:** grounded, no silent writes — propose → human approves → write. Hallucination
  minimisation is the #1 AI constraint.
- **Brand:** anthracite chrome, Inter, lime `#e4ff00` only as fill/accent with black text. Reuse existing UI
  primitives (`components/ui.tsx`, `components/ui-client.tsx`); don't invent a new visual language.

## 3. P2 scope (priority order — do one thing well before the next)

### A. Excel / CSV export (the real gap — highest value)
Finance's stated need: *"Export pipeline data to Excel"* + pull cases. Build server-generated **CSV** (Excel opens it
natively; no heavy xlsx dep needed — but `xlsx` is acceptable if you keep the bundle lean and server-only).
- A "Export CSV" affordance on the **Finance forecast/pipeline** view and on the **Reports** view
  (`components/Reports.tsx`, mounted at `/finance/reports` + `/sm/reports`).
- At least two exports: **pipeline/forecast** (deal, account, owner, stage, channel, TCV, weighted, expected close,
  per-quarter phased revenue) and **cases** (id, account, service, priority, status, age, SLA state, escalated).
- Implement as a **Route Handler** (`app/.../export/route.ts`) returning `text/csv` with a
  `Content-Disposition: attachment` filename, or a Server Action that streams a Blob. Role-scope the data to the
  caller. Deterministic — **no AI**. Honour the brief's out-of-scope: this is *export*, not bulk import.

### B. AI case summary — upgrade to model-backed, gated on 5+ notes
Keep `summariseCase()` as the deterministic fallback; add a thin model path:
- New `lib/ai/case-summary.ts` (or extend `lib/ai/assistant.ts` patterns) that routes through `provider.complete()`,
  is **grounded only in the case + its notes + service history**, returns a one-paragraph summary + `modelUsed`.
- **Trigger:** only offer the AI summary when a case has **≥ 5 notes** (brief's threshold); below that, the existing
  deterministic headline is enough. Surface it on `app/tam/cases/[id]/page.tsx` near the existing summary.
- No writes. No invented facts. `modelUsed:false` → fall straight back to `summariseCase()`.

### C. SLA & due-date tracking — verify + finish
`slaInfo()` already classifies. Confirm the brief's *"highlight overdue / approaching"* is unmistakable: a TAM
queue/dashboard band that pulls `breach` + `soon` to the top (the triage sort likely already does — verify), and an
"approaching SLA" indicator on the case row + case detail. Add only what's missing; this is mostly a verification item.

### D. AI forecast narrative — verify + polish
Confirm `forecastNarrative()`/`pipelineNarrative()` render on the Finance view (brief P2 places it on Finance) — today
they're on SM + TAM-AI. If Finance lacks it, mount the same component on the Finance forecast view. No rebuild.

### E. Microsoft Graph features (email-to-case, Outlook calendar) — seam + honest defer
These need Azure + Microsoft Graph, which the demo platform (Supabase) does not have wired. **Do not fake them.**
Instead:
- Add a clean **provider seam** mirroring `lib/ai/provider.ts`: e.g. `lib/integrations/graph.ts` with
  `isGraphConfigured()` and typed `createCaseFromEmail()` / `bookFollowUp()` that **return a "not configured on this
  platform" result** until Azure creds exist — same degradation philosophy as the AI providers.
- For **email-to-case**, you may demonstrate the *inbound-text → case* mechanic **without** Graph by reusing the
  existing meeting→CRM capture: a "paste an inbound email" affordance that proposes a case (human-approved) via the
  already-built gate. Label it clearly as the demo stand-in; the Graph webhook is the Azure-final path.
- For **Outlook calendar**, a "Book follow-up" button on a case that is **disabled with a tooltip** ("available on
  Azure/Graph") is an honest placeholder. Keep the seam so it lights up later with no UI change.
- If time is short, these two are the **lowest priority** — a clear seam + honest defer beats a fake integration.

## 4. EVALS — the brief's §07 "What good looks like" as an acceptance suite
These eight scenarios ARE the acceptance criteria and the demo script. They must pass on the **deployed/main build with
NO AI keys** (deterministic paths). Roles are switched via the AppShell **"View as"** switcher (auth is stubbed —
`getCurrentUser()` returns a demo user). Use the seeded demo data (`crm/seed/generate.mjs`).

For each: **Pre** (where to start) · **Do** (the action) · **Assert** (the observable pass condition).

1. **Rep sees account 360.** Pre: `/rep/accounts`. Do: open any account. Assert: open **deals AND active cases**
   render together on one account view, plus the activity timeline.
2. **Rep creates a deal.** Pre: account 360 → "+ New deal". Do: mark **direct**, pick a stage, set expected close,
   enter a 12-month (phased) forecast. Assert: deal persists, appears in the pipeline at the chosen stage, forecast
   shows phased quarters; survives refresh.
3. **Rep builds an offer.** Pre: a deal → offer builder. Do: add devices + services from the catalog, generate offer.
   Assert: offer stored on the account, versioned, total computed from catalog prices.
4. **TAM works a case.** Pre: `/tam` → an assigned case. Do: read history, add a note, close it. Assert: note is
   timestamped + attributed on the timeline; status → resolved; SLA/age reflect correctly.
5. **Manager sees risk + pipeline.** Pre: `/sm`. Do: land on the dashboard. Assert: **overdue deals** (new `isOverdue`)
   and the **3-yr weighted pipeline** are visible immediately — no drilling.
6. **Finance sees the forecast.** Pre: `/finance`. Do: land on the view. Assert: **time-phased forecast by quarter
   over 3 yrs** is shown without asking sales; weighted by stage.
7. **Rep gets next best action.** Pre: a rep deal/account. Do: open it. Assert: an **AI next best action** card shows a
   grounded suggestion (`nextBestAction`); with no key it shows the deterministic suggestion labelled `modelUsed:false`.
8. **Discount approval round-trip.** Pre: rep offer with a discount + justification. Do: submit. Assert: **SM and
   Finance are both notified** (in-app), the offer flows SM → (discount>10%) → Finance, both approve, offer becomes
   **approved & locked**; justification was required to submit.

**Eval mechanics (build this):**
- Encode the eight as a checklist doc the demo-runner ticks, AND — preferred — a **Playwright** smoke suite under
  `crm/e2e/` that drives the deployed app (or `next dev`) through 1–8 with the assertions above. Keep it resilient to
  seed-data IDs (select by role view + first matching card, not hardcoded UUIDs).
- The suite must run **green with no AI keys** (deterministic fallbacks). Any step that *requires* a key (none of
  §07 strictly do) must assert the honest `modelUsed:false` state, not a fabricated one.
- Add an `npm run eval` script (or document the exact command). Report pass/fail per scenario.

## 5. How to run + verify
- App lives in `crm/`. `npm install`, then `npm run dev` (local) or hit production `https://web-teal-xi-17.vercel.app`.
- Roles: AppShell "View as" switcher. Seed: `node crm/seed/generate.mjs` (check its header for required env).
- Before claiming done: `npx tsc --noEmit` + `npm run build` both green, AND the §4 eval suite green with no keys.
  Then `vercel deploy --prod --yes` from `crm/` (see `[[vercel-deploy]]` memory).
- **Heads-up:** a codex stop-time hook auto-commits each turn with AI-generated messages — don't be alarmed by
  commits you didn't author; verify with `git show` before assuming a collision.

## 6. Guardrails / out of scope (from the brief)
No customer-facing portal, no mobile, no live 3rd-party API integration, no bulk Excel **import** (export only), no
multi-language, no custom BI/report-builder. Stay grounded; never write without approval; keep EU-residency (only
public name/domain ever leaves the app for any web call).
