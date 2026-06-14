// Dependency-free chart primitives — server-rendered SVG + CSS, no client JS.
// Extends the codebase's existing "no chart library" stance (see ProportionBar
// in Reports.tsx). Each primitive is presentational: it takes already-computed
// numbers (and pre-formatted value labels for money) and draws them. Brand
// colours live in CHART so every chart stays on the HMD dark theme.

import { Card } from "@/components/ui";

// Explicit hexes (not Tailwind fill-* utilities, which aren't configured) so
// SVG fills are reliable. Aligned with the badge tones already in ui.tsx.
export const CHART = {
  committed: "#2dd4bf", // teal — committed / primary
  weighted: "#fbbf24", // amber — at-risk / weighted
  upside: "#64748b", // slate — upside
  target: "#f87171", // red — target line
  device: "#2dd4bf",
  service: "#818cf8", // indigo
  bandLow: "#64748b",
  bandMedium: "#fbbf24",
  bandHigh: "#34d399", // emerald
  series: ["#2dd4bf", "#38bdf8", "#818cf8", "#a78bfa", "#f472b6", "#fb923c"],
  track: "#1e293b", // slate-800
};

const FG = "#e2e8f0"; // foreground text in SVG
const MUTED = "#94a3b8"; // muted text in SVG

// ---------------------------------------------------------------------------
// Sparkline — a tiny trend line for KPI tiles.
// ---------------------------------------------------------------------------
export function Sparkline({
  values,
  stroke = CHART.committed,
  className = "",
}: {
  values: number[];
  stroke?: string;
  className?: string;
}) {
  if (values.length < 2) return null;
  const w = 100;
  const h = 28;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={`h-7 w-full ${className}`}
      aria-hidden="true"
    >
      <polyline
        points={pts}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// KPI tile — headline number + optional sparkline / delta.
// ---------------------------------------------------------------------------
export function KpiTile({
  label,
  value,
  hint,
  spark,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  spark?: number[];
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "danger"
          ? "text-danger"
          : "text-foreground";
  const sparkStroke =
    tone === "warning" || tone === "danger" ? CHART.weighted : CHART.committed;
  return (
    <Card className="flex flex-col justify-between p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</p>
      {spark && spark.length > 1 && (
        <div className="mt-2">
          <Sparkline values={spark} stroke={sparkStroke} />
        </div>
      )}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Donut — proportion of a whole (device vs service).
// ---------------------------------------------------------------------------
export interface DonutSegment {
  label: string;
  value: number;
  valueLabel: string;
  color: string;
}

export function Donut({
  segments,
  centerLabel,
  centerSub,
}: {
  segments: DonutSegment[];
  centerLabel?: string;
  centerSub?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = 42;
  const C = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 110 110" className="h-28 w-28 shrink-0" role="img">
        <circle cx="55" cy="55" r={r} fill="none" stroke={CHART.track} strokeWidth="14" />
        {segments.map((s, i) => {
          const len = (s.value / total) * C;
          const el = (
            <circle
              key={i}
              cx="55"
              cy="55"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="14"
              strokeDasharray={`${len.toFixed(2)} ${(C - len).toFixed(2)}`}
              strokeDashoffset={(-offset).toFixed(2)}
              transform="rotate(-90 55 55)"
            />
          );
          offset += len;
          return el;
        })}
        {centerLabel && (
          <text x="55" y="53" textAnchor="middle" fill={FG} fontSize="14" fontWeight="700">
            {centerLabel}
          </text>
        )}
        {centerSub && (
          <text x="55" y="68" textAnchor="middle" fill={MUTED} fontSize="9">
            {centerSub}
          </text>
        )}
      </svg>
      <ul className="space-y-1.5">
        {segments.map((s) => {
          const pct = Math.round((s.value / total) * 100);
          return (
            <li key={s.label} className="flex items-center gap-2 text-sm">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: s.color }}
              />
              <span className="text-muted">{s.label}</span>
              <span className="font-medium text-foreground">{s.valueLabel}</span>
              <span className="text-xs text-muted">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gauge — committed + at-risk progress toward a target line.
// ---------------------------------------------------------------------------
export function Gauge({
  committed,
  atRisk,
  target,
}: {
  committed: number;
  atRisk: number;
  target: number;
}) {
  const reach = committed + atRisk;
  const scale = Math.max(target, reach, 1);
  const cW = (committed / scale) * 100;
  const aW = (atRisk / scale) * 100;
  const tX = (target / scale) * 100;
  return (
    <svg viewBox="0 0 100 16" preserveAspectRatio="none" className="h-5 w-full" role="img">
      <rect x="0" y="4" width="100" height="8" rx="4" fill={CHART.track} />
      {cW > 0 && <rect x="0" y="4" width={cW} height="8" rx="4" fill={CHART.committed} />}
      {aW > 0 && <rect x={cW} y="4" width={aW} height="8" fill={CHART.weighted} opacity="0.8" />}
      {target > 0 && (
        <line
          x1={tX}
          y1="0.5"
          x2={tX}
          y2="15.5"
          stroke={CHART.target}
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Stacked revenue chart — committed + weighted per quarter, target overlay.
// ---------------------------------------------------------------------------
export function StackedRevenueChart({
  rows,
  targets,
}: {
  rows: { label: string; committed: number; weighted: number }[];
  targets: number[];
}) {
  const n = rows.length;
  if (n === 0) return <p className="text-sm text-muted">No forecast in range.</p>;
  const max = Math.max(1, ...rows.map((r) => r.committed + r.weighted), ...targets);
  const W = Math.max(240, n * 26);
  const H = 150;
  const padTop = 10;
  const baseY = H - 18; // leave room for x labels
  const plotH = baseY - padTop;
  const slot = W / n;
  const barW = Math.min(18, slot * 0.62);
  const xAt = (i: number) => i * slot + slot / 2;
  const yAt = (v: number) => baseY - (v / max) * plotH;
  const targetPts = targets.map((t, i) => `${xAt(i).toFixed(1)},${yAt(t).toFixed(1)}`).join(" ");
  return (
    <div className={n > 6 ? "overflow-x-auto" : ""}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ minWidth: n > 6 ? "520px" : undefined }}
        role="img"
      >
        {rows.map((r, i) => {
          const cY = yAt(r.committed);
          const wTop = yAt(r.committed + r.weighted);
          const x = xAt(i) - barW / 2;
          return (
            <g key={r.label}>
              {r.committed > 0 && (
                <rect x={x} y={cY} width={barW} height={baseY - cY} fill={CHART.committed} rx="1" />
              )}
              {r.weighted > 0 && (
                <rect x={x} y={wTop} width={barW} height={cY - wTop} fill={CHART.weighted} opacity="0.85" rx="1" />
              )}
              <text x={xAt(i)} y={H - 5} textAnchor="middle" fontSize="7.5" fill={MUTED}>
                {r.label}
              </text>
            </g>
          );
        })}
        {targets.some((t) => t > 0) && (
          <polyline
            points={targetPts}
            fill="none"
            stroke={CHART.target}
            strokeWidth="1.5"
            strokeDasharray="4 3"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Funnel — centered bars, decreasing by value (pipeline by stage).
// ---------------------------------------------------------------------------
export function Funnel({
  stages,
}: {
  stages: { label: string; value: number; count: number; valueLabel: string }[];
}) {
  const max = Math.max(1, ...stages.map((s) => s.value));
  return (
    <div className="space-y-1.5">
      {stages.map((s, i) => {
        const pct = Math.max(4, (s.value / max) * 100);
        return (
          <div key={s.label} className="flex items-center gap-3">
            <span className="w-32 shrink-0 truncate text-sm text-muted" title={s.label}>
              {s.label}
            </span>
            <div className="flex-1">
              <div
                className="mx-auto flex h-6 items-center justify-center rounded text-xs font-semibold text-[#0b1220]"
                style={{ width: `${pct}%`, background: CHART.series[i % CHART.series.length] }}
              >
                {s.count > 0 ? s.count : ""}
              </div>
            </div>
            <span className="w-20 shrink-0 text-right text-sm font-medium text-foreground">
              {s.valueLabel}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BarList — horizontal labelled bars (region mix, confidence distribution).
// ---------------------------------------------------------------------------
export interface BarItem {
  label: string;
  value: number;
  valueLabel: string;
  sub?: string;
  color?: string;
}

export function BarList({ items, color }: { items: BarItem[]; color?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (items.length === 0) return <p className="text-sm text-muted">No data.</p>;
  return (
    <div className="space-y-2.5">
      {items.map((it) => {
        const pct = Math.max(2, (it.value / max) * 100);
        return (
          <div key={it.label}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate text-foreground">
                {it.label}
                {it.sub && <span className="ml-1.5 text-xs text-muted">{it.sub}</span>}
              </span>
              <span className="shrink-0 font-medium text-foreground">{it.valueLabel}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-background">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, background: it.color ?? color ?? CHART.committed }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
