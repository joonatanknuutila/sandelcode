import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAccount,
  getCase,
  getNotesForCase,
  getService,
  getServiceHistory,
  getUsers,
} from "@/lib/db";
import {
  caseAgeDays,
  requestStatus,
  slaInfo,
  summariseCase,
} from "@/lib/tam";
import { aiCaseSummary, shouldOfferAiSummary } from "@/lib/ai/case-summary";
import { GRAPH_DEFER_REASON, isGraphConfigured } from "@/lib/integrations/graph";
import { Card, SectionTitle } from "@/components/ui";
import { CaseStatusBadge, PriorityBadge, SlaBadge, ThirdPartyFlag } from "../../ui";
import { CaseTimeline } from "./CaseTimeline";
import { Assistant } from "@/components/Assistant";
import { MeetingCapture } from "../../MeetingCapture";
import { AddNote } from "./AddNote";
import { CaseActions } from "./CaseActions";

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
  const c = await getCase(id);
  if (!c) notFound();

  const [account, service, notes, events, users] = await Promise.all([
    getAccount(c.accountId),
    c.serviceId ? getService(c.serviceId) : Promise.resolve(null),
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
  const summary = summariseCase(c, notes, events);
  // Model-backed catch-up paragraph — only on long threads (brief: 5+ notes).
  const ai = shouldOfferAiSummary(notes.length)
    ? await aiCaseSummary(c, notes, events)
    : null;
  const graphReady = isGraphConfigured();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/tam" className="text-xs text-muted hover:text-foreground">
        ← All cases
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
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
        {/* Inline actions: resolve / escalate / reassign */}
        <CaseActions
          caseId={c.id}
          accountId={c.accountId}
          caseStatus={c.status}
          tamUsers={users.filter((u) => u.role === "tam")}
        />
      </div>

      {/* AI case summary */}
      <Card className="border-l-2 border-l-hmd-teal-600 p-4">
        <div className="flex items-center gap-2">
          <span className="rounded bg-hmd-teal px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-hmd-charcoal">
            AI
          </span>
          <p className="text-sm font-semibold">{summary.headline}</p>
        </div>
        {/* Model-backed catch-up paragraph — long threads only (5+ notes). */}
        {ai && (
          <div className="mt-2 rounded-md border border-border bg-background p-3">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted">
              Thread summary · {notes.length} notes
              {!ai.modelUsed && (
                <span className="ml-1 normal-case">· model offline — deterministic</span>
              )}
            </p>
            <p className="text-sm leading-relaxed text-foreground">{ai.text}</p>
          </div>
        )}
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

      {/* Capture + integrations. Meeting + inbound-email both run through the
          human-approval gate. "Book follow-up" is an honest placeholder for the
          Azure/Graph Outlook path (see lib/integrations/graph.ts). */}
      <div className="flex flex-wrap items-start gap-2">
        <MeetingCapture accountId={account.id} />
        <MeetingCapture accountId={account.id} mode="email" />
        <button
          type="button"
          disabled={!graphReady}
          title={graphReady ? "Book a follow-up in Outlook" : GRAPH_DEFER_REASON}
          className="rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium text-foreground hover:border-hmd-teal-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Book follow-up
          {!graphReady && (
            <span className="ml-1.5 text-xs text-muted">(Azure/Graph)</span>
          )}
        </button>
      </div>

      {/* Add note composer */}
      {c.status !== "resolved" && (
        <section>
          <SectionTitle>Add note</SectionTitle>
          <Card className="p-4">
            <AddNote caseId={c.id} />
          </Card>
        </section>
      )}

      {/* Unified timeline */}
      <section>
        <SectionTitle>Service history &amp; notes</SectionTitle>
        <CaseTimeline events={events} notes={notes} authorNames={authorNames} />
      </section>

      {/* Account-scoped assistant */}
      <Assistant role="tam" accountId={account.id} scopeLabel={account.name} />
    </div>
  );
}
