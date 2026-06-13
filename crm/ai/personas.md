# Per-persona AI assistant — design + concrete hints

This answers the "concrete useful AI hint per persona" question (Kysymykset HMD:lle) **and** tells Joonatan/Nuutti where each agent surfaces in the UI. Every assistant is **grounded** (reads only that account's records via Arttu's API) and **never writes silently** — writes go through a draft → 3–5 follow-up Qs → approve gate.

## Sales Rep — "keep my deals moving"
- **Surface:** chat box on the account view + a "Next best action" card on the deal.
- **Scope:** their own accounts/deals only. Tone: brisk, action-oriented.
- **Concrete hint:** *"Bundesdruckerei has been in `customer_test` for 23 days with no activity in 18. Two similar deals that stalled here were lost to incumbent. Suggested next step: send the pilot success summary and propose a contract-negotiation date. [Draft email]"*
- Powers: status of deal X, next best action, draft email, "what changed since I last looked".

## Technical Account Manager — "no surprises on cases"
- **Surface:** chat box on the account + case list; case-summary button when a case has 5+ notes.
- **Scope:** accounts they're TAM for; case/service history. Tone: precise, technical.
- **Concrete hint:** *"3 open cases on Maersk, 1 urgent and 6h from SLA breach (SOC escalation, 3rd-party). The OS-update case shares the S30 batch with last month's resolved ticket #4471 — same fix likely applies."*
- Powers: summarize case thread, surface SLA risk, link recurring/related cases, draft customer-side update.

## Sales Manager — "where's the team's pipeline"
- **Surface:** chat box on the team dashboard.
- **Scope:** all reps' deals. Tone: concise, exec.
- **Concrete hint:** *"4 deals worth €2.1M haven't moved in 14+ days — 3 are Camille's in `rfp`. Quarter gap-to-target is €380k; closing the Vattenfall deal (80% weighted) covers it. Reassign the stalled Thales reseller deal?"*
- Powers: stalled-deal triage, gap-to-target, reassignment suggestions, per-rep close-rate.

## Finance — "give me the forecast, plainly"
- **Surface:** chat box + the forecast-narrative banner on the Finance view.
- **Scope:** read-only, aggregate pipeline + weighted forecast. Tone: neutral, numeric, cautious.
- **Concrete hint (forecast narrative):** *"Weighted 3-yr pipeline: €14.2M (device €9.1M / service €5.1M, kept separate). Next quarter committed €1.3M, at-risk €0.6M (two `rfp` deals past expected close). Service revenue is back-loaded — 70% from monthly-recurring on devices not yet shipped, so it's volume-dependent."*
- Powers: forecast narrative, committed/at-risk/gap split, "why did the number change".

## Cross-cutting: Meeting → CRM (capture)
- **Surface:** "Log a meeting" button on any account → paste transcript/notes.
- **Flow:** agent drafts the card update (stage move, new contact, forecast tweak, follow-up) → asks **3–5 targeted follow-up questions** ("Did they commit to a pilot size?", "Who owns the security sign-off?") → shows a diff → **user approves** → POST via Arttu's API. No write without approval.
