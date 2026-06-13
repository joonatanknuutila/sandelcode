# Role Definition — FINANCE

The finance role plans revenue from the pipeline. They don't create deals — they need
accurate numbers, and they own the forecast, the catalog, and the 2nd approval gate. The
finance role gets information from the database and turns that into meaningful graphs.
Their crown jewel is the confidence adjustment. They can adjust the probability for each
deal winning at different stages.

Let's go through what features are needed at which stage:

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
