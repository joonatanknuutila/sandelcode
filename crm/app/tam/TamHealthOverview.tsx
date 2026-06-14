import { Card, SectionTitle } from "@/components/ui";
import { Donut } from "@/components/charts/Donut";
import { TrendChart } from "@/components/charts/TrendChart";
import { HBars } from "@/components/charts/HBars";
import { StackedBar } from "@/components/charts/StackedBar";
import { ChartLegend } from "@/components/charts/ChartTooltip";
import {
  caseFlow,
  openByAccount,
  priorityMix,
  resolutionStats,
  slaBreakdown,
  type SlaSegmentKey,
} from "@/lib/tam";
import { Account, Case, CasePriority } from "@/lib/types";

// TamHealthOverview — the visual "what's happening" band at the top of the TAM
// dashboard. A server component: it shapes the already-fetched cases/accounts
// into chart datasets, assigns brand colours, and hands them to the SVG charts.
// The interactive bits (Donut, TrendChart) are client islands; the bar charts
// hover with pure CSS.

const TREND_DAYS = 21;

const SLA_COLORS: Record<SlaSegmentKey, string> = {
  breach: "var(--danger)",
  soon: "var(--warning)",
  ok: "var(--hmd-teal)",
  none: "var(--muted)",
};
const SLA_LABELS: Record<SlaSegmentKey, string> = {
  breach: "Breached",
  soon: "Due soon",
  ok: "On track",
  none: "No SLA",
};

const PRIORITY_COLORS: Record<CasePriority, string> = {
  urgent: "var(--danger)",
  high: "var(--warning)",
  medium: "var(--hmd-teal)",
  low: "var(--muted)",
};
const PRIORITY_LABELS: Record<CasePriority, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const OPENED_COLOR = "var(--muted)";
const RESOLVED_COLOR = "var(--hmd-teal)";

export function TamHealthOverview({
  cases,
  accounts,
}: {
  cases: Case[];
  accounts: Account[];
}) {
  const sla = slaBreakdown(cases);
  const flow = caseFlow(cases, TREND_DAYS);
  const hotspots = openByAccount(cases, accounts, 6);
  const priorities = priorityMix(cases);
  const resolution = resolutionStats(cases);

  const donutSegments = sla.segments.map((s) => ({
    key: s.key,
    label: SLA_LABELS[s.key],
    value: s.count,
    color: SLA_COLORS[s.key],
  }));

  const hotspotMax = Math.max(1, ...hotspots.map((h) => h.open));
  const hotspotRows = hotspots.map((h) => ({
    id: h.accountId,
    label: h.name,
    total: h.open,
    segments: [
      { key: "breach", label: "breached", value: h.breach, color: SLA_COLORS.breach },
      { key: "soon", label: "due soon", value: h.soon, color: SLA_COLORS.soon },
      { key: "ok", label: "on track", value: h.ok, color: SLA_COLORS.ok },
    ],
  }));

  const prioritySegments = priorities.map((p) => ({
    key: p.priority,
    label: PRIORITY_LABELS[p.priority],
    value: p.count,
    color: PRIORITY_COLORS[p.priority],
  }));

  return (
    <section>
      <SectionTitle>Service health</SectionTitle>

      {/* Row 1 — SLA donut + opened/resolved trend. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-4">
          <h3 className="text-sm font-medium text-foreground">Open SLA health</h3>
          <Donut
            segments={donutSegments}
            centerValue={sla.total > 0 ? `${sla.onTrackPct}%` : "0"}
            centerLabel={sla.total > 0 ? "on track" : "no open cases"}
          />
          <ChartLegend
            items={sla.segments.map((s) => ({
              label: SLA_LABELS[s.key],
              color: SLA_COLORS[s.key],
              value: s.count,
            }))}
          />
        </Card>

        <Card className="p-4 lg:col-span-2">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-medium text-foreground">
              Opened vs. resolved
            </h3>
            <span className="text-xs text-muted">last {TREND_DAYS} days</span>
          </div>
          <div className="mt-3">
            <TrendChart
              points={flow}
              openedColor={OPENED_COLOR}
              resolvedColor={RESOLVED_COLOR}
            />
          </div>
          <ChartLegend
            items={[
              { label: "Opened", color: OPENED_COLOR },
              { label: "Resolved", color: RESOLVED_COLOR },
            ]}
          />
        </Card>
      </div>

      {/* Row 2 — account hotspots + priority mix. */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <h3 className="text-sm font-medium text-foreground">
            Hotspots — open cases by account
          </h3>
          <p className="mb-3 text-xs text-muted">
            Sorted by breaches, then volume. Hover a bar for the SLA split.
          </p>
          <HBars rows={hotspotRows} max={hotspotMax} />
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-medium text-foreground">Priority mix</h3>
          <p className="mb-3 text-xs text-muted">Open queue by urgency.</p>
          <StackedBar segments={prioritySegments} />
          <div className="mt-4 border-t border-border pt-3">
            <p className="text-xs uppercase tracking-wide text-muted">
              Median resolution
            </p>
            <p className="mt-0.5 text-lg font-semibold text-foreground">
              {resolution.medianDays != null ? `${resolution.medianDays}d` : "—"}
              <span className="ml-2 text-xs font-normal text-muted">
                across {resolution.resolvedCount} resolved
              </span>
            </p>
          </div>
        </Card>
      </div>
    </section>
  );
}
