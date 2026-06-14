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
import { REP_STAGE_LABELS, STAGE_ORDER, Stage } from "@/lib/types";
import { eur, relativeDays, shortDate } from "@/lib/format";
import { Badge, Card, SectionTitle, StageBadge, StatTile } from "@/components/ui";
import { Assistant } from "@/components/Assistant";

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
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Welcome back, {user.name.split(" ")[0]}
          </h1>
          <p className="mt-2 text-base text-muted">
            You have {deals.length} {deals.length === 1 ? "deal" : "deals"} on the go.
          </p>
        </div>
        <Link
          href="/rep/accounts"
          className="inline-flex min-h-[44px] items-center rounded-md bg-hmd-teal px-5 py-2.5 text-base font-medium text-hmd-teal-700 hover:bg-hmd-teal/90"
        >
          See my customers
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Open deals" value={String(summary.openDeals)} large />
        <StatTile
          label="Likely to land"
          value={eur(summary.weightedPipeline)}
          hint="our best guess of what closes"
          large
        />
        <StatTile
          label="Total deal value"
          value={eur(summary.totalTcv)}
          hint="over 3 years"
          large
        />
        <StatTile
          label="Going quiet"
          value={String(summary.stalled)}
          hint="no update in 2+ weeks"
          tone={summary.stalled > 0 ? "warning" : "default"}
          large
        />
      </div>

      {/* Ask the pipeline in plain words — Rep tone (brisk, action-oriented). */}
      <Assistant
        role="rep"
        scopeLabel="your pipeline"
        suggestions={[
          "Which of my deals are stalled?",
          "What's the biggest deal I should focus on?",
          "Show me at-risk enterprise deals",
        ]}
      />

      {/* Needs attention */}
      {notifications.length > 0 && (
        <section>
          <SectionTitle>Needs your attention</SectionTitle>
          <div className="space-y-2">
            {notifications.map((n) => (
              <Link key={n.id} href={n.href ?? "#"}>
                <Card className="flex min-h-[44px] items-center gap-3 p-4 transition-colors hover:border-hmd-teal-600">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-hmd-orange" />
                  <span className="text-base">{n.body}</span>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Pipeline at a glance */}
      <section>
        <SectionTitle>My deals by stage</SectionTitle>
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
                <div className="border-b border-border px-3 py-3">
                  <p className="text-sm font-semibold text-foreground">
                    {REP_STAGE_LABELS[stage]}
                  </p>
                  <p className="text-sm text-muted">
                    {stageDeals.length} · {eur(stageValue)}
                  </p>
                </div>
                <div className="space-y-2 p-2">
                  {stageDeals.length === 0 && (
                    <p className="px-1 py-3 text-sm text-muted">—</p>
                  )}
                  {stageDeals.map((d) => {
                    const account = accountsById.get(d.accountId);
                    return (
                      <Link key={d.id} href={`/rep/deals/${d.id}`}>
                        <div className="rounded-lg border border-border p-3 transition-colors hover:border-hmd-teal-600 hover:shadow-sm">
                          <p className="line-clamp-2 text-base font-medium leading-snug">
                            {account?.name}
                          </p>
                          <p className="mt-1 text-lg font-semibold text-foreground">
                            {eur(d.tcv)}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-1">
                            {d.channel === "reseller" && (
                              <Badge tone="amber">Partner deal</Badge>
                            )}
                            {isStalled(d) && (
                              <Badge tone="amber">Needs attention</Badge>
                            )}
                            {isOverdue(d) && <Badge tone="red">Past due</Badge>}
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
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-base">
            <thead className="bg-background text-left text-sm uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Stage</th>
                <th className="px-4 py-3 text-right font-medium">Deal value</th>
                <th className="px-4 py-3 text-right font-medium">Likely value</th>
                <th className="px-4 py-3 font-medium">Expected to close</th>
                <th className="px-4 py-3 font-medium">Last update</th>
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
                    <td className="px-4">
                      <Link
                        href={`/rep/deals/${d.id}`}
                        className="block py-3 font-medium hover:text-hmd-teal"
                      >
                        {account?.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <StageBadge stage={d.stage} plain />
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {eur(d.tcv)}
                    </td>
                    <td className="px-4 py-3 text-right text-muted">
                      {eur(weightedValue(d))}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {shortDate(d.expectedCloseDate)}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {relativeDays(d.updatedAt)} days ago
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
