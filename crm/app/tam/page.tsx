import Link from "next/link";
import { getAccounts, getAllCases, getUsers } from "@/lib/db";
import { caseAgeDays, getTamSummary, slaInfo, triageSort } from "@/lib/tam";
import { Card, SectionTitle, StatTile } from "@/components/ui";
import { CaseStatusBadge, PriorityBadge, SlaBadge, ThirdPartyFlag } from "./ui";
import { Assistant } from "@/components/Assistant";
import { QueueResolveButton } from "./QueueResolveButton";
import { TamHealthOverview } from "./TamHealthOverview";

// Technical Account Manager dashboard — the case queue, triaged.
// Triage order = SLA pressure → priority → age, so the row that needs eyes
// first is at the top. Fixes "CC'd on a 3-day-old thread with no context": one
// click into a case shows the whole service history + notes on one timeline.
export default async function TamView() {
  const [all, accounts, users] = await Promise.all([
    getAllCases(),
    getAccounts(),
    getUsers(),
  ]);
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const userById = new Map(users.map((u) => [u.id, u]));

  const summary = getTamSummary(all);
  const open = triageSort(all.filter((c) => c.status !== "resolved"));
  const resolved = all.filter((c) => c.status === "resolved");

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My cases</h1>
        <p className="mt-1 text-sm text-muted">
          {open.length} open across your accounts, ordered by SLA pressure then
          priority and age.
        </p>
      </div>

      {/* KPIs — the instant "am I on top of it?" read, first. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Open cases" value={String(summary.openCases)} />
        <StatTile
          label="Past SLA"
          value={String(summary.breaching)}
          hint="needs action now"
          tone={summary.breaching > 0 ? "warning" : "default"}
        />
        <StatTile
          label="Due within 24h"
          value={String(summary.dueSoon)}
          hint="SLA approaching"
          tone={summary.dueSoon > 0 ? "warning" : "default"}
        />
        <StatTile
          label="3rd-party escalations"
          value={String(summary.escalated)}
          hint="blocked on a vendor"
        />
      </div>

      {/* Visual health band — the shape behind the numbers. */}
      <TamHealthOverview cases={all} accounts={accounts} />

      {/* Case queue */}
      <section>
        <SectionTitle>Open cases — triaged</SectionTitle>
        <div className="space-y-2">
          {open.map((c) => {
            const account = accountById.get(c.accountId);
            const sla = slaInfo(c);
            const assignee = c.assigneeId ? userById.get(c.assigneeId) : undefined;
            return (
              <div key={c.id} className="relative flex items-center gap-2">
                <Link href={`/tam/cases/${c.id}`} className="min-w-0 flex-1">
                  <Card
                    className={`flex items-center gap-4 p-3.5 transition-colors hover:border-hmd-teal-600 ${
                      sla.state === "breach"
                        ? "border-l-2 border-l-danger"
                        : sla.state === "soon"
                          ? "border-l-2 border-l-warning"
                          : ""
                    }`}
                  >
                    <PriorityBadge priority={c.priority} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.title}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {account?.name} · opened {caseAgeDays(c)}d ago
                        {assignee ? ` · ${assignee.name}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <ThirdPartyFlag case={c} />
                      <CaseStatusBadge status={c.status} />
                      <SlaBadge sla={sla} />
                    </div>
                  </Card>
                </Link>
                {/* Quick resolve — stops the click propagating to the Link */}
                <QueueResolveButton caseId={c.id} />
              </div>
            );
          })}
        </div>
      </section>

      {/* Assistant — a helper, sitting below the work it supports. */}
      <Assistant role="tam" scopeLabel="your case queue" />

      {/* Recently resolved — kept for service-history context */}
      {resolved.length > 0 && (
        <section>
          <SectionTitle>Recently resolved</SectionTitle>
          <div className="space-y-2">
            {resolved.map((c) => {
              const account = accountById.get(c.accountId);
              return (
                <Link key={c.id} href={`/tam/cases/${c.id}`}>
                  <Card className="flex items-center gap-4 p-3 opacity-70 transition-opacity hover:opacity-100">
                    <PriorityBadge priority={c.priority} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.title}</p>
                      <p className="mt-0.5 text-xs text-muted">{account?.name}</p>
                    </div>
                    <CaseStatusBadge status={c.status} />
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
