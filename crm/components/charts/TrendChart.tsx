"use client";

// TrendChart — two trailing-window lines (opened vs resolved) over a shared
// scale, with a soft area under "resolved". Moving the cursor snaps a guide
// line to the nearest day and floats a tooltip with both counts.

import { useState } from "react";
import { ChartTip } from "./ChartTooltip";
import { shortDate } from "@/lib/format";

export interface TrendPoint {
  date: string; // YYYY-MM-DD
  opened: number;
  resolved: number;
}

const W = 640;
const H = 200;
const PAD_X = 10;
const PAD_Y = 18;

export function TrendChart({
  points,
  openedColor,
  resolvedColor,
}: {
  points: TrendPoint[];
  openedColor: string;
  resolvedColor: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const n = points.length;
  const max = Math.max(1, ...points.map((p) => Math.max(p.opened, p.resolved)));

  const x = (i: number) => PAD_X + (i / Math.max(1, n - 1)) * (W - PAD_X * 2);
  const y = (v: number) => H - PAD_Y - (v / max) * (H - PAD_Y * 2);

  const path = (key: "opened" | "resolved") =>
    points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p[key]).toFixed(1)}`)
      .join(" ");
  const resolvedArea = `${path("resolved")} L ${x(n - 1).toFixed(1)} ${H - PAD_Y} L ${x(0).toFixed(1)} ${H - PAD_Y} Z`;

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const i = Math.round(ratio * (n - 1));
    setActive(Math.max(0, Math.min(n - 1, i)));
  }

  const p = active != null ? points[active] : null;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        onMouseMove={handleMove}
        onMouseLeave={() => setActive(null)}
        role="img"
        aria-label="Cases opened versus resolved per day"
      >
        <defs>
          <linearGradient id="trend-resolved-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={resolvedColor} stopOpacity={0.22} />
            <stop offset="100%" stopColor={resolvedColor} stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Baseline. */}
        <line
          x1={PAD_X}
          y1={H - PAD_Y}
          x2={W - PAD_X}
          y2={H - PAD_Y}
          stroke="var(--border)"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />

        <path d={resolvedArea} fill="url(#trend-resolved-fill)" stroke="none" />
        <path
          d={path("resolved")}
          fill="none"
          stroke={resolvedColor}
          strokeWidth={2}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={path("opened")}
          fill="none"
          stroke={openedColor}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeDasharray="4 3"
          vectorEffect="non-scaling-stroke"
        />

        {/* Hover guide + markers. */}
        {active != null && (
          <>
            <line
              x1={x(active)}
              y1={PAD_Y - 8}
              x2={x(active)}
              y2={H - PAD_Y}
              stroke="var(--muted)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <circle cx={x(active)} cy={y(points[active].resolved)} r={3.5} fill={resolvedColor} />
            <circle cx={x(active)} cy={y(points[active].opened)} r={3.5} fill={openedColor} />
          </>
        )}
      </svg>

      {p && active != null && (
        <ChartTip x={`${(x(active) / W) * 100}%`} y={`${(PAD_Y / H) * 100}%`}>
          <div className="font-medium">{shortDate(`${p.date}T00:00:00Z`)}</div>
          <div className="mt-0.5 flex gap-3">
            <span style={{ color: openedColor }}>{p.opened} opened</span>
            <span style={{ color: resolvedColor }}>{p.resolved} resolved</span>
          </div>
        </ChartTip>
      )}
    </div>
  );
}
