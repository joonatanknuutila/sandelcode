# Build HMD's AI-native CRM — Challenge Brief

> **HMD × Prompt · Sales Hackathon 2026 · HMD Secure**
> Source (Notion): https://app.notion.com/p/37ea330fb64980df8c0bee888f16e2a6
> Full PDF: https://prompthack.aaltoes.com/briefs/hmd-sales-hackathon-brief.pdf
> Challenge page: https://prompthack.aaltoes.com/sales-2026/challenges/hmd

HMD Secure has never had a CRM. Their team runs sales through email and personal
notes. The schema and business reality is theirs — you build the product, including
AI agents that make it feel less like data entry and more like having an analyst on
the team.

| | |
|---|---|
| **Format** | Weekend hackathon · 2 days |
| **Deliverable** | Working web app + short demo |
| **Date** | June 2026 |
| **Prize** | €1,000 in cash |
| **Deadline** | **Sunday 15:00 — strict, no late submissions** |

---

## 01 · What we're trying to solve

HMD Secure is a one-year-old startup selling smart devices and a mix of internal and
3rd-party services. The sales team (10–20 reps) and Technical Account Managers run
customer relationships entirely through email and personal notes. No shared system,
no pipeline visibility, no service history per customer. Build a CRM now — before bad
habits set in — so the team can shape it around how they actually work.

**The pain today**
- Deals tracked in Excel. No shared system.
- Cases raised by email. No status, no audit trail.
- TAMs and reps have no shared view of a customer.
- Sales managers have zero pipeline visibility.
- Finance has no forecast data. None.
- Resolved 3rd-party issues leave no record.
- Growing team. Zero institutional memory.

**The goal**
- One place for every account, case, and deal.
- Reps see their full pipeline with stages + values.
- TAMs manage open cases linked to accounts.
- Managers see team-wide status without asking.
- Finance sees a live weighted forecast any time.
- Every interaction shows on the account timeline.
- New reps onboard from history on day one.

---

## 02 · General challenges

### 2.1 · Phased device purchasing
Customers don't buy their fleet in one go. Purchases roll out over time across teams,
sites, markets.
- **Total opportunity is a 3-year sum.** Deal value = total forecasted device volume
  over ~3 years. Time-phased forecast, not a single number.
- **Forecast is cumulative and rolling.** Show both near-term (next quarter) and
  long-term (3-year) from the same deal.
- **Early purchases signal commitment.** Initial purchase is often a pilot. Link
  follow-on orders to the original opportunity.

### 2.2 · Service invoicing models
- **One-off at point of delivery.** Recognised at a single point in time.
- **Fixed-term packages (1–5 years).** Contract value known upfront; revenue spread
  across the term.
- **Monthly recurring on active devices.** Variable. Capture expected rate +
  device-count trajectory.
- **Forecasting implication.** Show service revenue separately from device revenue.
  Don't flatten different models into one number.

### 2.3 · Sales pipeline stages
Pipeline differs direct vs reseller. Flag each deal so the right stages show.

| # | Stage | Win signal | Channel |
|---|---|---|---|
| 1 | Interest shown | Low | Both |
| 2 | RFI answered | Low–Medium | Both |
| 3 | RFP / offer given | Medium | Both |
| 4 | Customer test | High | Both |
| 5 | Contract negotiation | Very high | Direct only |
| 6 | Won | — | Both |
| 7 | Lost | — | Both |

**Reseller note:** contract negotiation does not exist. Customer test → won/lost directly.

---

## 03 · Personas & what they need

### Sales Rep
Manages a book of accounts. Logs conversations. Moves deals through stages.
- All my accounts + deal status at a glance.
- Update deals fast — stage, value, 3-yr time-phased forecast.
- Build offers from the pricing catalog. Submit discounts.
- See approval status real-time. Notified when resolved.
- Open a service case from inside an account.
- AI next best action — topics or a draft email.

**Biggest frustration:** Losing where a deal stands after a week of email.

### Technical Account Manager
Owns the service relationship. Handles technical issues, coordinates 3rd parties.
- All cases assigned, sorted by priority + age.
- Full service history of an account on one timeline.
- Track requests (not just complaints) + customer-side contact.
- Mark case escalated to 3rd party. Track status.
- Internal notes for sales rep + working notes for tech.
- Know when a case is approaching its SLA deadline.

**Biggest frustration:** CC'd on a 3-day-old email thread with no context.

### Sales Manager
Oversees a team of reps. Monitors pipeline health, drives performance against targets.
- Full team pipeline — deals by stage, value, owner.
- Spot deals not moved 14+ days.
- Reassign deals/cases between reps/TAMs.
- Quarter forecast: committed, at-risk, gap to target.
- Switch quarterly / half-year / full-year views.
- Approve / reject discounted offers.

**Biggest frustration:** Forecast meetings run on verbal updates.

### Finance
Uses pipeline data for revenue planning. Doesn't create deals — needs accurate info.
- Weighted pipeline summary without asking sales.
- Time-phased forecast across months/quarters over 3 yrs.
- Filter forecast by period, stage, deal size.
- Export pipeline data to Excel.
- Maintain pricing catalog without a developer.
- Second approval on discounted offers.

