import {
  getAccount,
  getAllDeals,
  getDeal,
  getOffersByStatus,
  getTeamSummary,
  getUser,
  isStalled,
  weightedValue,
} from "@/lib/api";
import { STAGE_LABELS, STAGE_ORDER, Stage } from "@/lib/types";
import { eur, relativeDays } from "@/lib/format";
import { Badge, SectionTitle, StatTile } from "@/components/ui";
import { OfferApproval, OfferVM } from "@/components/OfferApproval";

// Sales Manager — a reader and decision-maker (brief): team pipeline health,
// what's stalled, and the discount-approval gate. They don't enter data; they
// see what's wrong and intervene.
const ACTIVE_STAGES: Stage[] = STAGE_ORDER.filter(
  (s) => s !== "won" && s !== "lost",
);

function pendingSmOffers(): OfferVM[] {
  return getOffersByStatus("pending_sm").map((o) => {
    const account = getAccount(o.accountId);
    const deal = getDeal(o.dealId);
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
}

export default function SalesManagerView() {
  const summary = getTeamSummary();
  const deals = getAllDeals();
  const pendingApprovals = pendingSmOffers();

  const byStage = (stage: Stage) =>
    deals
      .filter((d) => d.stage === stage)
      .sort((a, b) => weightedValue(b) - weightedValue(a));

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team pipeline</h1>
        <p className="mt-1 text-sm text-muted">
          Health of the whole team&apos;s pipeline — where the risk is, what to
          approve.
        </p>
      </div>

      {/* Team KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Open deals" value={String(summary.openDeals)} />
        <StatTile
          label="Weighted pipeline"
          value={eur(summary.weightedPipeline)}
          hint="probability-adjusted, 3-yr"
        />
        <StatTile
          label="Total opportunity (TCV)"
          value={eur(summary.totalTcv)}
          hint="3-year sum, open deals"
        />
        <StatTile
          label="Stalled deals"
          value={String(summary.stalled)}
          hint="no update in 14+ days"
          tone={summary.stalled > 0 ? "warning" : "default"}
        />
      </div>

      {/* Discount approvals — first gate */}
      <OfferApproval offers={pendingApprovals} gate="sm" />

      {/* Pipeline by stage, team-wide */}
      <section>
        <SectionTitle>Pipeline by stage</SectionTitle>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          {ACTIVE_STAGES.map((stage) => {
            const stageDeals = byStage(stage);
            const stageValue = stageDeals.reduce(
              (s, d) => s + weightedValue(d),
              0,
            );
            return (
              <div
                key={stage}
                className="rounded-xl border border-border bg-surface"
              >
                <div className="border-b border-border px-3 py-2.5">
                  <p className="text-xs font-semibold text-foreground">
                    {STAGE_LABELS[stage]}
                  </p>
                  <p className="text-xs text-muted">
                    {stageDeals.length} · {eur(stageValue)}
                  </p>
                </div>
                <div className="space-y-2 p-2">
                  {stageDeals.length === 0 && (
                    <p className="px-1 py-3 text-xs text-muted">—</p>
                  )}
                  {stageDeals.map((d) => {
                    const account = getAccount(d.accountId);
                    const owner = getUser(d.ownerId);
                    const stalled = isStalled(d);
                    return (
                      <div
                        key={d.id}
                        className={`rounded-lg border p-2.5 ${
                          stalled
                            ? "border-amber-300 bg-amber-50"
                            : "border-border"
                        }`}
                      >
                        <p className="line-clamp-2 text-xs font-medium leading-snug">
                          {account?.name}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-hmd-teal-700">
                          {eur(d.tcv)}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                          <Badge>{owner?.initials ?? "?"}</Badge>
                          {d.channel === "reseller" && <Badge>reseller</Badge>}
                          {stalled && (
                            <Badge tone="amber">
                              {relativeDays(d.updatedAt)}d idle
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
