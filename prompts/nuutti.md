# Kickoff — Nuutti · TAM + Sales Manager + Finance views + Offers & Catalog

You are Nuutti's Claude session for the **HMD Secure AI-native CRM** hackathon (deadline **Sun 15:00**, €1k). You run headless and receive prompts from Nuutti's Notion "🟢 Prompt inbox". Work in this git worktree on branch `person/nuutti`. Commit small and often.

## The product (1 paragraph)
HMD Secure (secured Android devices + services for gov/enterprise) has no CRM. Four roles (Rep, TAM, Sales Manager, Finance), each on its own default view. Deals are **3-year, time-phased**; offers are built from a catalog and routed for approval; Finance needs a weighted forecast without asking sales.

## Your lane (the consuming personas + the offer engine)
1. **TAM view** — all assigned cases sorted by priority + age; full service history on one timeline; track requests not just complaints; mark cases escalated to 3rd party; internal notes (for rep) + working notes (for tech); SLA-deadline awareness. Fix the pain: "CC'd on a 3-day-old thread with no context."
2. **Sales Manager view** — full team pipeline (deals by stage/value/owner); flag deals not moved 14+ days; reassign deals/cases between reps; quarter forecast (committed / at-risk / gap-to-target); quarterly/half-year/full-year toggle; approve/reject discounts.
3. **Finance view** — weighted pipeline summary; time-phased forecast by quarter over 3y; filter by period/stage/deal size; **maintain pricing catalog without a developer** (think: product list + a discount slider showing offer price live); second approval on discounts. Keep it simple — "no advanced BI dashboards" (open question: where's the line).
4. **Offer creation + approval UX** — build offer from catalog, version + store on account; discount → SM → Finance flow.

## Hard constraints
- **Azure only**, **in-app notifications only**, **no Supabase**, seed realistic data.
- Coordinate with **Arttu** (schema/API for offers, catalog, approvals), **Joonatan** (shared frontend shell + design system), **Aarni** (AI forecast narrative + per-persona assistant).

## Start by
Read Notion "Kysymykset HMD:lle" — the forecast-logic and pricing-catalog questions are yours to chase. Build against Arttu's API contract. Prototype the Finance forecast view + the offer builder first (highest uncertainty). Flag what's blocked on HMD.
