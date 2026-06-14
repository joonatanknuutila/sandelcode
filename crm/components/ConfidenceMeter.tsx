"use client";

// One confidence representation for the whole rep surface (§0.2). A label
// ("Confidence"), a percentage, and a small bar coloured by band — identical
// everywhere a deal appears. `why` (optional) adds an expandable rule-based
// explanation, used on the deal page (§4 "Why?").

import { useState } from "react";
import type { ConfidenceBand } from "@/lib/confidence";

const BAND_BAR: Record<ConfidenceBand, string> = {
  low: "bg-danger",
  medium: "bg-warning",
  high: "bg-hmd-teal-600",
};

export function ConfidenceMeter({
  score,
  band,
  reasons,
  showLabel = true,
  size = "md",
  className = "",
}: {
  score: number;
  band: ConfidenceBand;
  /** When provided, a "Why?" toggle reveals these drivers. */
  reasons?: string[];
  showLabel?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const sm = size === "sm";
  const barW = sm ? "w-16" : "w-24";
  const barH = sm ? "h-1.5" : "h-2";
  const text = sm ? "text-xs" : "text-sm";

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        {showLabel && (
          <span className={`font-medium uppercase tracking-wide text-muted ${sm ? "text-[11px]" : "text-xs"}`}>
            Confidence
          </span>
        )}
        <div className={`relative ${barW} ${barH} overflow-hidden rounded-full bg-border`}>
          <div
            className={`absolute inset-y-0 left-0 rounded-full ${BAND_BAR[band]}`}
            style={{ width: `${Math.max(4, Math.min(100, score))}%` }}
          />
        </div>
        <span className={`font-semibold tabular-nums text-foreground ${text}`}>{Math.round(score)}%</span>
        {reasons && reasons.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={`rounded text-muted underline-offset-2 hover:text-foreground hover:underline ${sm ? "text-[11px]" : "text-xs"}`}
            aria-expanded={open}
          >
            Why?
          </button>
        )}
      </div>
      {open && reasons && reasons.length > 0 && (
        <ul className="mt-2 space-y-1 rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted">
          {reasons.map((r, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-muted" />
              <span>{r}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
