"use client";

// Donut — a zero-dependency ring chart built from dash-offset arcs on a single
// <circle> stack. Hovering a segment dims the others and swaps the centre text
// to that segment's count + share; the centre falls back to a headline figure.

import { useState } from "react";

export interface DonutSegment {
  key: string;
  label: string;
  value: number;
  /** Resolved CSS colour, e.g. "var(--danger)". */
  color: string;
}

export function Donut({
  segments,
  centerValue,
  centerLabel,
}: {
  segments: DonutSegment[];
  centerValue: string;
  centerLabel: string;
}) {
  const [active, setActive] = useState<number | null>(null);

  const total = segments.reduce((s, x) => s + x.value, 0);
  const size = 168;
  const stroke = 22;
  const center = size / 2;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);

  const shown = active != null ? segments[active] : null;
  let offset = 0;

  return (
    <div className="flex items-center justify-center py-1">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="shrink-0"
        role="img"
        aria-label={`${centerValue} ${centerLabel}`}
      >
        {/* Unfilled track. */}
        <circle
          cx={center}
          cy={center}
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
        />
        {total > 0 &&
          segments.map((seg, i) => {
            if (seg.value === 0) return null;
            const len = (seg.value / total) * circumference;
            const dashoffset = -offset;
            offset += len;
            const dim = active != null && active !== i;
            return (
              <circle
                key={seg.key}
                cx={center}
                cy={center}
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth={stroke}
                strokeDasharray={`${len} ${circumference - len}`}
                strokeDashoffset={dashoffset}
                transform={`rotate(-90 ${center} ${center})`}
                className="cursor-pointer transition-opacity duration-150"
                style={{ opacity: dim ? 0.3 : 1 }}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
              />
            );
          })}
        {/* Centre readout. */}
        <text
          x={center}
          y={center - 4}
          textAnchor="middle"
          style={{ fill: "var(--foreground)", fontSize: 28, fontWeight: 600 }}
        >
          {shown ? String(shown.value) : centerValue}
        </text>
        <text
          x={center}
          y={center + 16}
          textAnchor="middle"
          style={{ fill: "var(--muted)", fontSize: 11 }}
        >
          {shown ? `${shown.label} · ${pct(shown.value)}%` : centerLabel}
        </text>
      </svg>
    </div>
  );
}
