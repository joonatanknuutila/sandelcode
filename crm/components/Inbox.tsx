// Inbox — internal messaging, the "context is always in front of you" view
// (brief Block 4). A conversation is one account/deal/case plus its messages; a
// deal conversation can also carry a pending discount approval that renders as a
// special message with approve/reject + a SM → Finance → Locked status bar.
//
// One shared component, four lenses: the role + scoped conversation list are
// passed in by each /[role]/inbox route. Reads go through lib/db; the reply
// composer and approval buttons are the only client islands (InboxClient).

import Link from "next/link";
import {
  getAccount,
  getCase,
  getDeal,
  getInboxMessages,
  getUsers,
} from "@/lib/db";
import { Conversation, ContextType, OfferStatus, Role } from "@/lib/types";
import { eur, shortDate } from "@/lib/format";
import { Badge, Card, StageBadge } from "./ui";
import { ApprovalActions, MessageComposer } from "./InboxClient";

const CONTEXT_LABEL: Record<ContextType, string> = {
  account: "Account",
  deal: "Deal",
  case: "Case",
};

// Where each role opens an account / deal from the context panel.
const ACCOUNTS_PATH: Record<Role, string> = {
  rep: "/rep/accounts",
  sm: "/sm/accounts",
  finance: "/finance/accounts",
  tam: "/tam/accounts",
};

function convKey(c: Pick<Conversation, "contextType" | "contextId">): string {
  return `${c.contextType}:${c.contextId}`;
}

/** SM → Finance → Locked. Highlights the gate the offer is waiting on now. */
function ApprovalStatusBar({ status }: { status: OfferStatus }) {
  const steps = [
    { key: "pending_sm", label: "Sales Manager" },
    { key: "pending_finance", label: "Finance" },
    { key: "approved", label: "Locked" },
  ];
  const activeIndex =
    status === "pending_sm" ? 0 : status === "pending_finance" ? 1 : 2;
  return (
    <div className="flex items-center gap-1.5 text-xs">
      {steps.map((s, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex;
        return (
          <span key={s.key} className="flex items-center gap-1.5">
            <span
              className={`rounded-full px-2 py-0.5 font-medium ${
                active
                  ? "bg-hmd-teal text-hmd-charcoal"
                  : done
                    ? "bg-success/15 text-success"
                    : "bg-background text-muted"
              }`}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && <span className="text-muted">→</span>}
          </span>
        );
      })}
    </div>
  );
}

