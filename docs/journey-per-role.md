# HMD Secure CRM — The Journey, Per Role (team walkthrough)

This document is for the whole team to read before we split into segments. Same story as
the full journey, but organized by ROLE instead of by stage. Each of the four sections
follows one role from start to finish, so whoever takes that segment can read their own
arc in one piece and pick it up cleanly.

The one principle that holds it all together: **one shared data layer, four lenses.**
Everyone works on the SAME customer, SAME timeline, SAME deal. The role only changes what
you see, in what order, and what you can do. Nobody has a private silo.

Our example customer: a Nordic ministry evaluating ~1,200 secure devices plus a
management service, rolled out over 3 years. Direct deal. We follow this one account from
empty to Won, four times — once through each role's eyes.

**The seven stages (shared reference):**

1. Interest shown
2. RFI answered
3. RFP / offer given
4. Customer test
5. Contract negotiation (direct only)
6. Won
7. Lost

The AI, in one line: it lives as context buttons where the work is (spar, explain,
summarize, draft) and as a role-aware side panel for "ask the analyst" moments. It writes
language and interprets; plain code computes the numbers; it never writes to the database
before a human confirms.

---

## ROLE 1 — THE SALES REP (the spine of the system)

The rep owns the customer relationship from first interest to Won. They are the main
person bringing information IN; almost everything the other roles see is built from what
the rep captures. So the rep's experience has to be the lightest in the whole product.

**Stage 1 — Interest shown.** The rep creates the account by hand (name, industry,
location) and a deal at stage 1, choosing the channel (direct). They click "Fetch
background" and the AI fills a two-part box: "Found this" (decision-makers, the ministry's
strategy, competitor deals, events) and "Worth checking yourself" (honest gaps). In under
a minute, an empty account becomes a briefed one. No forms — one button.

**Stage 2 — RFI answered.** After the meeting, the rep opens the account and clicks "Add
note." Two buttons on one field: Save (manual jot) or Spar & structure. They spar:
paste a transcript or just type/dictate freely. The AI asks a couple of clarifying
questions, and only after the rep confirms does it write the timeline event, bump the
stage, split the customer's open questions into technical vs. commercial, and suggest a
next step. Then it offers: "These are technical — raise with TAM?" One click drafts a
message to the TAM (bound to the account); the rep edits and sends.

