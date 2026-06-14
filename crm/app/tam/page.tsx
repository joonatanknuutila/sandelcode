import Link from "next/link";
import { getAccounts, getCasesForTam, getCurrentUserForRole, getUsers } from "@/lib/db";
import type { Account, Case, User } from "@/lib/types";
import { caseAgeDays, getTamSummary, slaInfo, triageSort } from "@/lib/tam";
import { Card, SectionTitle, StatTile } from "@/components/ui";
import { CaseStatusBadge, PriorityBadge, SlaBadge, ThirdPartyFlag } from "./ui";
import { QueueResolveButton } from "./QueueResolveButton";

// Technical Account Manager dashboard — the case queue, triaged. Doing, not
// observing: no BI charts. Triage = SLA pressure → priority → age, so the row
// that needs eyes first is at the top. "Needs action now" pulls past-SLA and
// due-24h cases above the rest; freshly handed-off cases carry a clear marker.

// A case is "new from sales" while it's still in the untouched Open state —
// i.e. just handed over and not yet picked up (the TAM moves it to In progress
// the moment they start working it).
function isNewFromSales(c: Case): boolean {
  return c.status === "open";
}

function CaseRow({
  c,
  account,
  assignee,
}: {
  c: Case;
  account?: Account;
  assignee?: User;
}) {
  const sla = slaInfo(c);
  const isNew = isNewFromSales(c);
  return (
    <div className="relative flex items-center gap-2">
      <Link href={`/tam/cases/${c.id}`} className="min-w-0 flex-1">
        <Card
          className={`flex items-center gap-4 p-3.5 transition-colors hover:border-hmd-teal-600 ${
            isNew
              ? "border-l-2 border-l-hmd-teal"
              : sla.state === "breach"
                ? "border-l-2 border-l-danger"
                : sla.state === "soon"
                  ? "border-l-2 border-l-warning"
                  : ""
          }`}
        >
          <PriorityBadge priority={c.priority} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {isNew && (
                <span className="shrink-0 rounded-full bg-hmd-teal px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-hmd-charcoal">
                  New · from sales
                </span>
              )}
              <p className={`truncate text-sm ${isNew ? "font-semibold" : "font-medium"}`}>
                {c.title}
              </p>
            </div>
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
      <QueueResolveButton caseId={c.id} />
    </div>
  );
}

export default async function TamView() {
  const user = await getCurrentUserForRole("tam");
  const [all, accounts, users] = await Promise.all([
    user ? getCasesForTam(user.id) : Promise.resolve([]),
    getAccounts(),
    getUsers(),
  ]);
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const userById = new Map(users.map((u) => [u.id, u]));

  const summary = getTamSummary(all);
  const open = triageSort(all.filter((c) => c.status !== "resolved"));
  const resolved = all.filter((c) => c.status === "resolved");

  // Needs action now — past-SLA + due-within-24h, surfaced above the queue.
  const pressing = (s: string) => s === "breach" || s === "soon";
  const needsAction = open.filter((c) => pressing(slaInfo(c).state));
  const rest = open.filter((c) => !pressing(slaInfo(c).state));

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My cases</h1>
        <p className="mt-1 text-sm text-muted">
          {open.length} open across your accounts, ordered by SLA pressure then
          priority and age.
        </p>
      </div>

      {/* Small metric chips — the instant "am I on top of it?" read. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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

      {/* Needs action now */}
      {needsAction.length > 0 && (
        <section>
          <SectionTitle>Needs action now</SectionTitle>
          <div className="space-y-2">
            {needsAction.map((c) => (
              <CaseRow
                key={c.id}
                c={c}
                account={accountById.get(c.accountId)}
                assignee={c.assigneeId ? userById.get(c.assigneeId) : undefined}
              />
            ))}
          </div>
        </section>
      )}

      {/* Open cases queue */}
      <section>
        <SectionTitle>{needsAction.length > 0 ? "Open cases" : "Open cases — triaged"}</SectionTitle>
        <div className="space-y-2">
          {rest.map((c) => (
            <CaseRow
              key={c.id}
              c={c}
              account={accountById.get(c.accountId)}
              assignee={c.assigneeId ? userById.get(c.assigneeId) : undefined}
            />
          ))}
          {rest.length === 0 && needsAction.length === 0 && (
            <Card className="p-6 text-center text-sm text-muted">
              No open cases — your queue is clear.
            </Card>
          )}
        </div>
      </section>

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
