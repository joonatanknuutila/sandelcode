# Hackathon planning meeting — 2026-06-13

> Source (Notion meeting notes): https://app.notion.com/p/37ea330fb64980ab930ff9c5461524d9
> AI-pohjainen CRM-järjestelmä – Hackathon-suunnittelupalaveri

## Action items
- [ ] Create question list for the client (use Claude / Notion to generate). → done: see Notion "Kysymykset HMD:lle (Anssi & Janne)"
- [ ] Present the questions to the client rep before lunch (15-min slot).
- [ ] Define team division of labour after the client conversation.
- [ ] Aarni: set up dev environment (GitHub, Notion integration, shared Claude subscription).
- [ ] Build a simple demo — prioritise the **Sales Rep** UX.
- [ ] Document in the demo architecture how the solution migrates to Azure.
- [ ] Ask Janne on Discord for more CRM-requirement insights.

## Context
- Hackathon planning meeting; goal = build an AI-native CRM demo.
- Client is an **HMD Secure**-type company selling physical devices (Face Devices) +
  services to enterprise and public-sector segments.
- Current sales data lives in an Excel system (name, industry, location, status,
  pipeline volume).
- A live interview with the client rep was held in the meeting.

## Product concept & differentiation
- Current state: existing CRM is ~70% good.
- Differentiation vs competitors:
  - **Brand adaptation** (colours, logos, marks) → the CRM looks like the client's own.
  - **Per-user AI assistant** (chat window) aware of the user's role and comms style.
  - **Proactive CRM** — not a passive register; a system that does things automatically.
- Key features:
  - **Automatic transcription** from Google Meet / Teams → saved straight onto the CRM card.
  - AI sparring before save: asks 3–5 clarifying questions, proposes ready answers,
    never decides alone.
  - **Hallucination minimisation** is critical — AI never decides autonomously; the user
    always approves.
  - Notification channels configurable per user (Slack, email, internal inbox).

## Personas & needs (team's reading)
- **Sales Rep** — owns the sales process to close. Wants the customer journey at a glance,
  next step clear, minimal manual logging. Needs: offer creation, discount request
  (→ Sales Manager → Finance), ticket opening, AI assistant. Pain: doesn't know the next
  step after sending an email.
- **Sales Manager** — tracks the whole team's pipeline + individual rep activity. Wants a
  strategic forecast view (today based on "coffee-room chats"). Approves/rejects discount
  offers. Pain: doesn't know what the data says underneath.
- **Technical Account Manager (TAM)** — takes ownership of the pilot + existing accounts
  after close. Needs: all the rep's process notes retained, SLA deadlines visible,
  3rd-party escalation. Pain: gets a link to a 3-day-old email with no context.
- **Finance (Fina)** — wants pipeline data without calling reps. Does revenue forecasting
  (important for component-order planning). Manages pricing catalog without a developer.
  Approves discounts (2nd level after Sales Manager). Advanced BI dashboard is **out of
  scope**, but a simple opportunity view + confidence score is needed.

## Key findings from the client interview
- Sales process stages: Initial contact → Offer → Customer test (pilot) → Contract.
- Account manager owns the customer to the end, but Sales Manager + Finance join at the
  offer stage.
- **Offer creation is intensive** in B2B/B2G — can take weeks, customisation always required.
- **Web data enrichment** when creating a new account is seen as valuable (decision-makers,
  competitor relationships, events).
- Transcription is **optional** — defence-sector customers may not want recording.
- All notifications wanted **in-app** (no email notifications by default).
- Communication happens through the CRM — don't want to go back to the "9-months-ago" state.

## Technical architecture (team decisions)
- **Azure** is the client's security environment — the final solution goes there, but the
  **demo can be built on another platform** and the team has resources to migrate.
- **Supabase** would ease user management in the demo phase (Azure constraint noted).
  → We provisioned a Supabase project for the demo; see `SUPABASE.md`.
- Dev tools: GitHub, Vercel (frontend), Notion (workspace + command channel), Claude Pro
  (primary AI).
- Proposed team flow: Notion as a shared command channel; Claude polls Notion (~every
  minute) for new prompts to feed different terminal sessions. (This is what the
  `watcher/` + `people/*/prompt/` structure in this repo implements.)
- Warning: schedule has no slack — don't build something too complex.