**Biggest frustration:** There is no forecast to look at. Pipeline doesn't exist.

---

## 04 · Target features

Three priority levels. **P0 must all be working for a successful submission.**

### P0 · Must have — core of the product
- **Account & contact mgmt** — accounts hold contacts, deals, cases, activity timeline.
- **Case management** — status, priority, linked service, threaded notes.
- **Deal pipeline + stages** — HMD stages. Direct/reseller flag. 3-yr time-phased forecast.
- **Offer creation + storage** — build from catalog. Versioned. Stored on account.
- **Offer approval workflow** — discounts → SM then Finance. Justification required. Locked.
- **Product + pricing catalog** — finance-managed. Add/update/retire without a developer.
- **Service catalog** — internal vs 3rd-party tag. Cases link to a service.
- **Role-based access** — Rep / TAM / SM / Finance. Each lands on the right default view.
- **Personal dashboard** — each role lands on what matters to them first.
- **Case & deal notes** — timestamped, visible to everyone with access.

### P1 · Should have — makes it genuinely useful
- **Search & filter** — across accounts, cases, deals. Pipeline by stage / channel / date.
- **Sales forecast view** — weighted pipeline by stage + time. 3-yr horizon, near + long-term.
- **Case activity log** — every change timestamped + attributed.
- **In-app notifications** — inside the app. Mark read, jump to record.
- **Deal risk indicator** — flags deals not updated 14+ days, past expected close.
- **AI next best action** — suggests next step from timeline + stage (Azure OpenAI).
- **Basic reporting** — cases by status/service, deals by stage/owner, close rate.

### P2 · Nice to have — stretch goals only if P0+P1 done
- **SLA & due-date tracking** — highlight overdue / approaching.
- **Excel / CSV export** — Finance pulls forecast + cases.
- **Email-to-case** — inbound mail → case (Microsoft Graph).
- **Outlook calendar integration** — book follow-up from a case.
- **AI case summary** — 1-paragraph summary on cases with 5+ notes.
- **AI forecast narrative** — natural-language pipeline health.

---

## 05 · AI agents to weave in
Inspiration. Pick what fits — or invent your own.
1. **Smart contact view** — auto-enrich from name/domain. Surface what matters first.
2. **Pipeline at-a-glance** — deals by stage. Flag stalled deals. Suggest next move.
3. **Conversational query** — "at-risk enterprise deals in DACH" → live answer + filter.
4. **Meeting → CRM** — drop notes/transcript. Agent updates records + creates tasks.
5. **Offer drafter** — from a deal, agent drafts a tailored offer from the catalog.
6. **Forecast narrative** — short pipeline-health summary on the Finance view.

---

## 06 · Constraints & platform
Fixed decisions. Everything else — architecture, framework, languages, tooling — is yours.
- **Cloud platform** — Microsoft Azure. Tenant + resources pre-provisioned.
- **Authentication** — Azure AD (Entra ID) SSO. App registration provided.
- **No email notifications** — all notifications in-app. Optional P2 email-to-case inbound only (Graph).
- **Calendar** — Outlook via Microsoft Graph API only.
- **Data residency** — Azure EU region only (North Europe or West Europe).
- **No automated migration** — deals entered manually (AI help OK). Seed realistic demo data.

> **Note on our build:** the brief fixes Azure for the *final* solution, but the meeting
> confirmed the **demo may be built on another platform** (we're using Supabase — eu-north-1,
> EU residency) with the team migrating to Azure later. See `SUPABASE.md`.

---

## 07 · What good looks like
A new user — no training — walks through this scenario without getting stuck:
1. Rep logs in. Finds an account. Sees open deals + active cases together.
2. Rep creates a deal. Marks direct, picks stage, enters 12-month forecast.
3. Rep opens catalog. Picks devices + services. Generates an offer.
4. TAM logs in. Sees a case assigned. Reads history. Adds a note. Closes it.
5. Manager logs in. Sees overdue deals + 3-yr weighted pipeline immediately.
6. Finance logs in. Sees time-phased forecast by quarter for 3 yrs without asking.
7. Rep opens an account → sees an AI-suggested next best action.
8. Rep applies a discount + justification → SM and Finance both notified, both approve.

Use realistic seed data. An empty database doesn't show the product at its best.

---

## 08 · Out of scope
- Customer-facing portal (internal tool only).
- Mobile application.
- Live API integration with 3rd-party service providers.
- Automated bulk import from Excel.
- Multi-language / localisation support.
- Advanced BI dashboards or custom report builders.

**The team owns the how.** This brief defines the problem and the target.

---

## Submission
- **Deadline:** Sunday 15:00 (strict).
- **To:** anssi.ronnemaa@hmdglobal.com, janne.lehtosalo@hmdglobal.com
- **CC (auto):** meri.heikkinen@aaltoes.com, olivia.ronnemaa@aaltoes.com
- Submit by emailing the partner (Submit via email opens a pre-filled draft).
