// Shared AccountDetail (brief Block 2 — "the heart of the system"). One layout,
// every role's lens: deals + cases + contacts + the one shared timeline. The
// route passes role-scoped data, a back link, and an optional action slot (the
// rep's quick actions; read-only roles pass none).

import Link from "next/link";
import { Account, Activity, Case, Contact, Deal, User } from "@/lib/types";
import { eur, shortDate } from "@/lib/format";
import { Badge, Card, SectionTitle, StageBadge } from "./ui";
import { ActivityTimeline } from "./ActivityTimeline";

export function AccountDetailView({
  account,
  contacts,
  deals,
  cases,
  activities,
  tam,
  backHref,
  backLabel,
  dealHref,
  actions,
}: {
  account: Account;
  contacts: Contact[];
  deals: Deal[];
  cases: Case[];
  activities: Activity[];
  tam: User | null;
  backHref: string;
  backLabel: string;
  /** Deal card link base, e.g. "/rep/deals". Null = deals are not clickable. */
  dealHref?: string | null;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Link href={backHref} className="text-sm text-muted hover:text-foreground">
        ← {backLabel}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {account.name}
            </h1>
            <Badge tone={account.channel === "reseller" ? "amber" : "blue"}>
              {account.channel}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted">
            {account.industry} · {account.region}
            {account.website && ` · ${account.website}`}
            {tam && ` · TAM: ${tam.name}`}
          </p>
          {account.summary && (
            <p className="mt-2 max-w-2xl text-sm">{account.summary}</p>
          )}
        </div>
        {actions}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section>
            <SectionTitle>Deals</SectionTitle>
            <div className="space-y-2">
              {deals.map((d) => {
                const row = (
                  <Card className="flex items-center justify-between p-4 transition-colors hover:border-hmd-teal-600">
                    <div>
                      <p className="font-medium">{d.name}</p>
                      <p className="text-xs text-muted">
                        Expected close {shortDate(d.expectedCloseDate)}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-semibold">{eur(d.tcv)}</p>
                      </div>
                      <StageBadge stage={d.stage} />
                    </div>
                  </Card>
                );
                return dealHref ? (
                  <Link key={d.id} href={`${dealHref}/${d.id}`}>
                    {row}
                  </Link>
                ) : (
                  <div key={d.id}>{row}</div>
                );
              })}
              {deals.length === 0 && (
                <p className="text-sm text-muted">No deals yet.</p>
              )}
            </div>
          </section>

          <section>
            <SectionTitle>Service cases</SectionTitle>
            <div className="space-y-2">
              {cases.map((c) => (
                <Card key={c.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">{c.title}</p>
                    <p className="text-xs text-muted">
                      Opened {shortDate(c.createdAt)}
                      {c.slaDueDate && ` · SLA ${shortDate(c.slaDueDate)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.escalatedToThirdParty && <Badge tone="amber">3rd party</Badge>}
                    <Badge
                      tone={
                        c.priority === "high" || c.priority === "urgent"
                          ? "red"
                          : "default"
                      }
                    >
                      {c.priority}
                    </Badge>
                    <Badge tone={c.status === "resolved" ? "green" : "default"}>
                      {c.status.replace("_", " ")}
                    </Badge>
                  </div>
                </Card>
              ))}
              {cases.length === 0 && (
                <p className="text-sm text-muted">No open cases.</p>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section>
            <SectionTitle>Contacts</SectionTitle>
            <Card className="divide-y divide-border">
              {contacts.map((c) => (
                <div key={c.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{c.name}</p>
                    {c.primary && <Badge tone="blue">primary</Badge>}
                  </div>
                  <p className="text-xs text-muted">{c.title}</p>
                  <p className="text-xs text-foreground">{c.email}</p>
                </div>
              ))}
              {contacts.length === 0 && (
                <p className="p-3 text-sm text-muted">No contacts.</p>
              )}
            </Card>
          </section>

          <section>
            <SectionTitle>Activity timeline</SectionTitle>
            <ActivityTimeline activities={activities} />
          </section>
        </div>
      </div>
    </div>
  );
}
