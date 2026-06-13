import Link from "next/link";
import { notFound } from "next/navigation";
import { getAccount, getUser } from "@/lib/api";
import {
  caseAgeDays,
  getCase,
  getNotesForCase,
  getService,
  getServiceHistory,
  requestStatus,
  slaInfo,
  summariseCase,
} from "@/lib/tam";
import { Card, SectionTitle } from "@/components/ui";
import { CaseStatusBadge, PriorityBadge, SlaBadge, ThirdPartyFlag } from "../../ui";
import { CaseTimeline } from "./CaseTimeline";
import { Assistant } from "../../Assistant";

// Single-case view — "no surprises on cases". One timeline (service history +
// notes), the SLA + 3rd-party state up top, an AI summary so a TAM landing on a
// 3-day-old thread is caught up in seconds, and the request-tracking line that
// says whose move it is.
export default async function CaseDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = getCase(id);
  if (!c) notFound();

  const account = getAccount(c.accountId)!;
  const service = getService(c.serviceId);
  const assignee = c.assigneeId ? getUser(c.assigneeId) : undefined;
  const sla = slaInfo(c);
  const req = requestStatus(c);
  const summary = summariseCase(c);
  const notes = getNotesForCase(c.id);
  const events = getServiceHistory(c.accountId);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/tam" className="text-xs text-muted hover:text-foreground">
        ← All cases
      </Link>

      {/* Header */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <PriorityBadge priority={c.priority} />
          <CaseStatusBadge status={c.status} />
          <SlaBadge sla={sla} />
          <ThirdPartyFlag case={c} />
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{c.title}</h1>
        <p className="mt-1 text-sm text-muted">
          <Link href={`/rep/accounts/${account.id}`} className="hover:text-foreground">
            {account.name}
          </Link>
          {service ? ` · ${service.name}` : ""} · opened {caseAgeDays(c)}d ago
          {assignee ? ` · ${assignee.name}` : ""}
        </p>
      </div>

      {/* AI case summary */}
      <Card className="border-l-2 border-l-hmd-teal-600 p-4">
        <div className="flex items-center gap-2">
          <span className="rounded bg-hmd-teal px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-hmd-charcoal">
            AI
          </span>
          <p className="text-sm font-semibold">{summary.headline}</p>
        </div>
        <ul className="mt-2 space-y-1">
          {summary.bullets.map((b, i) => (
            <li key={i} className="text-sm text-foreground">
              · {b}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm">
          <span className="font-medium">Suggested:</span>{" "}
          <span className="text-muted">{summary.suggestion}</span>
        </p>
      </Card>

      {/* Request tracking */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Waiting on</p>
          <p className="mt-1 text-sm font-semibold">{req.label}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">SLA</p>
          <p className="mt-1 text-sm font-semibold">{sla.label}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Service status</p>
          <p className="mt-1 text-sm font-semibold capitalize">{service?.status ?? "—"}</p>
        </Card>
      </div>

      {/* Unified timeline */}
      <section>
        <SectionTitle>Service history &amp; notes</SectionTitle>
        <CaseTimeline events={events} notes={notes} />
      </section>

      {/* Account-scoped assistant */}
      <Assistant role="tam" accountId={account.id} scopeLabel={account.name} />
    </div>
  );
}
