# MASTER BUILD PROMPT — Technical Account Manager (TAM) View
**Product:** HMD Secure AI-native CRM · **Persona scope:** Technical Account Manager only
**Audience:** AI coding agent(s) building the app · **Use:** paste as the spec for the TAM module

---

## 0. How to use this prompt

You are building **one persona module** of a multi-persona CRM. The database, account model, authentication, and design system are **shared** across all four personas (Sales Rep, TAM, Sales Manager, Finance). Your job here is the **Technical Account Manager (TAM)** experience: the screens they land on, the data they see, the actions they take, and the AI agents that remove friction from their day.

Design rule that overrides everything else: **build only what the TAM actually needs.** A TAM does not manage the deal pipeline, does not touch pricing, does not build forecasts. If a screen shows something the TAM doesn't act on, it is clutter — cut it. The persona is the unit of design, not the database.

---

## 1. Shared foundation (context, do not rebuild here)

These exist once and are reused. Assume they are available to your module:

- **Single shared database.** Accounts are the spine. An Account holds: contacts, deals, cases, and one chronological **activity timeline**.
- **Role-based access.** User logs in via **Supabase Auth**. Role = TAM → lands on the TAM default dashboard. Each role has its own default view.
- **Case model** is shared but the TAM is its primary owner/operator.
- **Service catalog** (internal vs 3rd-party tagged) — cases link to a service.
- **Notes** are timestamped, attributed, and visible to everyone with access to the record.
- **Notifications are in-app only.** No email. Assume every user lives inside the CRM; that is where they get pinged.
- **Branding:** apply HMD's brand assets (logo, colors, typography) so the product looks like HMD's own tool, not a template.

---

## 2. Who the TAM is (build for this person, not a generic user)

The TAM **owns the service relationship after the sale.** They live in active pilots and existing customers — this is a customer-success role with a technical edge. They handle technical issues, track customer requests (not just complaints), and coordinate third parties whose hardware/software connects to HMD devices.

They enter the customer journey around the **Customer Test** stage, when a sample device is in the customer's hands and questions start flooding in: how to deploy it, how to connect it to the customer's own systems. From there they own the relationship indefinitely.

**Their single biggest frustration — solve this first:**
> A sales rep flags "make a service case here, can you fix it?" and CC's the TAM onto a 3-day-old email thread. The TAM opens it and has **no context** — they don't know what the case is, what was promised, or what's been done. They waste time asking around before they can even start.

The product must make sure a TAM **never opens a case cold.** Full history, the originating sales context, the service involved, and an AI-written summary should be one screen away.

---

## 3. TAM default dashboard (what they see on login)

The landing screen answers, in order: *What's mine? What's urgent? What's about to breach? What changed since I was last here?*

Components:

1. **AI Daily Brief (top of page).** On open, an agent analyzes the TAM's assigned cases and produces a short brief: e.g. *"3 open cases. 1 approaching SLA in 6h (Account X). 1 escalated to a 3rd party awaiting their reply for 2 days. 1 new case handed off from sales yesterday — no context yet."* Brief ends with a suggested action list (see §6).
2. **My cases queue.** All cases assigned to the TAM, **sorted by priority then age.** Each row: account, service, priority, age, SLA status (color-coded), last activity.
3. **SLA watchlist.** Cases approaching or past their SLA deadline, surfaced separately so nothing breaches silently.
4. **3rd-party escalations.** Cases currently waiting on an external party, with how long they've been waiting.
5. **Recently handed-off cases.** New cases assigned by a sales rep that the TAM hasn't opened yet — flagged so the "cold thread" problem is visible immediately.

The TAM does **not** see: deal pipeline management, pricing catalog, discount approvals, forecast charts, team performance. (Pipeline *status* may appear read-only as context inside an account — see §4 — but never as something the TAM manages.)

---

## 4. Information architecture for the TAM

### 4.1 Case (primary object)
A case carries:
- Status (open / in_progress / escalated / resolved / closed — the live `case_status` enum). A **"waiting on"** indicator (HMD / customer / 3rd-party) is *derived* from the case, not a stored status.
- Priority
- **Linked service** (from the service catalog; tagged internal vs 3rd-party)
- **SLA deadline** — the date the case must be resolved by. Auto-alert as it approaches.
- Customer-side contact (who at the customer is involved)
- **Threaded notes**, split into two visible streams:
  - **Internal / sales-facing notes** — what the sales rep needs to know.
  - **Working / tech notes** — the TAM's technical scratchpad and resolution steps.
- **Case activity log** — every status change, reassignment, and note timestamped + attributed.
- **3rd-party escalation block** — escalated yes/no, which party, status of the external coordination, last update.

