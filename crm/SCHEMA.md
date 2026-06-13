# HMD Secure CRM — Data Model (proposal v0.1)

Owner: Aarni (seed data + AI). **Arttu: this is a starting point — push back / adjust and I'll regenerate seed to match.** Target DB: **Supabase Postgres** (EU region). Schema + seed applied via migrations; RLS enabled on all tables.

Stages (deal pipeline): `interest → rfi → rfp → customer_test → contract_negotiation → won/lost`.
`contract_negotiation` is **direct-only**; reseller deals go `customer_test → won/lost`.

Default win-probability per stage (used for weighted forecast until HMD gives us real numbers — flagged as assumption):

| stage | interest | rfi | rfp | customer_test | contract_negotiation | won | lost |
|---|---|---|---|---|---|---|---|
| win % | 10 | 25 | 40 | 60 | 80 | 100 | 0 |

## Entities

- **users** `(id, name, email, role)` — role ∈ rep | tam | sales_manager | finance
- **accounts** `(id, name, domain, country, sector, channel, owner_rep_id→users, tam_id→users, created_at)` — sector ∈ government | enterprise; channel ∈ direct | reseller; country = EU only
- **contacts** `(id, account_id, name, title, email, phone, is_primary)`
- **products** `(id, sku, name, category, list_price_eur, active)` — category ∈ device | accessory
- **services** `(id, sku, name, type, invoicing_model, unit_price_eur, active)` — type ∈ internal | third_party; invoicing_model ∈ one_off | fixed_term | monthly_recurring
- **deals** `(id, account_id, name, channel, stage, owner_rep_id, currency, total_value_3yr_eur, expected_close, created_at, last_activity_at, lost_reason)`
- **deal_forecast** `(id, deal_id, period, device_units, device_revenue_eur, service_revenue_eur)` — period = `YYYY-Qn`, time-phased over ~3 years; device vs service kept **separate** (brief 2.2)
- **offers** `(id, deal_id, account_id, version, status, discount_pct, justification, total_eur, created_by, created_at)` — status ∈ draft | pending_sm | pending_finance | approved | rejected
- **offer_lines** `(id, offer_id, product_id, service_id, qty, unit_price_eur, discount_pct, line_total_eur)` (exactly one of product_id/service_id set)
- **approvals** `(id, offer_id, approver_role, approver_id, decision, comment, decided_at)` — approver_role ∈ sales_manager | finance; decision ∈ approved | rejected
- **cases** `(id, account_id, service_id, title, type, status, priority, tam_id, customer_contact_id, sla_due_at, escalated_to_3p, created_at, resolved_at)` — type ∈ complaint | request; status ∈ open | in_progress | escalated | resolved | closed; priority ∈ low | medium | high | urgent
- **case_notes** `(id, case_id, author_id, body, kind, created_at)` — kind ∈ internal_sales | tech_working
- **activities** `(id, account_id, deal_id?, case_id?, type, body, actor_id, created_at)` — the account **timeline**; type ∈ call | email | meeting | note | stage_change | offer | system
- **notifications** `(id, user_id, type, body, link_kind, link_id, read, created_at)` — **in-app only**

## Notes for the AI layer (my consumers)
- Per-persona assistant grounds answers on: account + its deals + deal_forecast + cases + activities.
- Meeting→CRM writes go through Arttu's API with a **human-approval gate** (draft → 3–5 follow-up Qs → confirm → POST).
- Forecast narrative reads weighted `deal_forecast` (units × win% per period) split device/service.
