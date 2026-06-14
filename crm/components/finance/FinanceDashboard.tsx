// Finance visual dashboard (Option A — dashboard-first). Presentational: it
// receives already-computed figures from the Finance page and renders the eight
// chart sections. All money figures reconcile with the grid/band because they
// flow from the same lib/finance/selectors + ForecastSummary math.

import Link from "next/link";
import { Card, SectionTitle } from "@/components/ui";
import { eur, num } from "@/lib/format";
import {
  BarList,
  Donut,
  Funnel,
  Gauge,
  KpiTile,
  StackedRevenueChart,
  CHART,
  type BarItem,
} from "@/components/charts/primitives";
import type {
  ConfidenceBucket,
  DimensionSlice,
  DiscountExposure,
  Dimension,
  FunnelStage,
  RevenueSplit,
} from "@/lib/finance/selectors";
import { DIMENSION_LABELS } from "@/lib/finance/selectors";

export interface FinanceDashboardData {
  /** Time-phased rows for the selected horizon (drives the chart + KPI sparks). */
  rows: { label: string; committed: number; weighted: number }[];
  quarterTargets: number[];
  horizonLabel: string;

  forecastTotal: number;
  committed: number;
  atRisk: number;
  target: number;
  gap: number; // target − committed (positive ⇒ shortfall)
  closeRate: number | null;
  wonCount: number;
  lostCount: number;

  split: RevenueSplit;
  funnel: FunnelStage[];

  dim: Dimension;
  dimSlices: DimensionSlice[];
  dimHrefs: Record<Dimension, string>;

  confidence: ConfidenceBucket[];
  discount: DiscountExposure;
}

const BAND_COLOR: Record<ConfidenceBucket["band"], string> = {
  low: CHART.bandLow,
  medium: CHART.bandMedium,
  high: CHART.bandHigh,
};

