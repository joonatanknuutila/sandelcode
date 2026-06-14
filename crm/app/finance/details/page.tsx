import Link from "next/link";
import {
  getConfidenceOverrides,
  getOpenDeals,
  getTargets,
  getWonDeals,
} from "@/lib/db";
import { Deal, dealProbability } from "@/lib/types";
import { eur, num, quarterLabel } from "@/lib/format";
import { SectionTitle } from "@/components/ui";
import {
  HORIZON_QUARTERS,
  Horizon,
  PERIOD_OPTIONS,
} from "@/components/ForecastSummary";
import { TargetImport } from "@/components/finance/TargetImport";

const YEARS = [0, 1, 2] as const;
const QUARTERS = [1, 2, 3, 4] as const;

interface QuarterRow {
  label: string;
  offset: number;
  committed: number;
  weighted: number;
  devices: number;
}

function parseHorizon(raw: string | undefined): Horizon {
  if (raw === "quarter" || raw === "half" || raw === "year" || raw === "all")
    return raw;
  return "all";
}

function href(horizon: Horizon): string {
  return horizon === "all"
    ? "/finance/details"
    : `/finance/details?horizon=${horizon}`;
}

function effectiveConfidence(
  deal: Deal,
  overrides: Record<string, { value: number }>,
): number {
  const override = overrides[deal.id];
  if (override && typeof override.value === "number") {
    return Math.max(0, Math.min(100, override.value)) / 100;
  }
  return dealProbability(deal);
}

function buildForecast(
  open: Deal[],
  won: Deal[],
  overrides: Record<string, { value: number }>,
): QuarterRow[] {
  const rows: QuarterRow[] = [];
  let offset = 0;

  for (const year of YEARS) {
    for (const quarter of QUARTERS) {
      const at = (point: { year: number; quarter: number }) =>
        point.year === year && point.quarter === quarter;
      const committed = won.reduce((sum, deal) => {
        const point = deal.forecast.find(at);
        return sum + (point ? point.deviceRevenue + point.serviceRevenue : 0);
      }, 0);
      const weighted = open.reduce((sum, deal) => {
        const point = deal.forecast.find(at);
        const value = point ? point.deviceRevenue + point.serviceRevenue : 0;
        return sum + value * effectiveConfidence(deal, overrides);
      }, 0);
      const devices = [...won, ...open].reduce((sum, deal) => {
        const point = deal.forecast.find(at);
        return sum + (point ? point.devices : 0);
      }, 0);

      rows.push({
        label: quarterLabel(year, quarter),
        offset,
        committed,
        weighted: Math.round(weighted),
        devices,
      });
      offset += 1;
    }
  }

  return rows;
}

export default async function FinanceDetailsPage({
  searchParams,
}: {
  searchParams: Promise<{ horizon?: string }>;
}) {
  const sp = await searchParams;
  const horizon = parseHorizon(sp.horizon);
  const window = HORIZON_QUARTERS[horizon];
  const [open, won, targets, overrides] = await Promise.all([
    getOpenDeals(),
    getWonDeals(),
    getTargets(),
    getConfidenceOverrides(),
  ]);
  const rows = buildForecast(open, won, overrides).filter(
    (row) => row.offset < window,
  );
  const totals = rows.reduce(
    (acc, row) => ({
      committed: acc.committed + row.committed,
      weighted: acc.weighted + row.weighted,
      devices: acc.devices + row.devices,
    }),
    { committed: 0, weighted: 0, devices: 0 },
  );
  const targetTotal = targets
    .slice(0, window)
    .reduce((sum, target) => sum + target.amountEur, 0);

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Forecast details
        </h1>
        <p className="mt-1 text-sm text-muted">
          The exact quarter grid behind the Forecast dashboard, plus target CSV
          import.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">
          Period
        </span>
        <div className="flex overflow-hidden rounded-lg border border-border">
          {PERIOD_OPTIONS.map((opt) => (
            <Link
              key={opt.value}
              href={href(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                horizon === opt.value
                  ? "bg-hmd-teal text-hmd-teal-700"
                  : "bg-surface text-muted hover:bg-background"
              }`}
            >
              {opt.label}
            </Link>
          ))}
        </div>
      </div>

      <section>
        <SectionTitle>Time-phased forecast · {rows.length} quarters</SectionTitle>
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-background text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Quarter</th>
                <th className="px-3 py-2 text-right font-medium">
                  Committed €
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  Weighted €
                </th>
                <th className="px-3 py-2 text-right font-medium">Total €</th>
                <th className="px-3 py-2 text-right font-medium">Target €</th>
                <th className="px-3 py-2 text-right font-medium">
                  Device units
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-t border-border">
                  <td className="px-3 py-1.5 text-muted">{row.label}</td>
                  <td className="px-3 py-1.5 text-right text-success">
                    {row.committed ? eur(row.committed) : "—"}
                  </td>
                  <td className="px-3 py-1.5 text-right text-muted">
                    {row.weighted ? eur(row.weighted) : "—"}
                  </td>
                  <td className="px-3 py-1.5 text-right font-medium">
                    {eur(row.committed + row.weighted)}
                  </td>
                  <td className="px-3 py-1.5 text-right text-muted">
                    {targets[row.offset] ? eur(targets[row.offset].amountEur) : "—"}
                  </td>
                  <td className="px-3 py-1.5 text-right text-foreground">
                    {row.devices ? num(row.devices) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-background font-semibold">
                <td className="px-3 py-2">Horizon total</td>
                <td className="px-3 py-2 text-right">{eur(totals.committed)}</td>
                <td className="px-3 py-2 text-right">{eur(totals.weighted)}</td>
                <td className="px-3 py-2 text-right">
                  {eur(totals.committed + totals.weighted)}
                </td>
                <td className="px-3 py-2 text-right">{eur(targetTotal)}</td>
                <td className="px-3 py-2 text-right">{num(totals.devices)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">
          Device units = committed + open pipeline shipping per quarter.
          Weighted uses each deal&apos;s Finance override when one is set.
        </p>
      </section>

      <TargetImport />
    </div>
  );
}
