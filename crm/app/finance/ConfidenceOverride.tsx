"use client";

// Beat 3 — the crown jewel. "Finance doesn't just look — it decides."
//
// A list of opportunities, riskiest first. Each row shows the §0 single
// confidence representation (ConfidenceMeter — a % with a small bar + a "Why?"
// rule explanation), the stage and the deal value. Clicking "Override" opens
// the editor: the rule confidence (e.g. 80%), a manual value Finance sets (e.g.
// 65%) and a REQUIRED free-text reason ("this customer has delayed before").
// BOTH values are stored (saveOverrideAction) and shown — the override is what
// feeds gap-to-target and component ordering. Finance can also ping the rep.
// Pattern D: rules compute the score, the human (not AI) judges the number.

import { useState, useTransition } from "react";
import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import type { ConfidenceBand } from "@/lib/confidence";
import { eur } from "@/lib/format";
import { CONFIDENCE } from "@/lib/scoring";
import { Badge, Button, Card } from "@/components/ui";
import { toast } from "@/components/ui-client";
import { pingRepAction, saveOverrideAction } from "./actions";

export interface DealConfidenceVM {
  dealId: string;
  dealName: string;
  accountName: string;
  stageLabel: string;
  tcv: number;
  /** Stage win-probability baseline (0–100). */
  base: number;
  /** Rule confidence (0–100) — the "AI says 80%" figure. */
  score: number;
  band: ConfidenceBand;
  reasons: string[];
  /** Stored Finance override (from getConfidenceOverrides), if any. */
  storedOverride?: number;
  storedReason?: string;
}

function bandFor(score: number): ConfidenceBand {
  if (score < CONFIDENCE.band.lowMax) return "low";
  if (score < CONFIDENCE.band.mediumMax) return "medium";
  return "high";
}

interface DraftState {
  value: string;
  reason: string;
}

export function ConfidenceOverride({ deals }: { deals: DealConfidenceVM[] }) {
  // Which deal's override editor is open. Click a row to toggle it.
  const [openId, setOpenId] = useState<string | null>(null);
  // Working draft per deal; seeded from the STORED override so editing starts
  // from what's persisted, not a blank box.
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
        toast("Override saved — feeds gap-to-target & ordering", {
          variant: "success",
        });
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

  if (deals.length === 0) {
    return (
      <p className="text-sm text-muted">No open deals to adjust right now.</p>
    );
  }

  return (
    <div className="space-y-3">
      {deals.map((d) => {
        const open = openId === d.dealId;
        const hasStored = d.storedOverride != null;
        // Effective number feeding the forecast: stored override if present.
        const effective = d.storedOverride ?? d.score;
        const effectiveBand = hasStored ? bandFor(effective) : d.band;
        const weighted = Math.round((effective / 100) * d.tcv);

        const draftFor = draft[d.dealId];
        const valueStr =
          draftFor?.value ??
          (d.storedOverride != null ? String(d.storedOverride) : "");
        const reasonStr = draftFor?.reason ?? d.storedReason ?? "";
        const draftNum =
          valueStr !== ""
            ? Math.max(0, Math.min(100, Number(valueStr)))
            : undefined;
        const dirty =
          draftFor != null &&
          (draftNum !== d.storedOverride ||
            reasonStr.trim() !== (d.storedReason ?? "").trim());
        const canSave =
          draftNum != null && reasonStr.trim() !== "" && dirty && !pending;
        const isBusy = busyId === d.dealId && pending;

        return (
          <Card key={d.dealId} className="p-4">
            {/* Row — account · stage · confidence (§0 representation) · value */}
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
              <div className="min-w-[10rem]">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">{d.accountName}</p>
                  <Badge>{d.stageLabel}</Badge>
                </div>
                <p className="text-xs text-muted">
                  {d.dealName} · {eur(d.tcv)}
                </p>
              </div>

              <div className="flex items-center gap-4">
                <ConfidenceMeter
                  score={effective}
                  band={effectiveBand}
                  reasons={d.reasons}
                  showLabel={false}
                  size="sm"
                />
                <Button
                  variant={open ? "secondary" : "primary"}
                  type="button"
                  onClick={() => setOpenId(open ? null : d.dealId)}
                >
                  {open ? "Close" : hasStored ? "Edit override" : "Override"}
                </Button>
              </div>
            </div>

            {/* Stored Finance override — both values shown (rule → override). */}
            {hasStored && (
              <p className="mt-2 text-xs text-foreground">
                <Badge tone="blue">Finance override</Badge>{" "}
                {d.storedOverride !== d.score && (
                  <span className="ml-1 text-muted line-through">{d.score}%</span>
                )}{" "}
                <span className="font-medium">{d.storedOverride}%</span>
                {d.storedReason ? (
                  <span className="text-muted"> — “{d.storedReason}”</span>
                ) : null}
              </p>
            )}

            {/* Override editor — Finance's manual judgment + reason (persisted). */}
            {open && (
              <div className="mt-3 rounded-lg bg-background p-3">
                <p className="text-xs text-muted">
                  Rule confidence is{" "}
                  <span className="font-semibold text-foreground">
                    {d.score}%
                  </span>{" "}
                  (stage baseline {d.base}% + recency, channel & timing). Set the
                  realistic number — your override drives component ordering and
                  gap-to-target.
                </p>
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <label className="text-xs">
                    <span className="block text-muted">Override %</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={valueStr}
                      placeholder={String(d.score)}
                      onChange={(e) =>
                        set(d.dealId, { value: e.target.value }, d)
                      }
                      className="mt-1 w-20 rounded-md border border-border bg-surface px-2 py-1 text-sm focus:border-hmd-teal-600 focus:outline-none focus:ring-1 focus:ring-hmd-teal-600"
                    />
                  </label>
                  <label className="min-w-[12rem] flex-1 text-xs">
                    <span className="block text-muted">Reason (required)</span>
                    <input
                      type="text"
                      value={reasonStr}
                      placeholder="e.g. this customer has delayed before"
                      onChange={(e) =>
                        set(d.dealId, { reason: e.target.value }, d)
                      }
                      className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1 text-sm focus:border-hmd-teal-600 focus:outline-none focus:ring-1 focus:ring-hmd-teal-600"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={!canSave}
                    onClick={() =>
                      draftNum != null && save(d, draftNum, reasonStr)
                    }
                    className="rounded-md bg-hmd-teal px-3.5 py-2 text-sm font-medium text-hmd-teal-700 transition-colors hover:bg-hmd-teal/90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isBusy ? "Saving…" : hasStored ? "Update" : "Save override"}
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
                {draftNum != null && (
                  <p className="mt-2 text-xs text-muted">
                    At {draftNum}% this deal weighs {eur(Math.round((draftNum / 100) * d.tcv))}{" "}
                    of {eur(d.tcv)}{" "}
                    {!hasStored && draftNum !== d.score
                      ? `(rule says ${eur(weighted)})`
                      : ""}
                    .
                  </p>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
