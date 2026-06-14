import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAccount,
  getCase,
  getContactsForAccount,
  getNotesForCase,
  getService,
  getServiceHistory,
  getUsers,
} from "@/lib/db";
import { caseAgeDays, requestStatus, slaInfo } from "@/lib/tam";
import { Card, SectionTitle } from "@/components/ui";
import { CaseStatusBadge, PriorityBadge, SlaBadge } from "../../ui";
import { CaseTimeline } from "./CaseTimeline";
import { CaseAddNote } from "./CaseAddNote";
import { CaseStatusControl } from "./CaseStatusControl";

// Single-case view — the screen the TAM demo lives in. Same two-column shape as
// the Rep's account detail: the timeline + capture in the centre, reference on
// the side. No charts, no auto AI summary (the assistant answers on demand) — the
// large, readable history IS the value, replacing the cold email thread.
export default async function CaseDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = await getCase(id);
  if (!c) notFound();

  const [account, service, contacts, notes, events, users] = await Promise.all([
    getAccount(c.accountId),
    c.serviceId ? getService(c.serviceId) : Promise.resolve(null),
    getContactsForAccount(c.accountId),
    getNotesForCase(c.id),
    getServiceHistory(c.accountId),
    getUsers(),
  ]);
  if (!account) notFound();

  const userById = new Map(users.map((u) => [u.id, u]));
  const authorNames: Record<string, string> = {};
  for (const u of users) authorNames[u.id] = u.name;

  const assignee = c.assigneeId ? userById.get(c.assigneeId) : undefined;
  const sla = slaInfo(c);
  const req = requestStatus(c, notes);
  const contact = contacts.find((p) => p.primary) ?? contacts[0];
  const tamUsers = users.filter((u) => u.role === "tam");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link href="/tam" className="text-xs text-muted hover:text-foreground">
        ← All cases
      </Link>

      {/* Header: title + one-click status control + priority */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadge priority={c.priority} />
            <CaseStatusBadge status={c.status} />
            <SlaBadge sla={sla} />
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{c.title}</h1>
          <p className="mt-1 text-sm text-muted">
            <Link href={`/tam/accounts/${account.id}`} className="hover:text-foreground">
              {account.name}
            </Link>
            {service ? ` · ${service.name}` : ""} · opened {caseAgeDays(c)}d ago
            {assignee ? ` · ${assignee.name}` : ""}
          </p>
        </div>
        <CaseStatusControl caseId={c.id} status={c.status} tamUsers={tamUsers} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column — capture + the large, readable history. */}
        <div className="space-y-6 lg:col-span-2">
          {c.status !== "resolved" && <CaseAddNote caseId={c.id} />}

          <section>
            <SectionTitle>History</SectionTitle>
            <CaseTimeline events={events} notes={notes} authorNames={authorNames} />
          </section>
        </div>

        {/* Side column — reference only. */}
        <aside className="space-y-4">
          <Card className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Linked service</p>
            {service ? (
              <>
                <p className="mt-1 text-sm font-semibold">{service.name}</p>
                <p className="mt-0.5 text-xs capitalize text-muted">
                  {service.category} · {service.status}
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-muted">—</p>
            )}
          </Card>

          <Card className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">SLA deadline</p>
            <p
              className={`mt-1 text-sm font-semibold ${
                sla.state === "breach"
                  ? "text-danger"
                  : sla.state === "soon"
                    ? "text-warning"
                    : "text-foreground"
              }`}
            >
              {sla.label}
            </p>
            <p className="mt-1 text-xs text-muted">{req.label}</p>
          </Card>

          {contact && (
            <Card className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Customer contact</p>
              <p className="mt-1 text-sm font-semibold">{contact.name}</p>
              <p className="text-xs text-muted">{contact.title}</p>
              {contact.email && (
                <p className="mt-1 text-xs text-muted">{contact.email}</p>
              )}
            </Card>
          )}

          {c.escalatedToThirdParty && (
            <Card className="border-l-2 border-l-amber-400/60 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-amber-200">
                ↗ 3rd-party escalation
              </p>
              <p className="mt-1 text-sm font-semibold">Waiting on vendor</p>
              <p className="mt-1 text-xs text-muted">
                Open {caseAgeDays(c)}d · {sla.label}
              </p>
            </Card>
          )}

          <Link
            href={`/tam/accounts/${account.id}`}
            className="block rounded-lg border border-border bg-surface px-4 py-3 text-sm font-medium text-foreground transition-colors hover:border-hmd-teal-600"
          >
            Open account →
          </Link>
        </aside>
      </div>
    </div>
  );
}
