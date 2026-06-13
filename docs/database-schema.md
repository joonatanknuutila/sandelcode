# HMD Sales Hackathon — Database Schema

Supabase project: `xwsmovmtfymiqvgjicfk` · region: `eu-north-1`
All tables are in the `public` schema with RLS enabled.

> Reconstructed from the live database (enums + columns verified 2026-06-13).

---

## Enums

| Enum | Values |
|---|---|
| `user_role` | `rep`, `tam`, `sales_manager`, `finance` |
| `deal_stage` | `interest_shown`, `rfi_answered`, `rfp_offer_given`, `customer_test`, `contract_negotiation`, `won`, `lost` |
| `deal_channel` | `direct`, `reseller` |
| `case_status` | `open`, `in_progress`, `escalated`, `resolved`, `closed` |
| `case_priority` | `low`, `medium`, `high`, `critical` |
| `case_type` | `complaint`, `request`, `incident`, `inquiry` |
| `service_type` | `internal`, `third_party` |
| `invoicing_model` | `one_off`, `fixed_term`, `monthly_recurring` |
| `offer_status` | `draft`, `pending_sm_approval`, `pending_finance_approval`, `approved`, `rejected`, `locked`, `sent` |
| `approval_role` | `sales_manager`, `finance` |
| `approval_status` | `pending`, `approved`, `rejected` |
| `note_entity_type` | `deal`, `case`, `account` |
| `activity_entity_type` | `deal`, `case`, `offer`, `contact`, `account`, `note` |
| `notification_entity_type` | `deal`, `case`, `offer`, `account` |

---

## Tables

### `profiles`
Maps 1:1 to `auth.users`. Holds the user's CRM identity + role.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | FK → `auth.users.id` |
| `full_name` | `text` | |
| `email` | `text` | |
| `role` | `user_role` | default `rep` |
| `avatar_url` | `text` | nullable |
| `created_at` | `timestamptz` | default `now()` |
| `updated_at` | `timestamptz` | default `now()` |

---

### `accounts`
Top-level CRM entity. Every deal, case, contact, and timeline event anchors here.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `name` | `text` | |
| `industry` | `text` | nullable |
| `country` | `text` | nullable |
| `website` | `text` | nullable |
| `phone` | `text` | nullable |
| `address` | `text` | nullable |
| `assigned_rep_id` | `uuid` | nullable FK → `profiles.id` |
| `assigned_tam_id` | `uuid` | nullable FK → `profiles.id` |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

---

### `contacts`
People at a customer account.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `account_id` | `uuid` | FK → `accounts.id` |
| `first_name` | `text` | |
| `last_name` | `text` | |
| `email` | `text` | nullable |
| `phone` | `text` | nullable |
| `job_title` | `text` | nullable |
| `is_primary` | `bool` | default `false` |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

---

### `products`
Device product catalog. Finance-managed (add / update / retire without a developer).

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `name` | `text` | |
| `description` | `text` | nullable |
| `sku` | `text` | nullable, unique |
| `unit_price` | `numeric` | |
| `currency` | `text` | default `EUR` |
| `category` | `text` | nullable |
| `is_active` | `bool` | default `true`; set `false` to retire |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

---

### `services`
Service catalog. Supports three invoicing models.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `name` | `text` | |
| `description` | `text` | nullable |
| `service_type` | `service_type` | `internal` or `third_party` |
| `invoicing_model` | `invoicing_model` | `one_off`, `fixed_term`, or `monthly_recurring` |
| `base_price` | `numeric` | nullable; used for `one_off` and `fixed_term` |
| `currency` | `text` | default `EUR` |
| `term_years` | `int` | nullable; 1–5, used for `fixed_term` |
| `monthly_rate` | `numeric` | nullable; used for `monthly_recurring` |
| `is_active` | `bool` | default `true` |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

---

