"use client";

// Discount-offer approval gate (brief P0). The same component serves both gates:
//   gate="sm"      → Sales Manager, first approval
//   gate="finance" → Finance, second approval (locks the offer)
// The decision now PERSISTS: it records the approval (advancing offers.status;
// Finance approve locks the offer) and notifies the rep of the outcome. The
// resulting status is shown. Role is driven by `gate`, so SM and Finance both
// work without forking the component.

import { useState, useTransition } from "react";
import { eur } from "@/lib/format";
import { Badge, Button, Card, SectionTitle } from "@/components/ui";
import { toast } from "@/components/ui-client";
import { decideOfferAction } from "@/app/finance/actions";

export interface OfferVM {
  id: string;
  accountName: string;
  dealName: string;
  version: number;
  total: number;
  maxDiscountPct: number;
  justification?: string;
  /** Deal owner to notify of the outcome (optional; degrades gracefully). */
  ownerId?: string;
  /** Deal id for deep-linking the rep notification. */
  dealId?: string;
}

type Decision = "approved" | "rejected";

interface Resolved {
  decision: Decision;
  status: string;
}

const GATE_LABEL = {
  sm: "Sales Manager approval",
  finance: "Finance approval",
} as const;

/** Plain-English outcome for the resolved badge, derived from the live status. */
function outcomeLabel(
  decision: Decision,
  gate: "sm" | "finance",
  status: string,
): string {
  if (decision === "rejected") return "Rejected → back to rep";
  if (gate === "sm") {
    return status === "pending_finance_approval"
      ? "Approved → Finance"
      : "Approved";
  }
  return "Approved & locked";
}

export function OfferApproval({
  offers,
  gate,
}: {
  offers: OfferVM[];
  gate: "sm" | "finance";
}) {
  const [resolved, setResolved] = useState<Record<string, Resolved>>({});
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function decide(o: OfferVM, decision: Decision) {
    setBusyId(o.id);
    startTransition(async () => {
      try {
        const { status } = await decideOfferAction({
          offerId: o.id,
          role: gate,
          decision,
          ownerId: o.ownerId,
          dealId: o.dealId,
          accountName: o.accountName,
          total: o.total,
        });
        setResolved((prev) => ({ ...prev, [o.id]: { decision, status } }));
        toast(
          decision === "approved"
            ? "Approved — rep notified"
            : "Rejected — rep notified",
          { variant: decision === "approved" ? "success" : "warning" },
        );
      } catch {
        toast("Could not record the decision", { variant: "error" });
      } finally {
        setBusyId(null);
      }
    });
  }

  return (
    <section>
      <SectionTitle>Needs your approval · {GATE_LABEL[gate]}</SectionTitle>
      {offers.length === 0 ? (
        <Card className="p-4 text-sm text-muted">
          Nothing waiting for approval right now.
        </Card>
      ) : (
        <div className="space-y-3">
          {offers.map((o) => {
            const r = resolved[o.id];
            const isBusy = busyId === o.id && pending;
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
                    <p className="text-sm font-semibold text-foreground">
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
                    <Button
                      disabled={pending}
                      onClick={() => decide(o, "approved")}
                    >
                      {isBusy ? "Saving…" : "Approve"}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={pending}
                      onClick={() => decide(o, "rejected")}
                    >
                      Reject
                    </Button>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    <Badge tone={r.decision === "approved" ? "green" : "red"}>
                      {outcomeLabel(r.decision, gate, r.status)}
                    </Badge>
                    <p className="text-xs text-muted">
                      Recorded · status now{" "}
                      <span className="font-medium text-foreground">
                        {r.status}
                      </span>
                      . The rep has been notified.
                    </p>
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
