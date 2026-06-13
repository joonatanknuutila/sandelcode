import {
  getAccounts,
  getAllDeals,
  getOffersByStatus,
  getOpenDeals,
  getWonDeals,
  weightedValue,
} from "@/lib/db";
import { confidence } from "@/lib/ai/confidence";
import { Deal, STAGE_PROBABILITY } from "@/lib/types";
import { eur, quarterLabel } from "@/lib/format";
import { SectionTitle, StatTile } from "@/components/ui";
import { OfferApproval, OfferVM } from "@/components/OfferApproval";
import { ConfidenceOverride, DealConfidenceVM } from "./ConfidenceOverride";

// Finance — reads the pipeline without asking sales: a weighted vs committed
// forecast, time-phased across 3 years, the confidence override that drives
// hardware ordering, and the second discount-approval gate.

const YEARS = [0, 1, 2] as const;
const QUARTERS = [1, 2, 3, 4] as const;

interface QuarterRow {
  label: string;
  committed: number;
  weighted: number;
}

function buildForecast(open: Deal[], won: Deal[]): QuarterRow[] {
  const rows: QuarterRow[] = [];
  for (const year of YEARS) {
    for (const quarter of QUARTERS) {
      const at = (d: { year: number; quarter: number }) =>
        d.year === year && d.quarter === quarter;
      const committed = won.reduce((s, d) => {
        const p = d.forecast.find(at);
        return s + (p ? p.deviceRevenue + p.serviceRevenue : 0);
      }, 0);
      const weighted = open.reduce((s, d) => {
        const p = d.forecast.find(at);
        const q = p ? p.deviceRevenue + p.serviceRevenue : 0;
        return s + q * STAGE_PROBABILITY[d.stage];
      }, 0);
      rows.push({
        label: quarterLabel(year, quarter),
        committed,
        weighted: Math.round(weighted),
      });
    }
  }
  return rows;
}

export default async function FinanceView() {
  const [allDeals, open, won, pendingOffers, accounts] = await Promise.all([
    getAllDeals(),
    getOpenDeals(),
    getWonDeals(),
    getOffersByStatus("pending_finance"),
    getAccounts(),
  ]);
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const dealById = new Map(allDeals.map((d) => [d.id, d]));

  const committed = won.reduce((s, d) => s + d.tcv, 0);
  const weighted = open.reduce((s, d) => s + weightedValue(d), 0);
  const rows = buildForecast(open, won);
  const totals = rows.reduce(
    (acc, r) => ({
      committed: acc.committed + r.committed,
      weighted: acc.weighted + r.weighted,
    }),
    { committed: 0, weighted: 0 },
  );

  const pendingApprovals: OfferVM[] = pendingOffers.map((o) => {
    const account = accountById.get(o.accountId);
    const deal = dealById.get(o.dealId);
    return {
      id: o.id,
      accountName: account?.name ?? "Unknown account",
      dealName: deal?.name ?? "—",
      version: o.version,
      total: o.total,
      maxDiscountPct: Math.max(0, ...o.lines.map((l) => l.discountPct)),
      justification: o.justification,
    };
  });

  const confidenceVMs: DealConfidenceVM[] = open.map((d) => {
    const c = confidence(d);
    const account = accountById.get(d.accountId);
    return {
      dealId: d.id,
      dealName: d.name,
      accountName: account?.name ?? "Unknown account",
      tcv: d.tcv,
      base: c.base,
      score: c.score,
      band: c.band,
      reasons: c.reasons,
    };
  });

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Forecast</h1>
        <p className="mt-1 text-sm text-muted">
          Weighted vs committed revenue across {allDeals.length} deals — time-phased
          over 3 years, no need to ask sales.
        </p>
      </div>

      {/* Headline forecast numbers */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatTile
          label="Committed (won)"
          value={eur(committed)}
          hint="certain, time-phased"
          tone="success"
        />
        <StatTile
          label="Weighted pipeline"
          value={eur(weighted)}
          hint="probability-adjusted, at-risk"
        />
        <StatTile
          label="Forecast total"
          value={eur(committed + weighted)}
          hint="committed + weighted"
        />
      </div>

      {/* Time-phased forecast grid */}
      <section>
        <SectionTitle>Time-phased forecast (3 years)</SectionTitle>
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-background text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Quarter</th>
                <th className="px-3 py-2 text-right font-medium">Committed €</th>
                <th className="px-3 py-2 text-right font-medium">
                  Weighted (at-risk) €
                </th>
                <th className="px-3 py-2 text-right font-medium">Total €</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-t border-border">
                  <td className="px-3 py-1.5 text-muted">{r.label}</td>
                  <td className="px-3 py-1.5 text-right text-success">
                    {r.committed ? eur(r.committed) : "—"}
                  </td>
                  <td className="px-3 py-1.5 text-right text-muted">
                    {r.weighted ? eur(r.weighted) : "—"}
                  </td>
                  <td className="px-3 py-1.5 text-right font-medium">
                    {eur(r.committed + r.weighted)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-background font-semibold">
                <td className="px-3 py-2">3-year total</td>
                <td className="px-3 py-2 text-right">{eur(totals.committed)}</td>
                <td className="px-3 py-2 text-right">{eur(totals.weighted)}</td>
                <td className="px-3 py-2 text-right">
                  {eur(totals.committed + totals.weighted)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* Discount approvals — second gate (locks the offer) */}
      <OfferApproval offers={pendingApprovals} gate="finance" />

      {/* Confidence override — drives hardware ordering */}
      <section>
        <SectionTitle>Confidence — Finance override</SectionTitle>
        <p className="mb-3 -mt-1 text-xs text-muted">
          Rules compute the score; you adjust the realistic number. The override
          is what feeds gap-to-target and ordering.
        </p>
        <ConfidenceOverride deals={confidenceVMs} />
      </section>
    </div>
  );
}
