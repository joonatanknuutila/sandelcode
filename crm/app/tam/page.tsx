import Link from "next/link";
import { getAccount, getUser } from "@/lib/api";
import {
  caseAgeDays,
  getAllCases,
  getTamSummary,
  slaInfo,
  triageSort,
} from "@/lib/tam";
import { Card, SectionTitle, StatTile } from "@/components/ui";
import { CaseStatusBadge, PriorityBadge, SlaBadge, ThirdPartyFlag } from "./ui";

// Technical Account Manager dashboard — the case queue, triaged.
// Triage order = SLA pressure → priority → age, so the row that needs eyes
// first is at the top. Fixes "CC'd on a 3-day-old thread with no context": one
// click into a case shows the whole service history + notes on one timeline.
export default function TamView() {
  const summary = getTamSummary();
  const open = triageSort(getAllCases().filter((c) => c.status !== "resolved"));
  const resolved = getAllCases().filter((c) => c.status === "resolved");

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My cases</h1>
        <p className="mt-1 text-sm text-muted">
          {open.length} open across your accounts, ordered by SLA pressure then
          priority and age.
        </p>
      </div>

      {/* KPIs */}
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

      {/* Case queue */}
      <section>
        <SectionTitle>Open cases — triaged</SectionTitle>
        <div className="space-y-2">
          {open.map((c) => {
            const account = getAccount(c.accountId);
            const sla = slaInfo(c);
            const assignee = c.assigneeId ? getUser(c.assigneeId) : undefined;
            return (
              <Link key={c.id} href={`/tam/cases/${c.id}`}>
                <Card
                  className={`flex items-center gap-4 p-3.5 transition-colors hover:border-hmd-teal-600 ${
                    sla.state === "breach" ? "border-l-2 border-l-danger" : ""
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
            );
          })}
        </div>
      </section>

      {/* Recently resolved — kept for service-history context */}
      {resolved.length > 0 && (
        <section>
          <SectionTitle>Recently resolved</SectionTitle>
          <div className="space-y-2">
            {resolved.map((c) => {
              const account = getAccount(c.accountId);
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
