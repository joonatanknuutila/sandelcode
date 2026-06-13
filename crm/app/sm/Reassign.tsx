"use client";

// Inline reassign control (SM M3). A compact <Select> of reps on each board
// card and each stalled row; changing it reassigns the deal and notifies both
// the old and the new owner. After the action revalidates /sm, the owner
// initials on the board update to the new rep.

import { useTransition } from "react";
import { Select } from "@/components/ui";
import { toast } from "@/components/ui-client";
import { reassignDealAction } from "./actions";

export interface RepOption {
  value: string;
  label: string;
}

export function Reassign({
  dealId,
  currentOwnerId,
  reps,
}: {
  dealId: string;
  currentOwnerId: string;
  reps: RepOption[];
}) {
  const [pending, startTransition] = useTransition();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newOwnerId = e.target.value;
    if (!newOwnerId || newOwnerId === currentOwnerId) return;
    startTransition(async () => {
      try {
        await reassignDealAction(dealId, newOwnerId);
        toast("Reassigned — both reps notified", { variant: "success" });
      } catch {
        toast("Could not reassign the deal", { variant: "error" });
      }
    });
  }

  return (
    <Select
      aria-label="Reassign to rep"
      value={currentOwnerId}
      onChange={onChange}
      disabled={pending}
      options={reps}
      className="px-2 py-1 text-xs"
    />
  );
}
