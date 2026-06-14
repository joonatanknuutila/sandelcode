# Rep UI Rebuild — Plan & Infra Reconciliation

Source: external spec "HMD Secure CRM — Sales Rep UI Rebuild Spec".
Goal: make the Rep experience action-first ("what do I do now, in one gesture?"),
capture the easiest thing in the product. Layout/ordering/naming/capture redesign
only — NO data-model or backend rebuild.

## Infra reconciliation (spec → what already exists)

ALREADY SATISFIED (keep, light polish):
- §2 Accounts List default + Kanban toggle → `app/rep/accounts/AccountsWorkspace.tsx` ✓
- §7 New account modal: 2-col + "Determine fields" (`parseLeadAction`) ✓
- §8 New deal modal: channel + follow-on + `type="date"` picker ✓
- §6 Spar backbone EXISTS: `lib/ai/meeting.ts` (draftFromTranscript/commitMeeting) +
  `/api/meeting/draft` + `/api/meeting/commit` + `MeetingCapture.tsx` (TAM). Reuse for Add note.
- §11 keep-list (forecast grid, build offer, fetch background, follow-on linkage) ✓
- confidence() rule engine exists: `lib/ai/confidence.ts`, `/api/confidence`.

KEY CONSTRAINTS:
- Next.js 16.2.9 / React 19. `params` is a Promise. Read `node_modules/next/dist/docs/`
  before novel Next APIs (per crm/AGENTS.md).
- `AccountDetailView.tsx` is SHARED across rep/sm/tam/finance via `plain` flag.
  Do NOT restructure it in place for §3 — build a rep-only workspace instead.
- Demo data lives in LIVE Supabase (hand-expanded), not only `seed/generate.mjs`.
  §0.4 junk ("ajkeshkaj","test") + impossible stage history must be fixed in the live DB.
- Stop-gate auto-commits each turn → keep build green at every wave boundary.
- Deploy: `vercel deploy --prod --yes` from repo root (project `web`, root `crm/`).

## Waves

### Wave 1 — Global vocabulary + confidence + assistant (§0.1–0.3)
- [ ] `components/ConfidenceMeter.tsx` (client): "Confidence" % + bar, band colour. + helper to derive.
- [ ] Rename everywhere: "Log activity"/"Log a discovery call"/"Add contact point" → **Add note**;
      "Build & send offer" → **Build offer**; messaging → **Message team**.
- [ ] Replace confidence wording: "Likely to land"/"Likely value"/"Chance: H/M/L"/"Win probability X%"
      → **Confidence** (% + bar) and euro → **Weighted value**.
- [ ] Remove `<Assistant>` from `app/rep/page.tsx` (center box).
- [ ] AgentDock: FAB static (remove `animate-ping`); nudge ONCE per session + dashboard-only
      (sessionStorage flag + pathname check).

### Wave 2 — Add note / Spar capture (§6) — the core
- [ ] `components/AddNote.tsx` (client): one field, two buttons — **Save** (zero-friction,
      logActivity) and **Spar & structure** (reuse /api/meeting/draft → review card → confirm →
      /api/meeting/commit). Accepts {accountId, dealId?}. Defense: typed input only (no transcription claim).
- [ ] Server action `addNoteAction` (quick Save path) → logActivity to timeline.
- [ ] Mount on dashboard (anchor), account detail (top), deal view.

### Wave 3 — Dashboard rebuild (§1)
- [ ] Reorder `app/rep/page.tsx`: (1) Add-note anchor, (2) rich **Needs your attention**
      (deals quiet 14d+, resolved approvals, cases threatening stage-4+ deals, offers past expected
      response, close dates approaching, inbox needing reply), (3) **Today's next steps** (NBA per deal),
      (4) Pipeline snapshot (keep), (5) metrics demoted to thin strip.
- [ ] Remove giant "See my customers" → normal link.
- [ ] Build `lib/rep/attention.ts` to compute the attention list on view-open.

### Wave 4 — Account detail rep workspace (§3)
- [ ] New `app/rep/accounts/[id]` layout (rep-only) OR `RepAccountWorkspace.tsx`: main col =
      Add note (top) + large timeline; side col = basics, people, deals (compact, links), cases.
- [ ] Action bar reorder: Add note · Message team (primary); New deal · Open service case (secondary);
      Fetch background demoted (small/tertiary). Remove inline "Add deal" field (editable=false).

### Wave 5 — Deal view polish (§4) + Build offer (§5)
- [ ] Rename buttons (done globally W1); add ConfidenceMeter + "Why?" on deal page.
- [ ] OfferBuilder: quiet empty state instead of €0/€0 band until a line item exists.

### Wave 6 — Inbox states (§9)
- [ ] read/unread, needs-reply marker, New message action, priority ordering.

### Wave 7 — Data + error boundary (§0.4)
- [ ] `app/rep/error.tsx` (and/or global) error boundary — no raw server-error banner.
- [ ] Fix `seed/generate.mjs` random-deal stage history (forward order only).
- [ ] Clean live DB: remove junk activities, repair impossible stage sequences (Supabase MCP, careful).

### Wave 8 — Verify + deploy
- [ ] `npm run build` green, lint, Playwright smoke if feasible.
- [ ] `vercel deploy --prod --yes`; verify prod alias.

## Acceptance (§12) — track against final
new rep can: see add-note on dashboard; tap an attention row into action; account timeline
centre w/ add-note on top; spar a note (paste → AI asks → confirm → timeline); message team w/
context; deal 3yr forecast + next step + single Confidence; build+send offer; never see blink/
following popup/error banner/impossible history.
