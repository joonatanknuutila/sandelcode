# Role Definition — THE SALES REP

This is the Sales Rep's role for the master prompt. It defines what the rep does, what
they need to see, and what a great experience feels like — organized by the MOMENTS when
the rep touches the software, not by buttons. Build the rep's experience around these
moments; each moment works across all pipeline stages, with the stage only changing the
content inside it.

---

## WHO THE REP IS

The Sales Rep (also the account manager) owns the customer relationship from first
interest to Won. They handle a FEW large enterprise/government deals at a time — deep, not
wide. They are the main person who brings information INTO the system; almost everything
the other three roles see is built from what the rep captures.

**The rep's pain, in priority order (this drives the whole design):**
1. **Documentation / keeping the CRM accurate.** The biggest pain. Logging is tedious, so
   it doesn't happen, so the CRM is untrustworthy.
2. **Situation awareness.** What was said, where things stand — hard to reconstruct after
   a week of scattered contact.
3. **Prioritization.** What to do next. Least painful, because with only a few deals the
   rep can mostly see this themselves.

**The key insight:** pain #1 causes pain #2. If logging becomes effortless, the CRM
becomes accurate, and situation awareness fixes itself. So the rep's experience is
designed as a CAPTURE surface first (a place the situation flows into without friction),
and a viewing surface second. This is the opposite of most CRMs, and it's the point.

---

## THE REP'S MOMENTS

Two kinds. Recurring moments repeat through the whole lifecycle (the content changes with
the stage). Stage-bound moments appear only at certain points. Design a screen/experience
for each moment; the stage is context inside it, not a separate screen.

### RECURRING MOMENT 1 — "I just talked to the customer" (CAPTURE)

The most important moment, because it fixes pain #1 and feeds everything else. A meeting,
call, or email just ended and the rep has information in their head or inbox that must
land before it's forgotten.

**What the rep needs:** to dump what's in their head with the least possible effort, and
to trust it landed in the right place. They must NOT have to fill structured fields.

**The experience:** the rep writes or dictates freely what happened — or pastes a
transcript or the customer's email (same mechanism, any text input). Two ways forward on
the same input: a quick manual save (jot it, done) OR spar with the AI. When sparring, the
AI reads the text, asks a couple of clarifying questions, and only after the rep confirms
does it structure everything: a timeline entry, a stage change if warranted, the
customer's open questions split into technical vs. commercial, and a suggested next step.
The rep reviewed, not typed. Nothing is written before they confirm; if the AI is unsure,
it asks rather than inventing.

**How the stage changes the content:**
- Interest shown: first impressions, who was in the room, initial volume signals.
- RFI answered: what information was requested, what was promised, what's still open.
- Customer test: how the pilot is going, technical concerns surfacing.
- Contract negotiation: pricing signals, the customer's discount pressure, objections.

This is the same capture experience every time — only what the rep talks about shifts.

### RECURRING MOMENT 2 — "Where did I leave off?" (SITUATION AWARENESS)

The rep is about to call or meet a customer and opens the account to remember where things
stand.

**What the rep needs, fast:** where the deal is (stage), what was last discussed, what was
promised, which questions are open, and whether anything is at risk. Not a wall of raw
history — a digest.

**The experience:** opening the account shows a clear current-state picture at the top:
the stage, the last contact and when, the open questions, the next step. On a
history-heavy account, a one-tap summary gives a one-paragraph situation read from the
structured timeline (not from a raw email thread — that thread never existed, because
everything was captured to the timeline in Moment 1). The raw timeline is there if they
want to scroll, but they shouldn't have to.

**How the stage changes the content:**
- Early stages: light — a few contact points and open questions.
- Customer test: the open case shows here as a RISK indicator (see Moment 5). The rep
  doesn't fix it, but must know before speaking to the customer.
- Contract negotiation: the discount approval status is front and center.

### RECURRING MOMENT 3 — "What do I act on?" (PRIORITIZATION)

The rep opens the software with no specific customer in mind and wants to know what needs
attention. The lightest pain (few deals), but still a real moment — usually the start of a
day or week.

