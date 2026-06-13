"use client";

// Discount-offer approval gate (brief P0). The same component serves both gates:
//   gate="sm"      → Sales Manager, first approval
//   gate="finance" → Finance, second approval (locks the offer)
// Pattern B (AI drafts, human sends): on a decision the system does NOT fire an
// auto-notification — it drafts a message to the rep that the approver sends with
// one click. Decisions are local state for the demo (no persistence layer yet).

import { useState } from "react";
import { eur } from "@/lib/format";
import { Badge, Button, Card, SectionTitle } from "@/components/ui";

export interface OfferVM {
  id: string;
  accountName: string;
  dealName: string;
  version: number;
  total: number;
  maxDiscountPct: number;
  justification?: string;
}

type Decision = "approved" | "rejected";

interface Resolved {
  decision: Decision;
  reason: string;
  sent: boolean;
}

const GATE_LABEL = {
  sm: "Sales Manager approval",
  finance: "Finance approval",
} as const;

function draftToRep(o: OfferVM, decision: Decision, gate: "sm" | "finance"): string {
  const who = gate === "sm" ? "Sales Manager" : "Finance";
  if (decision === "approved") {
    const next =
      gate === "sm"
        ? " It now moves to Finance for the second approval."
        : " The offer is approved and locked — you're clear to send it to the customer.";
    return `Hi — ${who} has approved offer v${o.version} (${o.maxDiscountPct}% discount, ${eur(o.total)}) on ${o.accountName}.${next}`;
  }
  return `Hi — ${who} couldn't approve offer v${o.version} on ${o.accountName}. Reason: "${o.justification ? "see note" : ""}". Please revise and resubmit.`;
}

export function OfferApproval({
  offers,
  gate,
}: {
  offers: OfferVM[];
  gate: "sm" | "finance";
}) {
  const [resolved, setResolved] = useState<Record<string, Resolved>>({});

  function decide(o: OfferVM, decision: Decision) {
    setResolved((prev) => ({
      ...prev,
      [o.id]: { decision, reason: "", sent: false },
    }));
  }

  function send(id: string) {
    setResolved((prev) => ({ ...prev, [id]: { ...prev[id], sent: true } }));
  }

  return (
    <section>
      <SectionTitle>
        Needs your approval · {GATE_LABEL[gate]}
      </SectionTitle>
      {offers.length === 0 ? (
        <Card className="p-4 text-sm text-muted">
          Nothing waiting for approval right now.
        </Card>
      ) : (
        <div className="space-y-3">
          {offers.map((o) => {
            const r = resolved[o.id];
            return (
              <Card key={o.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{o.accountName}</p>
                    <p className="text-xs text-muted">
                      {o.dealName} · offer v{o.version}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-hmd-teal-700">
                      {eur(o.total)}
                    </p>
                    <Badge tone="amber">{o.maxDiscountPct}% discount</Badge>
                  </div>
                </div>

                {o.justification && (
                  <p className="mt-3 rounded-lg bg-background px-3 py-2 text-xs text-foreground">
                    <span className="font-medium">Justification: </span>
                    {o.justification}
                  </p>
                )}

                {!r ? (
                  <div className="mt-3 flex gap-2">
                    <Button onClick={() => decide(o, "approved")}>Approve</Button>
                    <Button variant="secondary" onClick={() => decide(o, "rejected")}>
                      Reject
                    </Button>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge tone={r.decision === "approved" ? "green" : "red"}>
                        {r.decision === "approved"
                          ? gate === "sm"
                            ? "Approved → Finance"
                            : "Approved & locked"
                          : "Rejected → back to rep"}
                      </Badge>
                    </div>
                    {/* Pattern B — AI-drafted message to the rep, sent on one click */}
                    <div className="rounded-lg border border-border bg-background p-3">
                      <p className="text-xs font-medium text-muted">
                        Draft to rep (AI-written — edit or send)
                      </p>
                      <p className="mt-1 text-xs text-foreground">
                        {draftToRep(o, r.decision, gate)}
                      </p>
                      <div className="mt-2">
                        {r.sent ? (
                          <Badge tone="blue">Sent ✓</Badge>
                        ) : (
                          <Button onClick={() => send(o.id)}>Send to rep</Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