### `deals`
Core sales pipeline entity. One deal per opportunity.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `account_id` | `uuid` | FK → `accounts.id` |
| `parent_deal_id` | `uuid` | nullable FK → `deals.id`; links follow-on orders to the original opportunity (brief §2.1) |
| `title` | `text` | |
| `owner_id` | `uuid` | nullable FK → `profiles.id` (Sales Rep) |
| `channel` | `deal_channel` | `direct` or `reseller` |
| `stage` | `deal_stage` | default `interest_shown` |
| `expected_close_date` | `date` | nullable |
| `device_unit_price` | `numeric` | nullable; override price at deal level |
| `win_probability` | `int` | NOT NULL; stage-based default applied on insert |
| `lost_reason` | `text` | nullable |
| `last_activity_at` | `timestamptz` | 14-day stall detection |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

**Stage → default win probability** (Finance's weighted forecast uses this):

| Stage | win_probability |
|---|---|
| `interest_shown` | 10 |
| `rfi_answered` | 25 |
| `rfp_offer_given` | 40 |
| `customer_test` | 60 |
| `contract_negotiation` | 80 |
| `won` | 100 |
| `lost` | 0 |

(These are the values seeded in the live DB and the fallback curve in `crm/lib/types.ts`
`STAGE_PROBABILITY`; per-deal `win_probability` overrides the stage default.)

**Reseller constraint:** `contract_negotiation` is skipped when `channel = 'reseller'` —
enforce in frontend routing/validation, not the DB.

---

### `deal_forecast_phases`
Time-phased device and service revenue for a deal. Each row = one time bucket (e.g. a
quarter). A 3-year deal typically has ~12 rows.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `deal_id` | `uuid` | FK → `deals.id` |
| `period_start` | `date` | first day of the period |
| `period_label` | `text` | display label (e.g. `2026-Q3`) |
| `device_units` | `int` | default `0` |
| `device_unit_price` | `numeric` | nullable; falls back to `deals.device_unit_price` |
| `service_revenue` | `numeric` | default `0`; kept separate from device revenue per brief |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | auto-updated via trigger |

**Weighted forecast formula:**
`weighted_device_value = device_units × device_unit_price × (win_probability / 100)`
`weighted_service_value = service_revenue × (win_probability / 100)`
(join `deals` for `win_probability`)

---

### `cases`
Support and service cases. TAMs own cases; cases link to a service and optionally a contact.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `account_id` | `uuid` | FK → `accounts.id` |
| `contact_id` | `uuid` | nullable FK → `contacts.id` |
| `service_id` | `uuid` | nullable FK → `services.id` |
| `assigned_tam_id` | `uuid` | nullable FK → `profiles.id` |
| `title` | `text` | |
| `description` | `text` | nullable |
| `case_type` | `case_type` | default `complaint`; also incidents, requests, inquiries |
| `status` | `case_status` | default `open` |
| `priority` | `case_priority` | default `medium` |
| `is_escalated_to_third_party` | `bool` | default `false` |
| `third_party_reference` | `text` | nullable; ticket ref at the 3rd party |
| `sla_due_date` | `timestamptz` | nullable; used for SLA tracking |
| `resolved_at` | `timestamptz` | nullable |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

---

### `notes`
Polymorphic timestamped notes on deals, cases, or accounts. Visible to all roles with
access unless `is_internal = true`.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `entity_type` | `note_entity_type` | `deal`, `case`, or `account` |
| `entity_id` | `uuid` | ID of the target record |
| `author_id` | `uuid` | nullable FK → `profiles.id` |
| `content` | `text` | |
| `is_internal` | `bool` | default `false`; internal notes visible only to internal roles |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

---

### `offers`
Versioned offers built from the product/service catalog for an account + deal.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `account_id` | `uuid` | FK → `accounts.id` |
| `deal_id` | `uuid` | nullable FK → `deals.id` |
| `title` | `text` | |
| `version` | `int` | default `1`; increment per revision |
| `status` | `offer_status` | default `draft` |
| `discount_pct` | `numeric` | default `0`; justification required when > 0 |
| `discount_justification` | `text` | nullable; required when a discount is applied |
| `total_list_value` | `numeric` | nullable; computed and stored |
| `total_discounted_value` | `numeric` | nullable; computed and stored |
| `created_by` | `uuid` | nullable FK → `profiles.id` |
| `locked_at` | `timestamptz` | nullable; set when status → `locked` after full approval |
| `created_at` | `timestamptz` | |
| `updated_at` | `timestamptz` | |

**Approval flow:** `draft` → `pending_sm_approval` → `pending_finance_approval` →
`approved` → `locked`. A rejection at either step sets status to `rejected` and the offer
must not be mutated.

---

### `offer_line_items`
Individual line items in an offer — either a product or a service.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `offer_id` | `uuid` | FK → `offers.id` |
| `item_type` | `text` | check: `product` or `service` |
| `product_id` | `uuid` | nullable FK → `products.id` |
| `service_id` | `uuid` | nullable FK → `services.id` |
| `description` | `text` | display label |
| `quantity` | `int` | default `1` |
| `unit_price` | `numeric` | |
| `discount_pct` | `numeric` | default `0`; line-level discount |
| `invoicing_model` | `invoicing_model` | nullable; service invoicing, if applicable |
| `term_years` | `int` | nullable; for `fixed_term` services |
| `created_at` | `timestamptz` | |

---

### `offer_approvals`
One row per approval step (SM, then Finance). Created when an offer enters the approval workflow.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `offer_id` | `uuid` | FK → `offers.id` |
| `approver_id` | `uuid` | nullable FK → `profiles.id` |
| `approval_role` | `approval_role` | `sales_manager` or `finance` |
| `status` | `approval_status` | default `pending` |
| `comment` | `text` | nullable; rejection reason / note |
| `created_at` | `timestamptz` | |
| `resolved_at` | `timestamptz` | nullable; set when approved/rejected |

---

### `activity_timeline`
Append-only event log scoped to an account. Surfaces on the account timeline for all roles.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `account_id` | `uuid` | FK → `accounts.id` |
| `actor_id` | `uuid` | nullable FK → `profiles.id` |
| `event_type` | `text` | free-form string (e.g. `deal_created`, `stage_changed`, `case_opened`, `note_added`) |
| `entity_type` | `activity_entity_type` | nullable; which kind of record this event is about |
| `entity_id` | `uuid` | nullable; ID of the related record |
| `title` | `text` | one-line summary shown in timeline |
| `body` | `text` | nullable; extended detail |
| `metadata` | `jsonb` | nullable; arbitrary key-value for before/after diffs etc. |
| `created_at` | `timestamptz` | |

Records are never updated or deleted — append-only.

---

### `notifications`
Per-user in-app notifications. Deep-link to the relevant record.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` | FK → `profiles.id` |
| `title` | `text` | |
| `body` | `text` | nullable |
| `entity_type` | `notification_entity_type` | nullable |
| `entity_id` | `uuid` | nullable; jump-to target |
| `is_read` | `bool` | default `false` |
| `created_at` | `timestamptz` | |
| `read_at` | `timestamptz` | nullable |

---

## Key relationships (abbreviated)

```
profiles
  │  (assigned_rep_id / assigned_tam_id / owner_id / author_id / actor_id / approver_id / user_id)
  │
accounts ──── contacts            (FK account_id)
  │
  ├── deals ──────────── deal_forecast_phases   (FK deal_id)
  │     │
  │     └── offers ──── offer_line_items ──── products / services
  │               └──── offer_approvals
  │
  ├── cases ──── notes (entity_type = case)     · cases → services, contacts
  │
  ├── notes (entity_type = account / deal)
  │
  └── activity_timeline

notifications ──── profiles (user_id)
```

---

## Business rules encoded in schema

1. **Reseller deals skip `contract_negotiation`** — enforced in frontend; the DB stores all stages in the enum.
2. **Discount ≥ 1% triggers two-step approval** — `offer_approvals` rows must be created for both `sales_manager` and `finance`; the offer is `locked` only after both resolve to `approved`.
3. **Locked offers are immutable** — `locked_at` is the signal; enforce via RLS policy or API middleware.
4. **`win_probability` drives the weighted forecast** (default 10). Stage-based defaults applied on insert; the Finance view multiplies `deal_forecast_phases` values by `win_probability / 100`.
5. **Service revenue shown separately** — `service_revenue` is never summed with device revenue in the same column.
6. **Follow-on order linkage** — `deals.parent_deal_id` ties follow-on orders into a fleet rollout; query `WHERE parent_deal_id = :id` to find all follow-on orders.
7. **Deal staleness** — `deals.last_activity_at` updates on any meaningful event; frontend flags deals where `now() - last_activity_at > 14 days`.
