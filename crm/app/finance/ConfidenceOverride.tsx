"use client";

// Finance confidence override (brief Stage 5 — the forecast crown jewel).
// Rule logic computes the score (lib/ai/confidence.ts, transparent, not a model);
// Finance can override the realistic number with a free-text reason. Both the
// rule value and Finance's override are kept — the override is what feeds
// gap-to-target. Pattern D: rules compute, the human (not AI) judges the number.

import { useState } from "react";
import { ConfidenceBand } from "@/lib/ai/confidence";
import { eur } from "@/lib/format";
import { Badge, Card } from "@/components/ui";

export interface DealConfidenceVM {
  dealId: string;
  dealName: string;
  accountName: string;
  tcv: number;
  base: number;
  score: number;
  band: ConfidenceBand;
  reasons: string[];
}

const BAND_TONE: Record<ConfidenceBand, "green" | "amber" | "red"> = {
  high: "green",
  medium: "amber",
  low: "red",
};

interface OverrideState {
  value: string;
  reason: string;
  saved: boolean;
}

export function ConfidenceOverride({ deals }: { deals: DealConfidenceVM[] }) {
  const [state, setState] = useState<Record<string, OverrideState>>({});

  function set(id: string, patch: Partial<OverrideState>) {
    setState((prev) => {
      const base: OverrideState = prev[id] ?? {
        value: "",
        reason: "",
        saved: false,
      };
      return { ...prev, [id]: { ...base, ...patch } };
    });
  }

  return (
    <div className="space-y-3">
      {deals.map((d) => {
        const s = state[d.dealId];
        const overrideNum =
          s && s.value !== "" ? Math.max(0, Math.min(100, Number(s.value))) : undefined;
        const effective = s?.saved && overrideNum != null ? overrideNum : d.score;
        const weighted = Math.round((effective / 100) * d.tcv);
        return (
          <Card key={d.dealId} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{d.accountName}</p>
                <p className="text-xs text-muted">{d.dealName}</p>
              </div>
              <div className="text-right">
                <div className="flex items-center justify-end gap-2">
                  {s?.saved && overrideNum != null && overrideNum !== d.score && (
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

            {/* Why — the rule reasoning, so Finance trusts the number */}
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

            {/* Override — Finance's manual judgment + reason */}
            <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg bg-background p-3">
              <label className="text-xs">
                <span className="block text-muted">Override %</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={s?.value ?? ""}
                  placeholder={String(d.score)}
                  onChange={(e) =>
                    set(d.dealId, { value: e.target.value, saved: false })
                  }
                  className="mt-1 w-20 rounded-md border border-border bg-surface px-2 py-1 text-sm focus:border-hmd-teal-600 focus:outline-none focus:ring-1 focus:ring-hmd-teal-600"
                />
              </label>
              <label className="min-w-[12rem] flex-1 text-xs">
                <span className="block text-muted">Reason</span>
                <input
                  type="text"
                  value={s?.reason ?? ""}
                  placeholder="e.g. this customer has delayed before"
                  onChange={(e) =>
                    set(d.dealId, { reason: e.target.value, saved: false })
                  }
                  className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1 text-sm focus:border-hmd-teal-600 focus:outline-none focus:ring-1 focus:ring-hmd-teal-600"
                />
              </label>
              <button
                type="button"
                disabled={!s || s.value === "" || s.reason.trim() === ""}
                onClick={() => set(d.dealId, { saved: true })}
                className="rounded-lg bg-hmd-teal-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-hmd-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Save override
              </button>
            </div>

            {s?.saved && overrideNum != null && (
              <p className="mt-2 text-xs text-foreground">
                <Badge tone="blue">Finance override</Badge>{" "}
                <span className="ml-1">
                  {overrideNum}% — &ldquo;{s.reason}&rdquo;
                </span>
              </p>
            )}
          </Card>
        );
      })}
    </div>
  );
}
