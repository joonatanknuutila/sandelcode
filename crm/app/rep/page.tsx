import Link from "next/link";
import {
  getAccountsForRep,
  getCurrentUser,
  getDealsForRep,
  getNotifications,
  getRepSummary,
  weightedValue,
} from "@/lib/db";
import { REP_STAGE_LABELS, STAGE_ORDER, Stage } from "@/lib/types";
import { eur, relativeDays, shortDate } from "@/lib/format";
import { Badge, Card, SectionTitle, StageBadge, StatTile } from "@/components/ui";
import { AddNote } from "@/components/AddNote";
import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import { dealConfidence } from "@/lib/confidence";
import {
  buildAttention,
  nextSteps,
  type AttentionTone,
} from "@/lib/rep/attention";

// Sales Rep dashboard — an action list, not a metric wall (§1). Top to bottom:
// capture anchor → what needs attention → today's next steps → pipeline snapshot
// → a thin metrics strip. The first thing the rep sees is a way to RECORD.
const ACTIVE_STAGES: Stage[] = STAGE_ORDER.filter(
  (s) => s !== "won" && s !== "lost",
);

const TONE_DOT: Record<AttentionTone, string> = {
  risk: "bg-hmd-orange",
  info: "bg-hmd-teal-600",
  good: "bg-green-400",
};

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
  const accountRefs = accounts.map((a) => ({ id: a.id, name: a.name }));
  const attention = buildAttention(deals, accountsById, notifications);
  const steps = nextSteps(deals, accountsById);

  const byStage = (stage: Stage) => deals.filter((d) => d.stage === stage);

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Welcome back, {user.name.split(" ")[0]}
          </h1>
          <p className="mt-2 text-base text-muted">
            You have {deals.length} {deals.length === 1 ? "deal" : "deals"} on the go.{" "}
            <Link href="/rep/accounts" className="font-medium text-hmd-teal hover:underline">
              See my customers →
            </Link>
          </p>
        </div>
      </div>

      {/* 1. Capture anchor — the first thing the rep sees is a way to record. */}
      <AddNote
        accounts={accountRefs}
        heading="Add note"
        placeholder="Just spoke to a customer? Write what happened — pick the account after."
      />

      {/* 2. Needs your attention — the heart of the dashboard. */}
      <section>
        <SectionTitle>Needs your attention</SectionTitle>
        {attention.length === 0 ? (
          <Card className="p-4 text-base text-muted">
            You&apos;re all caught up — nothing needs chasing right now.
          </Card>
        ) : (
          <div className="space-y-2">
            {attention.slice(0, 8).map((item) => {
              const row = (
                <Card className="flex min-h-[44px] items-center gap-3 p-4 transition-colors hover:border-hmd-teal-600">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${TONE_DOT[item.tone]}`} />
                  <span className="flex-1 text-base">{item.sentence}</span>
                  {item.context && (
                    <span className="shrink-0 text-sm font-medium text-muted">{item.context}</span>
                  )}
                </Card>
              );
              return item.href ? (
                <Link key={item.id} href={item.href}>
                  {row}
                </Link>
              ) : (
                <div key={item.id}>{row}</div>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. Today's next steps — the do-this-today list across deals. */}
      {steps.length > 0 && (
        <section>
          <SectionTitle>Today&apos;s next steps</SectionTitle>
          <div className="space-y-2">
            {steps.map((s) => (
              <Link key={s.dealId} href={s.href}>
                <Card className="flex min-h-[44px] items-center gap-3 p-4 transition-colors hover:border-hmd-teal-600">
                  <span className="rounded bg-[#e4ff00] px-2 py-0.5 text-xs font-bold text-black">
                    Do
                  </span>
                  <span className="flex-1 text-base">{s.headline}</span>
                  <span className="shrink-0 text-sm font-medium text-muted">{s.context}</span>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 4. Pipeline snapshot — keep "My deals by stage". */}
      <section>
        <SectionTitle>My deals by stage</SectionTitle>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          {ACTIVE_STAGES.map((stage) => {
            const stageDeals = byStage(stage);
            const stageValue = stageDeals.reduce((s, d) => s + weightedValue(d), 0);
            return (
              <div key={stage} className="rounded-xl border border-border bg-surface">
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
                    const conf = dealConfidence(d);
                    return (
                      <Link key={d.id} href={`/rep/deals/${d.id}`}>
                        <div className="rounded-lg border border-border p-3 transition-colors hover:border-hmd-teal-600 hover:shadow-sm">
                          <p className="line-clamp-2 text-base font-medium leading-snug">
                            {account?.name}
                          </p>
                          <p className="mt-1 text-lg font-semibold text-foreground">
                            {eur(d.tcv)}
                          </p>
                          <div className="mt-2">
                            <ConfidenceMeter
                              score={conf.score}
                              band={conf.band}
                              size="sm"
                              showLabel={false}
                            />
                          </div>
                          {d.channel === "reseller" && (
                            <div className="mt-2">
                              <Badge tone="amber">Partner deal</Badge>
                            </div>
                          )}
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

      {/* All my deals — the dense scannable table (the best element). */}
      <section>
        <SectionTitle>All my deals</SectionTitle>
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-base">
            <thead className="bg-background text-left text-sm uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Stage</th>
                <th className="px-4 py-3 font-medium">Confidence</th>
                <th className="px-4 py-3 text-right font-medium">Deal value</th>
                <th className="px-4 py-3 text-right font-medium">Weighted value</th>
                <th className="px-4 py-3 font-medium">Expected to close</th>
                <th className="px-4 py-3 font-medium">Last update</th>
              </tr>
            </thead>
            <tbody>
              {deals.map((d) => {
                const account = accountsById.get(d.accountId);
                const conf = dealConfidence(d);
                return (
                  <tr key={d.id} className="border-t border-border hover:bg-background">
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
                    <td className="px-4 py-3">
                      <ConfidenceMeter
                        score={conf.score}
                        band={conf.band}
                        size="sm"
                        showLabel={false}
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{eur(d.tcv)}</td>
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

      {/* 5. Metrics — demoted to a thin reference strip at the bottom (§1.5). */}
      <section>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Open deals" value={String(summary.openDeals)} />
          <StatTile
            label="Weighted pipeline"
            value={eur(summary.weightedPipeline)}
            hint="our best guess of what closes"
          />
          <StatTile label="Total value" value={eur(summary.totalTcv)} hint="over 3 years" />
          <StatTile
            label="Going quiet"
            value={String(summary.stalled)}
            tone={summary.stalled > 0 ? "warning" : "default"}
          />
        </div>
      </section>
    </div>
  );
}
