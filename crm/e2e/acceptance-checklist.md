# Acceptance / demo checklist — "What good looks like" (brief §07)

**The bar:** a brand-new user with **no training** walks each journey start to
finish and never hits a dead-end or an empty screen. That only holds when the
**seed data is realistic** — an empty (or thin) database fails the demo no matter
how correct the code is. So the automated suite (`e2e/acceptance.spec.ts`) asserts
the **good, populated outcome** of each journey (real deals + cases on a view, an
actual overdue deal in the risk list, both approval gates live), not merely that a
heading or button exists. Roles switch via the AppShell **"View as"** switcher
(auth is stubbed); the suite drives the same role views by URL.

## How to run

```bash
cd crm
npm install && npm run eval:install   # first time
npm run eval                          # runs against prod (web-teal-xi-17.vercel.app)
EVAL_BASE_URL=http://localhost:3000 npm run eval   # against a local dev server
EVAL_MUTATE=1 npm run eval            # also drives the create/approve write round-trips
```

`npm run eval` is non-destructive: it asserts each journey's populated outcome
without writing shared data. `EVAL_MUTATE=1` additionally exercises create-deal,
add-note and approve. Selectors tolerate both the internal and the rep-facing
"plain language" copy, so the in-flight plain refactor doesn't break them.

## The eight journeys (what the suite asserts)

| # | Journey (no training, no getting stuck) | Assert — the GOOD, populated outcome | ✓ |
|---|------------------------------------------|--------------------------------------|---|
| 1 | Rep finds an account → open deals + active cases together | Seeks an account with BOTH; asserts ≥1 real deal **and** a non-empty cases section + the timeline | ☐ |
| 2 | Rep creates a deal (direct, stage, close, forecast) | Modal exposes channel/stage/close; `EVAL_MUTATE` creates it and confirms it survives a reload | ☐ |
| 3 | Rep opens the catalog, picks items, generates an offer | Offer builder loads the **catalog picker** + "Add items"; total computes from catalog prices | ☐ |
| 4 | TAM reads a case's history, adds a note, closes it | Case shows the unified history + note composer + SLA; `EVAL_MUTATE` posts a note | ☐ |
| 5 | Manager sees overdue deals + 3-yr weighted pipeline | "At risk — needs intervention" shows an **actual `past close` deal**; weighted pipeline visible | ☐ |
| 6 | Finance sees the time-phased 3-yr forecast | "Time-phased forecast" with **Y1 Q1 … Y3 Q4** quarters, weighted — no asking sales | ☐ |
| 7 | Rep opens a deal → AI next best action | The next-best-action card renders with a **grounded suggestion** (headline + detail) | ☐ |
| 8 | Discount + justification → SM and Finance both approve | **Both** the SM and Finance approval gates are live, with the justification shown + Approve | ☐ |

## P2 feature smoke (also asserted)

| Feature | Check | ✓ |
|---------|-------|---|
| Excel/CSV export | `/api/export/pipeline` + `/api/export/cases` return `text/csv` attachments with real rows; Reports view shows the export links | ☐ |
| AI forecast narrative on Finance | `/finance` shows a **Forecast narrative** card | ☐ |
| Model-backed case summary (≥5 notes) | A case with 5+ notes surfaces the **Thread summary** paragraph (deterministic fallback when no key) | ☐ |
| Graph seam (honest defer) | Case detail shows **+ Paste an inbound email** (reuses the approval gate) and a disabled **Book follow-up** (Azure/Graph) | ☐ |

## Data note — how the live demo was made "realistic"

The live demo DB (Supabase) is loaded by a process that is **not in this repo**
(it remaps the seed to UUIDs + the DB enums). Rather than a risky full reseed,
two confirmed gaps were closed with small **reversible** patches on the live DB:

- **Overdue deals (journey 5):** 3 open deals' `expected_close_date` set to the
  past (originals: Bundesdruckerei `2026-09-30`, Finnish Defence `2026-10-15`,
  Maersk `2026-10-30`). Live `overdue_open_deals` went 0 → 3.
- **Case summary (P2):** 4 grounded notes added to the in-progress case "MDM
  enrolment failing on S30 batch" so it has 5 notes and the thread summary fires.

`seed/generate.mjs` was also updated so a **fresh** seed produces these (overdue
deals, a pending-SM expansion offer on the hero account, a 5-note hero case) —
that is the permanent fix once the DB is reseeded via the original loader.
