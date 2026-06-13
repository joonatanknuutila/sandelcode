# Forecast logic + pricing/catalog decisions (Nuutti)

Decisions for the Finance forecast view, offer builder, and pricing catalog.
Derived from the HMD interview (Sales hackathon → meeting notes) + brief §2.1–2.3.
Anything marked **[ASSUMPTION]** is ours until HMD confirms — flagged on-screen too.

## What HMD actually said (interview, 2026-06-13)
- Finance does **not** want a BI dashboard. They want, per opportunity: the
  **value bracket** (e.g. "~10k-device customer"), **what stage it's at**, and a
  **realistic, judgment-adjusted number** they can plan component purchases against.
- The forecast **drives hardware/component buying**. "Rubber hits asphalt": software
  can ship in an hour, **hardware must be ordered ahead**. So near-term **device units
  per quarter** matter as much as €.
- Horizon precision is graded: **0–6 months must be accurate** (no fluff), 1y+ looser.
- They want a **confidence score per opportunity + the reasoning behind it**, and the
  ability for Finance to **manually adjust** the realistic number and **ping the account
  manager** ("big opportunity but only 100 units forecast — why?").
- Offer creation is **intensive & customised** (weeks), SM + Finance both pulled in;
  legal happens outside the CRM. Discounts route **Rep → SM → Finance**.

## Where the "no advanced BI" line is (answers Q2)
Build: weighted € + device-units, **time-phased by quarter**, split **device vs service**,
**committed / at-risk / gap-to-target**, per-opportunity confidence + reasoning, manual
Finance override. Do **not** build: pivot builders, custom chart designer, cohort/funnel
analytics, ad-hoc query UI. One opinionated view, not a toolkit.

## Forecast computation
- **Weighted revenue** per period = `Σ (device_revenue + service_revenue) × winProb(stage)`,
  kept **device/service separate** (brief 2.2). Lost deals = 0.
- **Win probability by stage** [ASSUMPTION — Aarni's SCHEMA.md default; confirm with HMD]:
  `interest 10% · rfi 25% · rfp 40% · customer_test 60% · contract_negotiation 80% · won 100% · lost 0%`.
- **Committed** = revenue from stages with winProb ≥ 80% (contract_negotiation, won), **un-weighted**
  (treated as bankable for component planning). **At-risk** = weighted revenue from stages 40–60%.
  **Upside** = weighted revenue from stages < 40%.
- **Gap-to-target** = `target − committed` for the selected horizon. Target is a Finance input
  [ASSUMPTION default values per year until HMD gives real targets].
- **Confidence score** per opportunity = stage winProb, **±** Finance manual adjustment, with a
  generated **reasoning** string (stage, days since last activity, channel, expected close).
  Finance can override the realistic € — override is what feeds gap-to-target.
- **Device units per quarter** surfaced prominently (component lead-time planning).

## Pricing catalog (answers Q-pricing)
- Finance maintains **products** (`list_price_eur`, active) and **services**
  (`unit_price_eur`, `invoicing_model`) directly in-app — add / edit price / retire (set
  `active=false`), no developer. This is the catalog editor page.
- **Discount slider** on the offer builder shows offer price live as the slider moves.
- **Discount approval thresholds** [ASSUMPTION — confirm with HMD]:
  `0% → none · ≤10% → SM only · >10% → SM then Finance`. Justification required above 0%.
  Offer locks (`approved`) once both required approvals land.
- Service invoicing models priced per brief 2.2: `one_off` (point of delivery),
  `fixed_term` (1–5y, spread over term), `monthly_recurring` (per active device × months).

## Still blocked on HMD (chase in Discord / next interview)
1. Real **win-probability %** per stage (we're using assumptions above).
2. Real **discount thresholds** for SM-only vs Finance second approval.
3. **Targets** per quarter/year for gap-to-target.
4. Does the 3-yr device curve get **derived from the pilot** by a multiplier, or does the
   rep enter expected units per quarter by hand? (Seed currently has explicit per-quarter rows.)
5. Direct vs reseller **split** for realistic seed weighting.
