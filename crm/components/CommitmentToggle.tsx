"use client";

// "Has the customer agreed to buy a set number of phones?" — an optional, per-
// deal commitment toggle. Early-stage deals needn't have one; once the customer
// commits, the rep flips it on and records the quantity. The number is stored on
// the deal (committed_quantity) and logged to the timeline.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input } from "@/components/ui";
import { toast } from "@/components/ui-client";
import { setCommitmentAction } from "@/app/rep/actions";

export function CommitmentToggle({
  dealId,
  accountId,
  initialQuantity,
}: {
  dealId: string;
  accountId: string;
  initialQuantity?: number;
}) {
  const router = useRouter();
  const [on, setOn] = useState(initialQuantity != null && initialQuantity > 0);
  const [qty, setQty] = useState(
    initialQuantity != null && initialQuantity > 0 ? String(initialQuantity) : "",
  );
  const [pending, start] = useTransition();

  function persist(quantity: number | null) {
    start(async () => {
      const res = await setCommitmentAction({ dealId, accountId, quantity });
      if (res.ok) {
        toast(
          quantity != null ? "Commitment saved" : "Commitment cleared",
          { variant: "success" },
        );
        router.refresh();
      } else {
        toast(res.error ?? "Couldn't update the commitment", { variant: "error" });
      }
    });
  }

  function toggle() {
    const next = !on;
    setOn(next);
    if (!next) {
      setQty("");
      persist(null); // turning off clears the commitment immediately
    }
  }

  function save() {
    const n = parseInt(qty, 10);
    if (!Number.isFinite(n) || n <= 0) {
      toast("Enter how many devices they agreed to buy", { variant: "error" });
      return;
    }
    persist(n);
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-base font-semibold">Customer commitment</p>
          <p className="mt-0.5 text-sm text-muted">
            Have they agreed to buy a set number of phones? Not needed early on.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          onClick={toggle}
          disabled={pending}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
            on ? "bg-hmd-teal" : "bg-border"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
              on ? "left-0.5 translate-x-5" : "left-0.5"
            }`}
          />
        </button>
      </div>

      {on && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="w-40">
            <Input
              label="Phones agreed"
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="e.g. 300"
            />
          </div>
          <Button type="button" onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
          {initialQuantity != null && initialQuantity > 0 && (
            <span className="pb-2.5 text-sm text-muted">
              Currently agreed: {initialQuantity}
            </span>
          )}
        </div>
      )}
    </Card>
  );
}
