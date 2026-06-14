# HMD Secure CRM — 5-minute demo script

Maps the brief's §07 "what good looks like" to exact clicks. Switch roles with
the **"View as"** switcher in the top bar. Seed data is realistic (8 accounts,
10 deals across 3 years, 6 cases, offers mid-approval).

> The app runs fully **without any AI keys**: every AI surface falls back to a
> deterministic, grounded result and labels itself *"model offline"*. On prod
> (Vercel) that fallback is what you see; locally with Gemini ADC the same cards
> are model-phrased. Either way the **facts come from the DB, never the model**.

## The walkthrough

1. **Rep — account 360.** `View as Rep` → **My customers** → open any account
   (e.g. *Bundesdruckerei*). Open **deals** and active **support tickets** show
   together with the **history** timeline on one screen.
2. **Rep — create a deal.** On the account → **+ New deal**. Mark **Direct**,
   pick a real HMD stage (reseller hides *Contract negotiation*), set an expected
   close. Save → you land on the new deal, where you enter the **3-year, phased
   forecast** (device vs service revenue kept separate). Survives refresh.
3. **Rep — build an offer.** From a deal → **Build & send offer** → add devices
   + services from the **catalog**; the total computes from catalog prices. Apply
   a discount **>10%** + justification (required) → submit.
4. **TAM — work a case.** `View as TAM` → top of the triaged queue → open a case.
   Read the **service history**, add a **note** (timestamped + attributed), and
   resolve it. SLA/age update. Cases with **5+ notes** show an AI thread summary.
5. **Manager — risk + pipeline.** `View as Sales Manager`. Immediately see the
   **at-risk list** (idle 14d+ or past close), the **3-yr weighted pipeline**,
   the gap-to-target band, and the **AI pipeline-health** narrative — no drilling.
6. **Finance — the forecast.** `View as Finance`. The **time-phased forecast by
   quarter over 3 years** is right there, weighted by stage, device vs service
   split, with **Export CSV** and the **AI forecast narrative**.
7. **AI next best action.** Back as Rep → open any deal: the **"What to do next"**
   card gives a grounded suggestion from the deal's timeline + stage.
8. **Discount approval round-trip.** The offer from step 3 appears under
   **Needs your approval** for the **Sales Manager**; approve → it escalates to
   **Finance** (because discount >10%) → approve → offer becomes **approved &
   locked**. Both were notified in-app.

## AI agents to show off

- **Conversational query** (Manager / Finance dashboards → *"Ask about the
  pipeline"*): try the chips — *"At-risk deals in DACH"*, *"Which enterprise
  deals are at risk?"*, *"Biggest open deals"*. Region (DACH/Nordics) + industry
  + risk filtering; the facts are pre-filtered so it never invents a non-matching
  deal.
- **Meeting → CRM** (TAM → AI workspace): paste meeting notes / an inbound email
  → it proposes records → you approve → it writes. Decline writes nothing.
- **Account enrichment** (Rep → account → enrich): public name/domain only;
  defense/government accounts are opt-in.

## Notes for judges

- Platform is **Supabase (EU, eu-north-1)**; the brief's Azure/Entra + Microsoft
  Graph items are wired as a clean, honest **deferred seam** (`lib/integrations/
  graph.ts`) — the Outlook "book follow-up" is a disabled, labelled placeholder;
  email-to-case is demonstrated via the human-approved meeting→CRM stand-in.
- Acceptance suite: `npm run eval` (Playwright, green with no AI keys).
