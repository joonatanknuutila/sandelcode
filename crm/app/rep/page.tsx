import Link from "next/link";
import {
  getAccountsForRep,
  getCurrentUser,
  getDealsForRep,
  getNotifications,
  getRepSummary,
  isStalled,
  isOverdue,
  weightedValue,
} from "@/lib/db";
import { STAGE_LABELS, STAGE_ORDER, Stage } from "@/lib/types";
import { eur, relativeDays, shortDate } from "@/lib/format";
import { Badge, Card, SectionTitle, StageBadge, StatTile } from "@/components/ui";

// Sales Rep dashboard — "my pipeline at a glance" + what needs attention.
// Pipeline columns exclude the terminal Won/Lost stages for focus.
const ACTIVE_STAGES: Stage[] = STAGE_ORDER.filter(
  (s) => s !== "won" && s !== "lost",
);

export default async function RepDashboard() {
  const user = await getCurrentUser();
  if (!user) return <p className="text-sm text-muted">No user signed in.</p>;
  const [summary, deals, allNotes, accounts] = await Promise.all([
    getRepSummary(user.id),
    getDealsForRep(user.id),
    getNotifications(user.id),
    getAccountsForRep(user.id),
  ]);
  const notifications = allNotes.filter((n) => !n.read);
  const accountsById = new Map(accounts.map((a) => [a.id, a]));

  const byStage = (stage: Stage) => deals.filter((d) => d.stage === stage);

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back, {user.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Your pipeline across {deals.length} deals.
          </p>
        </div>
        <Link
          href="/rep/accounts"
          className="rounded-md bg-hmd-teal px-4 py-2 text-sm font-medium text-hmd-teal-700 hover:bg-hmd-teal/90"
        >
          View my accounts
        </Link>
      </div>

      {/* KPIs */}
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
          hint="3-year sum"
        />
        <StatTile
          label="Stalled deals"
          value={String(summary.stalled)}
          hint="no update in 14+ days"
          tone={summary.stalled > 0 ? "warning" : "default"}
        />
      </div>

      {/* Needs attention */}
      {notifications.length > 0 && (
        <section>
          <SectionTitle>Needs your attention</SectionTitle>
          <div className="space-y-2">
            {notifications.map((n) => (
              <Link key={n.id} href={n.href ?? "#"}>
                <Card className="flex items-center gap-3 p-3 transition-colors hover:border-hmd-teal-600">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-hmd-orange" />
                  <span className="text-sm">{n.body}</span>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Pipeline at a glance */}
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
                    const account = accountsById.get(d.accountId);
                    return (
                      <Link key={d.id} href={`/rep/deals/${d.id}`}>
                        <div className="rounded-lg border border-border p-2.5 transition-colors hover:border-hmd-teal-600 hover:shadow-sm">
                          <p className="line-clamp-2 text-xs font-medium leading-snug">
                            {account?.name}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-foreground">
                            {eur(d.tcv)}
                          </p>
                          <div className="mt-1.5 flex items-center gap-1">
                            {d.channel === "reseller" && (
                              <Badge>reseller</Badge>
                            )}
                            {isStalled(d) && <Badge tone="amber">stalled</Badge>}
                            {isOverdue(d) && <Badge tone="red">overdue</Badge>}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Recent deals table */}
      <section>
        <SectionTitle>All my deals</SectionTitle>
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-background text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Account</th>
                <th className="px-4 py-2.5 font-medium">Stage</th>
                <th className="px-4 py-2.5 text-right font-medium">TCV (3yr)</th>
                <th className="px-4 py-2.5 text-right font-medium">Weighted</th>
                <th className="px-4 py-2.5 font-medium">Expected close</th>
                <th className="px-4 py-2.5 font-medium">Last update</th>
              </tr>
            </thead>
            <tbody>
              {deals.map((d) => {
                const account = accountsById.get(d.accountId);
                return (
                  <tr
                    key={d.id}
                    className="border-t border-border hover:bg-background"
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/rep/deals/${d.id}`}
                        className="font-medium hover:text-hmd-teal"
                      >
                        {account?.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <StageBadge stage={d.stage} />
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium">
                      {eur(d.tcv)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted">
                      {eur(weightedValue(d))}
                    </td>
                    <td className="px-4 py-2.5 text-muted">
                      {shortDate(d.expectedCloseDate)}
                    </td>
                    <td className="px-4 py-2.5 text-muted">
                      {relativeDays(d.updatedAt)}d ago
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  );
}