export function FinanceDashboard({ data }: { data: FinanceDashboardData }) {
  const totalSpark = data.rows.map((r) => r.committed + r.weighted);
  const committedSpark = data.rows.map((r) => r.committed);
  const covered = data.gap <= 0;

  const confidenceItems: BarItem[] = data.confidence.map((b) => ({
    label: b.label,
    value: b.value,
    valueLabel: eur(b.value),
    sub: `${b.count} ${b.count === 1 ? "deal" : "deals"}`,
    color: BAND_COLOR[b.band],
  }));

  const dimItems: BarItem[] = data.dimSlices.map((s) => ({
    label: s.key,
    value: s.value,
    valueLabel: eur(s.value),
    sub: `${s.count}`,
  }));

  const funnelStages = data.funnel.map((s) => ({
    label: s.label,
    value: s.value,
    count: s.count,
    valueLabel: s.value ? eur(s.value) : "—",
  }));

  return (
    <div className="space-y-6">
      {/* 1 — KPI hero row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiTile
          label="Forecast total"
          value={eur(data.forecastTotal)}
          hint="committed + weighted"
          spark={totalSpark}
        />
        <KpiTile
          label="Committed"
          value={eur(data.committed)}
          hint="won, time-phased"
          tone="success"
          spark={committedSpark}
        />
        <KpiTile
          label="Gap to target"
          value={covered ? `+${eur(-data.gap)}` : `−${eur(data.gap)}`}
          hint={`target ${eur(data.target)}`}
          tone={covered ? "success" : "danger"}
        />
        <KpiTile
          label="Close rate"
          value={data.closeRate === null ? "—" : `${data.closeRate}%`}
          hint={`won ${data.wonCount} · lost ${data.lostCount}`}
          tone="success"
        />
      </div>

      {/* 2 — Gap-to-target gauge */}
      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Gap to target · {data.horizonLabel}
          </p>
          <p className={`text-sm font-semibold ${covered ? "text-success" : "text-warning"}`}>
            {covered ? "On / above target" : `Shortfall ${eur(data.gap)}`}
          </p>
        </div>
        <Gauge committed={data.committed} atRisk={data.atRisk} target={data.target} />
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs">
          <Legend swatch={CHART.committed} label="Committed" value={eur(data.committed)} />
          <Legend swatch={CHART.weighted} label="At-risk" value={eur(data.atRisk)} />
          <Legend swatch={CHART.target} label="Target" value={eur(data.target)} line />
        </div>
      </Card>

      {/* 3 — time-phased revenue ∥ device vs service */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <SectionTitle>Revenue by quarter · {data.horizonLabel}</SectionTitle>
          <StackedRevenueChart rows={data.rows} targets={data.quarterTargets} />
          <p className="mt-2 text-xs text-muted">
            <span style={{ color: CHART.committed }}>■</span> committed{" "}
            <span style={{ color: CHART.weighted }}>■</span> weighted (at-risk) · dashed line =
            target
          </p>
        </Card>

        <Card className="p-4">
          <SectionTitle>Device vs service revenue</SectionTitle>
          <Donut
            centerLabel={eur(data.split.device + data.split.service)}
            centerSub="weighted"
            segments={[
              {
                label: "Device",
                value: data.split.device,
                valueLabel: eur(data.split.device),
                color: CHART.device,
              },
              {
                label: "Service",
                value: data.split.service,
                valueLabel: eur(data.split.service),
                color: CHART.service,
              },
            ]}
          />
          <p className="mt-3 text-xs text-muted">
            Kept separate per the brief — service revenue is back-loaded and volume-dependent.
          </p>
        </Card>
      </div>

      {/* 4 — funnel ∥ region mix ∥ confidence distribution */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-4">
          <SectionTitle>Pipeline by stage</SectionTitle>
          <Funnel stages={funnelStages} />
        </Card>

        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-muted">Revenue by</p>
            <div className="flex overflow-hidden rounded-lg border border-border">
              {(Object.keys(DIMENSION_LABELS) as Dimension[]).map((d) => (
                <Link
                  key={d}
                  href={data.dimHrefs[d]}
                  scroll={false}
                  className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                    data.dim === d
                      ? "bg-hmd-teal text-hmd-teal-700"
                      : "bg-surface text-muted hover:bg-background"
                  }`}
                >
                  {DIMENSION_LABELS[d]}
                </Link>
              ))}
            </div>
          </div>
          <BarList items={dimItems} color={CHART.committed} />
          <p className="mt-3 text-xs text-muted">Weighted open pipeline · count after each label.</p>
        </Card>

        <Card className="p-4">
          <SectionTitle>Confidence distribution</SectionTitle>
          <BarList items={confidenceItems} />
          <p className="mt-3 text-xs text-muted">
            Open pipeline (TCV) by confidence band — how much rests on shaky deals.
          </p>
        </Card>
      </div>

      {/* 5 — discount / margin exposure */}
      <Card className="p-4">
        <SectionTitle>Discount / margin exposure</SectionTitle>
        {data.discount.count === 0 ? (
          <p className="text-sm text-muted">Nothing awaiting the Finance gate — no discount exposure right now.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Awaiting approval" value={eur(data.discount.totalValue)} tone="warning" />
            <Stat label="Offers in queue" value={num(data.discount.count)} />
            <Stat label="Avg discount" value={`${data.discount.avgDiscount}%`} />
            <Stat label="Max discount" value={`${data.discount.maxDiscount}%`} tone="danger" />
          </div>
        )}
      </Card>
    </div>
  );
}

function Legend({
  swatch,
  label,
  value,
  line = false,
}: {
  swatch: string;
  label: string;
  value: string;
  line?: boolean;
}) {
  return (
    <span className="flex items-center gap-1.5 text-muted">
      <span
        className={line ? "inline-block h-3 w-0.5" : "inline-block h-2.5 w-2.5 rounded-sm"}
        style={{ background: swatch }}
      />
      {label} <span className="font-medium text-foreground">{value}</span>
    </span>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "warning" | "danger";
}) {
  const toneClass =
    tone === "warning" ? "text-warning" : tone === "danger" ? "text-danger" : "text-foreground";
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}