export async function InboxScreen({
  role,
  basePath,
  conversations,
  selectedKey,
}: {
  role: Role;
  basePath: string;
  conversations: Conversation[];
  selectedKey?: string;
}) {
  const users = await getUsers();
  const userById = new Map(users.map((u) => [u.id, u]));

  const selected =
    conversations.find((c) => convKey(c) === selectedKey) ?? conversations[0];

  // Fetch the selected thread + the entities the context panel shows.
  const [messages, account, deal, caseRow] = selected
    ? await Promise.all([
        getInboxMessages(selected.contextType, selected.contextId),
        getAccount(selected.accountId),
        selected.contextType === "deal"
          ? getDeal(selected.contextId)
          : Promise.resolve(null),
        selected.contextType === "case"
          ? getCase(selected.contextId)
          : Promise.resolve(null),
      ])
    : [[], null, null, null];

  const canDecide =
    !!selected?.pendingApproval &&
    ((role === "sm" && selected.pendingApproval.gate === "sm") ||
      (role === "finance" && selected.pendingApproval.gate === "finance"));

  const accountHref = selected
    ? `${ACCOUNTS_PATH[role]}/${selected.accountId}`
    : "#";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
        <p className="mt-1 text-sm text-muted">
          Internal threads — every message stays attached to its account, deal or
          case. Customer contact happens outside; its result lands on the
          timeline.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
        {/* Conversation list */}
        <Card className="divide-y divide-border overflow-hidden">
          {conversations.length === 0 && (
            <p className="p-4 text-sm text-muted">No conversations yet.</p>
          )}
          {conversations.map((c) => {
            const active = selected && convKey(c) === convKey(selected);
            const parts = c.participantIds
              .map((id) => userById.get(id)?.initials)
              .filter(Boolean)
              .slice(0, 4);
            return (
              <Link
                key={convKey(c)}
                href={`${basePath}?c=${convKey(c)}`}
                className={`block px-3.5 py-3 transition-colors hover:bg-background ${
                  active ? "bg-background" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{c.title}</p>
                  <span className="shrink-0 text-[0.65rem] uppercase tracking-wide text-muted">
                    {CONTEXT_LABEL[c.contextType]}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted">{c.subtitle}</p>
                <p className="mt-1 line-clamp-1 text-xs text-muted">
                  {c.lastSnippet}
                </p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  {c.pendingApproval && (
                    <Badge tone="amber">approval</Badge>
                  )}
                  {parts.length > 0 && (
                    <span className="text-[0.65rem] text-muted">
                      {parts.join(" · ")}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </Card>

        {/* Thread + context panel */}
        {!selected ? (
          <Card className="grid place-items-center p-10 text-sm text-muted">
            Select a conversation.
          </Card>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
            {/* Thread */}
            <Card className="flex min-h-[28rem] flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {selected.title}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {CONTEXT_LABEL[selected.contextType]} · {selected.subtitle}
                  </p>
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                {/* Approval request as a special message */}
                {selected.pendingApproval && (
                  <div className="rounded-lg border border-amber-400/35 bg-amber-400/10 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-amber-100">
                        Discount approval — v{selected.pendingApproval.version}
                      </p>
                      <Badge tone="amber">
                        {selected.pendingApproval.discountPct}% off
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-amber-100/75">
                      Offer total {eur(selected.pendingApproval.total)}.
                      {selected.pendingApproval.justification
                        ? ` Justification: ${selected.pendingApproval.justification}`
                        : " No justification provided."}
                    </p>
                    <div className="mt-2.5">
                      <ApprovalStatusBar status={selected.pendingApproval.status} />
                    </div>
                    {canDecide && (
                      <div className="mt-3">
                        <ApprovalActions
                          offerId={selected.pendingApproval.offerId}
                          gate={selected.pendingApproval.gate}
                          dealId={selected.pendingApproval.dealId}
                        />
                      </div>
                    )}
                  </div>
                )}

                {messages.length === 0 && !selected.pendingApproval && (
                  <p className="text-sm text-muted">
                    No messages yet — start the thread below.
                  </p>
                )}
                {messages.map((m) => {
                  const author = userById.get(m.authorId);
                  return (
                    <div key={m.id} className="flex gap-2.5">
                      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-hmd-teal text-[0.65rem] font-semibold text-hmd-charcoal">
                        {author ? author.initials : "—"}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs text-muted">
                          <span className="font-medium text-foreground">
                            {author?.name ?? "Unknown"}
                          </span>{" "}
                          · {shortDate(m.createdAt)}
                        </p>
                        <p className="mt-0.5 whitespace-pre-wrap text-sm">
                          {m.body}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <MessageComposer
                contextType={selected.contextType}
                contextId={selected.contextId}
              />
            </Card>

            {/* Context panel — always in front of you (unlike email). */}
            <Card className="h-fit p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                Context
              </p>
              <p className="mt-2 text-sm font-semibold">{account?.name}</p>
              {account && (
                <p className="text-xs text-muted">
                  {account.industry} · {account.region}
                </p>
              )}

              {deal && (
                <div className="mt-3 space-y-1.5 border-t border-border pt-3">
                  <p className="text-sm font-medium">{deal.name}</p>
                  <StageBadge stage={deal.stage} />
                  <p className="text-xs text-muted">
                    {eur(deal.tcv)} TCV · {deal.channel}
                  </p>
                </div>
              )}

              {caseRow && (
                <div className="mt-3 space-y-1.5 border-t border-border pt-3">
                  <p className="text-sm font-medium">{caseRow.title}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge
                      tone={
                        caseRow.priority === "high" ||
                        caseRow.priority === "urgent"
                          ? "red"
                          : "default"
                      }
                    >
                      {caseRow.priority}
                    </Badge>
                    <Badge tone={caseRow.status === "resolved" ? "green" : "default"}>
                      {caseRow.status.replace("_", " ")}
                    </Badge>
                  </div>
                </div>
              )}

              <Link
                href={accountHref}
                className="mt-4 inline-block text-xs font-medium text-foreground underline-offset-2 hover:underline"
              >
                Open account →
              </Link>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