**What the rep needs:** a short, honest list of what's stuck, what's waiting on them, and
what they promised to do. With only a few deals, this is a focused list, not an algorithm.

**The experience:** a personal landing that answers "what now" — not a chart wall. Deals
not moving show as gentle flags; pending things (an approval came back, a TAM replied)
surface; AI-suggested next steps appear, but only for deals that actually need attention,
not for every deal (suggestions everywhere become noise). Quality over quantity: a rep
with five deals wants five honest signals, not fifty.

---

### STAGE-BOUND MOMENT A — "A new lead comes in" (only at the start)

Appears once, at Interest shown. The rep decides to create an account (HMD's leads are
inbound and known — the rep knows when one is worth entering; never auto-created).

**What the rep needs:** to go from nothing to prepared with minimal effort.
**The experience:** the rep creates the account by hand (name, industry, location) and a
deal at stage 1, choosing the channel (direct/reseller) at creation. Then one tap fetches
background: the AI returns "what we found" (decision-makers, the customer's strategy,
competitor deals, upcoming events) and, honestly, "worth checking yourself" (what it
couldn't verify). An empty account becomes a briefed one in under a minute.

### STAGE-BOUND MOMENT B — "A proposal is needed" (RFP, and again at negotiation)

Appears at RFP/offer given and recurs at Contract negotiation.

**What the rep needs:** to get the proposal moving without building it alone. The rep owns
the customer knowledge; they should not have to assemble or price the whole offer.
**The experience:** the rep triggers an "offer brief" — the AI assembles a clean written
summary of everything relevant (what the customer asked for, volumes and services
discussed, what to keep in mind like "stressed certification" or "competitor is Samsung").
This brief — not a finished proposal, not a PDF — goes to manager/finance, who build the
actual offer from the catalog on top of it. At negotiation, the rep also proposes a
discount with a mandatory justification (the AI can draft the business case), then submits
it into the approval flow.

### STAGE-BOUND MOMENT C — "I'm waiting on a decision / something happened on my deal" (hand-off & tracking)

Appears mainly at Customer test and Contract negotiation, wherever the rep depends on
another role.

**What the rep needs:** to know the status of things they don't directly control — a
discount approval moving through the gates, or a technical case the TAM is handling that
threatens their deal.
**The experience:** an approval shows a clear status ("Pending: Sales Manager → Finance →
Locked") and the rep is notified when it resolves — ideally via an AI-drafted, human-sent
message from the approver, not a faceless auto-alert. A TAM's open case on the rep's deal
shows on the account as a risk the rep is AWARE of (they manage the customer; the TAM
fixes the issue). Clear split, visible to both.

### STAGE-BOUND MOMENT D — "The deal resolves" (Won / Lost)

Appears at the end.

**What the rep needs:** to close the loop with one action and have the right consequences
follow automatically.
**The experience:** the rep marks the deal Won (or Lost). On Won, the deal's value and
time-phasing lock into the forecast — the rep doesn't do forecast math, it follows from
what's already captured. (Order fulfillment is a different system, out of scope.) On Lost,
a brief reason is captured so the history teaches the next deal.

---

## WHAT THE REP SHOULD NEVER HAVE TO DO

Design guardrails — if any of these creep in, the design has failed pain #1:
- Fill structured fields by hand when free text + spar could do it.
- Build or price a full offer alone.
- Do forecast math.
- Reconstruct a deal's state by scrolling raw history or re-reading emails.
- Manage notifications — relevant things surface where the rep already is.

## THE REP'S RELATIONSHIP TO THE OTHER ROLES (touch points)

- → TAM: the rep raises technical questions (Moment 1 produces them; an AI-drafted message
  carries them over). The rep stays aware of the resulting case as a deal risk (Moment C).
- → Manager / Finance: the rep's offer brief feeds them (Moment B); the rep's discount runs
  their approval gates (Moment B/C).
- The rep's captured data is the source the manager's and finance's views are built on. If
  the rep's capture is poor, every downstream role suffers — which is why Moment 1 is the
  whole foundation.
