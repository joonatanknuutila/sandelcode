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
  plain = false,
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
  /** Rep-facing: plain words, larger text, no internal codes. */
  plain?: boolean;
}) {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Link
        href={backHref}
        className={`text-muted hover:text-foreground ${plain ? "text-base" : "text-sm"}`}
      >
        ← {backLabel}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className={`font-semibold tracking-tight ${plain ? "text-3xl" : "text-2xl"}`}>
              {account.name}
            </h1>
            {plain ? (
              account.channel === "reseller" && (
                <Badge tone="amber">Partner</Badge>
              )
            ) : (
              <Badge tone={account.channel === "reseller" ? "amber" : "blue"}>
                {account.channel}
              </Badge>
            )}
          </div>
          <p className={`text-muted ${plain ? "mt-2 text-base" : "mt-1 text-sm"}`}>
            {account.industry} · {account.region}
            {account.website && ` · ${account.website}`}
            {tam && ` · ${plain ? "Tech contact" : "TAM"}: ${tam.name}`}
          </p>
          {account.summary && (
            <p className={`max-w-2xl ${plain ? "mt-2 text-base" : "mt-2 text-sm"}`}>
              {account.summary}
            </p>
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
                      <p className={`font-medium ${plain ? "text-base" : ""}`}>{d.name}</p>
                      <p className={`text-muted ${plain ? "text-sm" : "text-xs"}`}>
                        {plain ? "Expected to close" : "Expected close"}{" "}
                        {shortDate(d.expectedCloseDate)}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className={`font-semibold ${plain ? "text-lg" : ""}`}>{eur(d.tcv)}</p>
                      </div>
                      <StageBadge stage={d.stage} plain={plain} />
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
                <p className={`text-muted ${plain ? "text-base" : "text-sm"}`}>No deals yet.</p>
              )}
            </div>
          </section>

          <section>
            <SectionTitle>{plain ? "Support tickets" : "Service cases"}</SectionTitle>
            <div className="space-y-2">
              {cases.map((c) => (
                <Card key={c.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className={`font-medium ${plain ? "text-base" : ""}`}>{c.title}</p>
                    <p className={`text-muted ${plain ? "text-sm" : "text-xs"}`}>
                      Opened {shortDate(c.createdAt)}
                      {c.slaDueDate &&
                        ` · ${plain ? "Due" : "SLA"} ${shortDate(c.slaDueDate)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.escalatedToThirdParty && (
                      <Badge tone="amber">{plain ? "Outside help" : "3rd party"}</Badge>
                    )}
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
                <p className={`text-muted ${plain ? "text-base" : "text-sm"}`}>
                  {plain ? "No support tickets." : "No open cases."}
                </p>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section>
            <SectionTitle>{plain ? "People" : "Contacts"}</SectionTitle>
            <Card className="divide-y divide-border">
              {contacts.map((c) => (
                <div key={c.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <p className={`font-medium ${plain ? "text-base" : "text-sm"}`}>{c.name}</p>
                    {c.primary && (
                      <Badge tone="blue">{plain ? "main contact" : "primary"}</Badge>
                    )}
                  </div>
                  <p className={`text-muted ${plain ? "text-sm" : "text-xs"}`}>{c.title}</p>
                  <p className={`text-foreground ${plain ? "text-sm" : "text-xs"}`}>{c.email}</p>
                </div>
              ))}
              {contacts.length === 0 && (
                <p className={`p-3 text-muted ${plain ? "text-base" : "text-sm"}`}>No contacts.</p>
              )}
            </Card>
          </section>

          <section>
            <SectionTitle>{plain ? "History" : "Activity timeline"}</SectionTitle>
            <ActivityTimeline activities={activities} plain={plain} />
          </section>
        </div>
      </div>
    </div>
  );
}