### 4.2 Account context (read access the TAM needs)
When the TAM opens an account they must see, on **one timeline**:
- **Full service history** of that account — every past and current case, what was done, by whom, when.
- **Sales rep's notes from the whole initial sales process** — so the TAM inherits context instead of asking.
- Current deal/pipeline status **read-only**, purely as background (who they're dealing with, what was sold). Not editable here.
- Account basics: contacts, decision-makers, the services/devices in play.

### 4.3 Service catalog (read)
Each service tagged **internal** vs **3rd-party**, plus its invoicing model (one-off / fixed-term / monthly recurring). The TAM links a case to the relevant service. Third-party tags drive the escalation workflow.

---

## 5. Core TAM workflows (build these journeys end-to-end)

**A. Receive a handed-off case (kills the "cold thread" problem)**
Sales rep opens a service case from inside an account → it lands in the TAM's queue and is flagged as new/unread on the dashboard → TAM opens it and immediately sees: linked service, originating sales context, the rep's notes, and an **AI case summary** so they start informed, not confused.

**B. Triage & work a case**
Open case → read AI summary + history → set/confirm priority → add working notes (or dictate them, see §6) → update status → resolve → close. Every step writes to the activity log.

**C. Escalate to a 3rd party**
Mark case **escalated to 3rd party** → pick the party → set escalation status → track waiting time → log the back-and-forth. *Example to design for:* an HMD device must interoperate with a third party's software or a connected device; the TAM coordinates with that third party's contact to test the integration ("does the info-sharing work between us? never been tested — let's test"). The case stays open and visibly "waiting on external party" until resolved, then the resolution is recorded permanently (today these resolutions vanish into email — don't let that happen).

**D. Stay ahead of SLA**
As a case nears its SLA deadline, the TAM is alerted **in-app**. The SLA watchlist and per-case color status make breach risk impossible to miss.

---

## 6. AI agents for the TAM (the real differentiator)

The point of these agents is **less data entry, more "analyst on the team."** Every agent follows the same safety pattern below.

### Agents to build
1. **Case Context Brief / Summary.** For any case (especially handed-off or 5+ notes), generate a one-paragraph plain-language summary: what the case is, what's been done, what's blocking, who's involved. This is the direct antidote to the cold-thread frustration.
2. **Personal assistant chat window.** A per-TAM chat where they can ask natural questions: *"What's the status on the Account X case?" "Has anyone talked to the customer about the connector issue?" "What did we promise this account during the sale?"* It pulls from the account timeline, notes, and case history to answer. Especially valuable when a manager calls demanding an instant status update.
3. **Daily brief generator.** Powers the dashboard brief in §3 — analyzes the queue and proposes next actions.
4. **Meeting / call → case updater.** Drop a transcript or notes from a customer call → agent drafts case updates and proposed notes. **It does not save silently.** It summarizes, asks the TAM a few targeted clarifying questions to fill gaps, the TAM reviews/edits, then approves. Provide an option to **disable transcription entirely** for sensitive defense-sector customers who forbid recording.
5. **Conversational query / filter.** Plain-language queries over the case set → live answer + applied filter (e.g. *"my high-priority cases past SLA"*).
6. **Next best action.** From a case's timeline + status, suggest the next step or a draft message — as **options to pick from**, not a unilateral action.

### Mandatory AI safety / UX pattern (apply to every agent)
- **Human-in-the-loop on anything written to the CRM.** The TAM must read and approve before data is saved. They can edit first.
- **Offer options, don't decide.** Where the AI proposes an action, present 2–3 likely options the TAM can click ("this is right" / "actually, something else"), plus a verification step that confirms the situation before committing.
- **Verify before save.** The flow is: AI summarizes → asks clarifying questions → TAM answers/edits → TAM approves → save. A small "sparring" step, never a blind transcript-to-database dump.
- Keep it **conversational and lightweight** — the TAM should be able to speak/dictate updates ("here's what happened on this case") and let the AI fill the structured fields, then just check it.

---

## 7. Notifications

In-app only. Build the notification center: mark read, click to jump straight to the case/account. Surface: new case assigned, SLA approaching/breached, 3rd-party escalation update, status change on a case the TAM owns. No email.

---

## 8. Explicitly out of scope for the TAM view (do not build into this module)

- Deal pipeline **management** (stage editing, deal values, forecasts) — TAM only sees pipeline status read-only as account context.
- Pricing/product catalog editing, offer creation, discount approvals.
- Finance forecast views and weighted pipeline.
- Team performance / manager analytics.
- Customer-facing portal, mobile app, multi-language, advanced BI/report builders, live external API integrations, bulk Excel import. (Global out-of-scope per brief.)

---

## 9. Platform & data constraints

- **Platform:** Next.js on Vercel + **Supabase** (Postgres + Auth), EU region (`eu-north-1`). This is the **final** platform, not a stopgap — the brief's original Azure/Entra ID mandate is historical context only (see `docs/SUPABASE.md`).
- For the hackathon, **prioritize a strong working demo** on the shared Supabase data layer — every persona reads and writes the same Postgres.
- **Seed realistic demo data**: several accounts, a spread of cases across priorities/ages/statuses, at least one 3rd-party escalation, at least one case approaching SLA, and one freshly handed-off case with sales notes — so the cold-thread→AI-summary moment is demonstrable.

---

## 10. TAM demo acceptance criteria

A new TAM with no training can:
1. Log in and immediately see their assigned cases sorted by priority + age, plus an AI daily brief.
2. Open a case handed off from sales and understand it in seconds via the AI summary + inherited history (no asking around).
3. Add a note (typed or dictated), change status, and see it logged.
4. Mark a case escalated to a 3rd party and track the waiting status.
5. Get an in-app alert for a case approaching its SLA deadline.
6. Ask the assistant a plain-language question about an account and get a grounded answer.
7. Close a case and have the resolution permanently recorded on the account timeline.

---

## 11. Open questions to confirm with the client (flag, don't guess)

- Exact **SLA deadline rules** — fixed per priority, per service, or per contract?
- Priority levels — how many, and definitions?
- Which **3rd parties** recur most, and do they need contact records in the system?
- Should the TAM be able to **reassign** a case, or only the Sales Manager?
- For sensitive (defense) accounts: confirm the default transcription/recording posture (off by default vs opt-in).