"use client";

// Finance confidence override (brief Stage 5 — the forecast crown jewel).
// Rule logic computes the score (lib/ai/confidence.ts, transparent, not a model);
// Finance overrides the realistic number with a free-text reason. The override
// is PERSISTED (saveOverrideAction) and is what feeds gap-to-target — both the
// rule value and Finance's stored override are shown. Finance can also ping the
// rep to ask why the forecast looks light. Pattern D: rules compute, the human
// (not AI) judges the number.

import { useState, useTransition } from "react";
import { ConfidenceBand } from "@/lib/ai/confidence";
import { eur } from "@/lib/format";
import { Badge, Button, Card } from "@/components/ui";
import { toast } from "@/components/ui-client";
import { pingRepAction, saveOverrideAction } from "./actions";

export interface DealConfidenceVM {
  dealId: string;
  dealName: string;
  accountName: string;
  tcv: number;
  base: number;
  score: number;
  band: ConfidenceBand;
  reasons: string[];
  /** Stored Finance override (from getConfidenceOverrides), if any. */
  storedOverride?: number;
  storedReason?: string;
}

const BAND_TONE: Record<ConfidenceBand, "green" | "amber" | "red"> = {
  high: "green",
  medium: "amber",
  low: "red",
};

interface DraftState {
  value: string;
  reason: string;
}

export function ConfidenceOverride({ deals }: { deals: DealConfidenceVM[] }) {
  // Working draft per deal; defaults seeded from the STORED override so editing
  // starts from what's persisted, not a blank box.
  const [draft, setDraft] = useState<Record<string, DraftState>>({});
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function set(id: string, patch: Partial<DraftState>, d: DealConfidenceVM) {
    setDraft((prev) => {
      const base: DraftState = prev[id] ?? {
        value: d.storedOverride != null ? String(d.storedOverride) : "",
        reason: d.storedReason ?? "",
      };
      return { ...prev, [id]: { ...base, ...patch } };
    });
  }

  function save(d: DealConfidenceVM, value: number, reason: string) {
    setBusyId(d.dealId);
    startTransition(async () => {
      try {
        await saveOverrideAction({ dealId: d.dealId, value, reason });
        toast("Override saved — feeds gap-to-target", { variant: "success" });
      } catch {
        toast("Could not save override", { variant: "error" });
      } finally {
        setBusyId(null);
      }
    });
  }

  function ping(d: DealConfidenceVM) {
    setBusyId(d.dealId);
    startTransition(async () => {
      try {
        await pingRepAction({ dealId: d.dealId });
        toast(`Asked the rep about ${d.dealName}`, { variant: "success" });
      } catch {
        toast("Could not reach the rep", { variant: "error" });
      } finally {
        setBusyId(null);
      }
    });
  }

  return (
    <div className="space-y-3">
      {deals.map((d) => {
        const draftFor = draft[d.dealId];
        const valueStr =
          draftFor?.value ??
          (d.storedOverride != null ? String(d.storedOverride) : "");
        const reasonStr = draftFor?.reason ?? d.storedReason ?? "";
        const draftNum =
          valueStr !== ""
            ? Math.max(0, Math.min(100, Number(valueStr)))
            : undefined;

        // The effective number feeding the forecast: stored override if present.
        const effective = d.storedOverride ?? d.score;
        const weighted = Math.round((effective / 100) * d.tcv);
        const hasStored = d.storedOverride != null;
        const dirty =
          draftFor != null &&
          (draftNum !== d.storedOverride ||
            reasonStr.trim() !== (d.storedReason ?? "").trim());
        const canSave =
          draftNum != null && reasonStr.trim() !== "" && dirty && !pending;
        const isBusy = busyId === d.dealId && pending;

        return (
          <Card key={d.dealId} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{d.accountName}</p>
                <p className="text-xs text-muted">{d.dealName}</p>
              </div>
              <div className="text-right">
                <div className="flex items-center justify-end gap-2">
                  {hasStored && d.storedOverride !== d.score && (
                    <span className="text-xs text-muted line-through">
                      {d.score}%
                    </span>
                  )}
                  <Badge tone={BAND_TONE[d.band]}>{effective}% confidence</Badge>
                </div>
                <p className="mt-1 text-xs text-muted">
                  weighted {eur(weighted)} of {eur(d.tcv)}
                </p>
              </div>
            </div>

            {/* Stored Finance override — sourced from the persisted value. */}
            {hasStored && (
              <p className="mt-2 text-xs text-foreground">
                <Badge tone="blue">Finance override</Badge>{" "}
                <span className="ml-1">
                  {d.storedOverride}%
                  {d.storedReason ? ` — “${d.storedReason}”` : ""}
                </span>
              </p>
            )}

            {/* Why — the rule reasoning, so Finance trusts the number. */}
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-medium text-hmd-teal-700">
                Why {d.score}%? (rule logic)
              </summary>
              <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-muted">
                {d.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </details>

            {/* Override — Finance's manual judgment + reason (persisted). */}
            <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg bg-background p-3">
              <label className="text-xs">
                <span className="block text-muted">Override %</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={valueStr}
                  placeholder={String(d.score)}
                  onChange={(e) => set(d.dealId, { value: e.target.value }, d)}
                  className="mt-1 w-20 rounded-md border border-border bg-surface px-2 py-1 text-sm focus:border-hmd-teal-600 focus:outline-none focus:ring-1 focus:ring-hmd-teal-600"
                />
              </label>
              <label className="min-w-[12rem] flex-1 text-xs">
                <span className="block text-muted">Reason</span>
                <input
                  type="text"
                  value={reasonStr}
                  placeholder="e.g. this customer has delayed before"
                  onChange={(e) => set(d.dealId, { reason: e.target.value }, d)}
                  className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1 text-sm focus:border-hmd-teal-600 focus:outline-none focus:ring-1 focus:ring-hmd-teal-600"
                />
              </label>
              <button
                type="button"
                disabled={!canSave}
                onClick={() =>
                  draftNum != null && save(d, draftNum, reasonStr)
                }
                className="rounded-lg bg-hmd-teal-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-hmd-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isBusy ? "Saving…" : hasStored ? "Update override" : "Save override"}
              </button>
              <Button
                variant="secondary"
                type="button"
                disabled={pending}
                onClick={() => ping(d)}
              >
                Ping rep
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