**Stage 3 — RFP / offer given.** Throughout, the rep logs contact points with one tap
(calls, meetings, the customer's emails) — this is how all the outside-the-software
contact gets recorded. When the proposal is needed, the rep does NOT build it alone: they
click "Prepare offer brief," and the AI assembles a clean summary of what the customer
asked for, the volumes and services discussed, and what to keep in mind. That brief goes
to manager/finance, who build the actual offer. The rep's job was to know the customer;
the assembling was done for them.

**Stage 4 — Customer test.** The rep still OWNS the relationship but steps back from the
technical lead — the TAM runs the pilot. The key thing for the rep: the open case shows on
their timeline as a risk indicator. They do NOT fix it, but they must KNOW, so they can
manage the customer's expectations and not promise the deal forward before the pilot is
solid.

**Stage 5 — Contract negotiation.** The customer pushes for a 12% discount. The rep
proposes a discounted offer and writes the mandatory justification (or spars with the AI
to draft the business case). They submit it; a status bar shows "Pending: Sales Manager →
Finance → Locked." When approved, they're notified.

**Stage 6 — Won.** The rep marks the deal Won. Done. (Order fulfillment is a different
system, out of scope.)

**Rep's recurring need:** the lightest possible capture. If a task takes more than a tap
or a sentence, the AI should do the heavy part (spar, draft) and the rep just confirms.

---

## ROLE 2 — THE TECHNICAL ACCOUNT MANAGER (enters at the pilot)

The TAM owns the technical/service side. They are mostly silent in the early stages and
enter strongly at the pilot. Their home is the case view, not the pipeline.

**Stages 1–2 — mostly waiting, then first contact.** The TAM isn't involved while the
deal is purely commercial. Their first touch comes in stage 2: when the rep raises a
technical question, a message arrives in the TAM's inbox — not a forwarded email thread,
but a clean note bound to the account, with the technical questions laid out and the
account one click away. The TAM starts with context, not confusion. They might add an
internal note for the rep at this point, but the heavy work hasn't started.

**Stage 3 — light involvement.** As the proposal forms, the TAM may be consulted on
technical feasibility, but the offer is built by manager/finance. The TAM watches.

**Stage 4 — Customer test (the TAM's main stage).** The pilot of 400 devices is delivered
and the ministry integrates it into their systems. Technical questions arise — this is
where the TAM leads. Their case view shows cases sorted by priority and age. When an
integration issue appears, they open a case: set priority, link it to the service (tagged
3rd-party), mark it escalated. Status changes are one tap (open → in progress → escalated
→ resolved). Or they spar: "3rd party promised a fix next week" → the AI updates the case
status and adds a note. After updating, the AI drafts a short status message to the
rep/manager, and the TAM sends it with one click.

On a history-heavy account, the TAM clicks "Summarize situation" and gets a one-paragraph
picture from the structured timeline — no 3-day email thread to read, because that thread
never existed; everything lives on the timeline already.

The TAM's work has a sales consequence they should be aware of: a failed pilot kills the
1,200-device deal. They fix the technical; the rep manages the relationship. Clear split.

**Stages 5–6 — back to support.** Once the pilot succeeds and negotiation begins, the TAM
returns to a supporting role. Their cases stay on the account as service history — the
institutional memory the brief wants, so the next person isn't starting from zero.

**TAM's recurring need:** making case handling almost effortless. One-tap state changes,
spar for updates, AI-drafted status notes. And the full service history of an account on
ONE timeline, summarizable on demand.

---

## ROLE 3 — THE SALES MANAGER (a reader and decision-maker)

The sales manager does NOT close deals — they run the team that does. They barely enter
data; they read pipeline health and intervene where it's wrong. Their view is built around
"show me what's wrong, let me act."

**Stages 1–2 — passive visibility.** As the rep creates and advances the deal, it simply
appears in the manager's team pipeline at the right stage. The manager didn't ask anyone —
it's just there. Early on it's a faint signal among many; they don't act yet.

**Stage 3 — watching the pipeline fill.** The deal moves to RFP and gets its first
confidence score (rule-computed). The manager sees it in their team view alongside every
other rep's deals, filterable by rep / stage / value / channel. If they want, they can ask
the assistant panel "how does this compare to similar past deals?" — but mostly they're
scanning for what's stuck.

**Stage 4 — catching risk.** A high-priority case open on a high-value stage-4 deal shows
as a risk on the manager's radar — exactly the thing they want to catch early. They might
message the rep about it, or reassign if a rep is overloaded.

**Stage 5 — the 1st approval gate.** The discount request lands in the manager's inbox,
bound to the deal, with the justification visible and approve/reject buttons. Next to it,
"Show context" assembles what they need to decide — deal value, margin impact (from the
rules), customer history. They approve or reject; their decision auto-drafts a message to
the rep, sent with one click. This is the manager's most active moment in the whole flow.

**Stage 6 — Won.** The deal closes and moves to "committed" in the team pipeline. The
manager's forecast — once run on verbal updates in meetings — is now just there, from data.

**Manager's recurring need:** exception-spotting, not everything-watching. Deals not moving
14+ days, big deals at risk, discounts awaiting their gate. Plus the power to reassign.

---

## ROLE 4 — FINANCE (owns the forecast and the catalog)

Finance plans revenue from the pipeline. They don't create deals — they need accurate
numbers, and they own the forecast, the catalog, and the 2nd approval gate. Their crown
jewel is the confidence adjustment.

**Stages 1–2 — almost nothing.** The deal is too early and too uncertain to matter to
Finance. It sits in the weighted pipeline at a low probability. Finance is maintaining the
product/service catalog in the background (the prices everyone builds offers from).

**Stage 3 — the deal enters the forecast meaningfully.** As the offer takes shape, Finance
helps build the actual offer from the catalog on top of the rep's offer brief — placing
device batches on a 3-year timeline and services into their correct invoicing models
(one-off, fixed-term, monthly-recurring). The deal now shows in the forecast with device
revenue and service revenue SEPARATE, never flattened into one number. Finance can ask the
assistant "is anything unusual in this pricing vs. the catalog?"

**Stage 4 — watching the risk to the number.** Finance sees that a pilot is underway and
that confidence depends on it succeeding. They don't act technically, but the pilot's
state feeds the forecast they're responsible for.

**Stage 5 — the crown jewel + 2nd gate.** Two things happen here. First, the approval:
after the manager's gate, the discount request reaches Finance's inbox; Finance approves
(2nd gate) → the offer locks. Second, and most important, the confidence view: the rules
compute, say, 80%, but Finance can override to 65% with a written reason ("this customer
has delayed before"). Both numbers are stored — the rule value and Finance's judgment, plus
the insight. They can ask "why 80%?" and get the rule-based explanation. This number drives
real hardware/component ordering, so it must be editable and justifiable. The closer to
close, the more accurate it must be.

**Stage 6 — Won becomes commitment.** Finance validates the final time-phased forecast:
device batches across 3 years, services on their models, confidence ~100%. The deal moves
from "weighted/at-risk" to "committed." This is the moment "forecast" becomes "commitment"
and drives concrete planning.

**Finance's recurring need:** a weighted, time-phased forecast they can read, filter, and
adjust without asking sales — device and service revenue separate — with the confidence
number owned by a human and the AI showing its work. Plus catalog maintenance without a
developer.

---

## HOW TO USE THIS WHEN YOU DESIGN YOUR SEGMENT

Read your own section top to bottom — that's your arc. Then keep three questions in front
of you for every task in your role:

1. **Where does the information come from, and where does it go?** Your role both reads
   data others created and creates data others will read. Trace both directions — your
   "in" is often another role's "out."
2. **What is the lightest possible way to do this?** Minimal friction was the brief-giver's
   #1 ask. If a task takes more than a tap or a sentence, ask whether the AI can do the
   heavy part and the human just confirms.
3. **What does this role see that no other role needs?** That's your default view — but
   it's the same data underneath. You're designing a lens, not a separate app.

Anchor every screen to this one ministry story. If a screen wouldn't appear somewhere on
this customer's journey from interest to Won, question whether it belongs in the demo.

A note on hand-offs: the interesting moments are where one role's arc touches another's —
rep raises a question to TAM (stage 2), rep's brief feeds manager/finance (stage 3), TAM's
case becomes the rep's risk (stage 4), rep's discount runs the manager→finance gate
(stage 5). When you design your segment, pay special attention to these touch points,
because that's where "one shared data layer, four lenses" either works or breaks.
