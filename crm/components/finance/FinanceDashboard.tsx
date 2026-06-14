// Finance visual cockpit — the three pitch beats, nothing else. Beat 1 (the
// 3-year quarter-by-quarter forecast) dominates the screen; Beat 2 (device vs
// service, kept separate per brief 2.2) and the small confidence-distribution
// lead-in sit below it. Every figure flows from the same lib/finance/selectors +
// ForecastSummary math the metric strip and the detail grid use, so the visuals
// can never diverge. The metric strip and the deal-list confidence override
// (Beat 3) live in the page; the old report-wall (gap gauge, stage funnel,
// region/industry/channel mix, discount chart) has been cut — none served a beat.

import { Card, SectionTitle } from "@/components/ui";
import { eur } from "@/lib/format";
import {
  BarList,
  Donut,
  StackedRevenueChart,
  CHART,
  type BarItem,
} from "@/components/charts/primitives";
import type { ConfidenceBucket, RevenueSplit } from "@/lib/finance/selectors";

export interface FinanceDashboardData {
  /** Time-phased rows for the selected horizon (drives the Beat 1 chart). */
  rows: { label: string; committed: number; weighted: number }[];
  quarterTargets: number[];
  horizonLabel: string;

  split: RevenueSplit;
  confidence: ConfidenceBucket[];
}

const BAND_COLOR: Record<ConfidenceBucket["band"], string> = {
  low: CHART.bandLow,
  medium: CHART.bandMedium,
  high: CHART.bandHigh,
};

export function FinanceDashboard({ data }: { data: FinanceDashboardData }) {
  const confidenceItems: BarItem[] = data.confidence.map((b) => ({
    label: b.label,
    value: b.value,
    valueLabel: eur(b.value),
    sub: `${b.count} ${b.count === 1 ? "deal" : "deals"}`,
    color: BAND_COLOR[b.band],
  }));

  return (
    <div className="space-y-6">
      {/* BEAT 1 (dominant) — the 3-year forecast, quarter by quarter. This is
          demo step 6 and must read in three seconds: Finance sees the whole
          picture without phoning sales. */}
      <Card className="p-5">
        <SectionTitle>Forecast by quarter · {data.horizonLabel}</SectionTitle>
        <div className="mt-3">
          <StackedRevenueChart rows={data.rows} targets={data.quarterTargets} />
        </div>
        <p className="mt-3 text-sm text-muted">
          Full 3-year forecast, quarter by quarter —{" "}
          <span style={{ color: CHART.committed }}>■</span> committed{" "}
          <span style={{ color: CHART.weighted }}>■</span> at-risk (weighted)
          against the <span style={{ color: CHART.target }}>┄ target</span>.
          Straight from the data, not phoned in from sales.
        </p>
      </Card>

      {/* BEAT 2 — device vs service (kept separate, brief 2.2) ∥ the small
          confidence-distribution lead-in to the override list below. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <SectionTitle>Device vs service revenue</SectionTitle>
          <div className="mt-3">
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
          </div>
          <p className="mt-3 text-xs text-muted">
            Device and service kept separate — service is back-loaded and
            volume-dependent · {data.horizonLabel}.
          </p>
        </Card>

        <Card className="p-4">
          <SectionTitle>Confidence distribution</SectionTitle>
          <div className="mt-3">
            <BarList items={confidenceItems} />
          </div>
          <p className="mt-3 text-xs text-muted">
            Open pipeline by confidence band · {data.horizonLabel} — how much
            value rests on shaky deals. Adjust any of them below.
          </p>
        </Card>
      </div>
    </div>
  );
}
