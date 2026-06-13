import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAccount,
  getActivitiesForAccount,
  getCasesForAccount,
  getContactsForAccount,
  getDealsForAccount,
  getUser,
  weightedValue,
} from "@/lib/api";
import { eur, shortDate } from "@/lib/format";
import { Badge, Button, Card, SectionTitle, StageBadge } from "@/components/ui";
import { ActivityTimeline } from "@/components/ActivityTimeline";

// Account 360 — deals + active cases + full timeline on one page, the rep's
// "everything about this customer" view. params is a Promise in Next 16.
export default async function AccountDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const account = getAccount(id);
  if (!account) notFound();

  const contacts = getContactsForAccount(id);
  const deals = getDealsForAccount(id);
  const cases = getCasesForAccount(id);
  const activities = getActivitiesForAccount(id);
  const tam = account.tamId ? getUser(account.tamId) : undefined;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Link
        href="/rep/accounts"
        className="text-sm text-muted hover:text-foreground"
      >
        ← My accounts
      </Link>

      {/* Header */}
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
        <div className="flex gap-2">
          <Button variant="secondary">+ Open service case</Button>
          <Button>+ New deal</Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: deals + cases */}
        <div className="space-y-6 lg:col-span-2">
          <section>
            <SectionTitle>Deals</SectionTitle>
            <div className="space-y-2">
              {deals.map((d) => (
                <Link key={d.id} href={`/rep/deals/${d.id}`}>
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
                        <p className="text-xs text-muted">
                          {eur(weightedValue(d))} weighted
                        </p>
                      </div>
                      <StageBadge stage={d.stage} />
                    </div>
                  </Card>
                </Link>
              ))}
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
                    {c.escalatedToThirdParty && (
                      <Badge tone="amber">3rd party</Badge>
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
                    <Badge
                      tone={c.status === "resolved" ? "green" : "default"}
                    >
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

        {/* Right: contacts + timeline */}
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
                  <p className="text-xs text-hmd-teal-700">{c.email}</p>
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
