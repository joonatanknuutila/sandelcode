import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAccount,
  getActivitiesForAccount,
  getCasesForAccount,
  getContactsForAccount,
  getCurrentUser,
  getDealsForAccount,
  getUser,
  getUsers,
} from "@/lib/db";
import { isSensitiveIndustry } from "@/lib/ai/enrich";
import { shortDate } from "@/lib/format";
import { Badge, Card, SectionTitle } from "@/components/ui";
import { ActivityTimeline } from "@/components/ActivityTimeline";
import { AccountDealsPanel } from "@/components/AccountDealsPanel";
import { AddNote } from "@/components/AddNote";
import { AccountActionBar } from "./NewRecordModals";
import { EnrichmentPanel } from "./EnrichmentPanel";

// Rep account workspace (§3): the timeline is the heart, capture is on top.
// Main column = Add note + the chronological event stream. Side column = the
// reference facts (basics, people, deals, cases). This is a rep-only layout —
// power roles keep the shared AccountDetailView. params is a Promise in Next 16.
export default async function AccountDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const account = await getAccount(id);
  if (!account) notFound();

  const [contacts, deals, cases, activities, tam, currentUser, allUsers] =
    await Promise.all([
      getContactsForAccount(id),
      getDealsForAccount(id),
      getCasesForAccount(id),
      getActivitiesForAccount(id),
      account.tamId ? getUser(account.tamId) : Promise.resolve(null),
      getCurrentUser(),
      getUsers(),
    ]);
  const tamUsers = allUsers.filter((u) => u.role === "tam");
  const sensitive = isSensitiveIndustry(account.industry);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Link href="/rep/accounts" className="text-base text-muted hover:text-foreground">
        ← My customers
      </Link>

      {/* Header — name + the action bar ordered by frequency. */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">{account.name}</h1>
            {account.channel === "reseller" && <Badge tone="amber">Partner</Badge>}
          </div>
          <p className="mt-2 text-base text-muted">
            {account.industry} · {account.region}
            {tam && ` · Tech contact: ${tam.name}`}
          </p>
        </div>
        <AccountActionBar
          accountId={id}
          currentUserId={currentUser?.id ?? ""}
          tamUsers={tamUsers}
          defaultTamId={account.tamId}
          existingDeals={deals.map((d) => ({ id: d.id, name: d.name }))}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column — where the rep works: capture on top, timeline below. */}
        <div className="space-y-6 lg:col-span-2">
          <AddNote
            accountId={id}
            sensitive={sensitive}
            heading="Add note"
            placeholder="Write what just happened — a call, a reply, a commitment. Or paste an email thread."
          />

          <section>
            <SectionTitle>History</SectionTitle>
            <ActivityTimeline activities={activities} plain />
          </section>
        </div>

        {/* Side column — reference only. */}
        <div className="space-y-6">
          <section>
            <SectionTitle>Account</SectionTitle>
            <Card className="space-y-2 p-4 text-sm">
              <Row label="Sector" value={account.industry} />
              <Row label="Region" value={account.region} />
              {account.website && (
                <Row
                  label="Website"
                  value={
                    <a
                      href={account.website.startsWith("http") ? account.website : `https://${account.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-hmd-teal hover:underline"
                    >
                      {account.website}
                    </a>
                  }
                />
              )}
              {tam && <Row label="Tech contact" value={tam.name} />}
              {account.summary && (
                <p className="border-t border-border pt-2 text-sm text-foreground">
                  {account.summary}
                </p>
              )}
              <div className="border-t border-border pt-2">
                <EnrichmentPanel
                  accountId={id}
                  accountName={account.name}
                  sensitive={sensitive}
                  subtle
                />
              </div>
            </Card>
          </section>

          <section>
            <SectionTitle>People</SectionTitle>
            <Card className="divide-y divide-border">
              {contacts.map((c) => (
                <div key={c.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-base font-medium">{c.name}</p>
                    {c.primary && <Badge tone="blue">main contact</Badge>}
                  </div>
                  <p className="text-sm text-muted">{c.title}</p>
                  <p className="text-sm text-foreground">{c.email}</p>
                </div>
              ))}
              {contacts.length === 0 && (
                <p className="p-3 text-base text-muted">No contacts yet.</p>
              )}
            </Card>
          </section>

          <AccountDealsPanel
            accountId={id}
            currentUserId={currentUser?.id}
            deals={deals}
            dealHref="/rep/deals"
            plain
            editable={false}
          />

          <section>
            <SectionTitle>Support tickets</SectionTitle>
            <div className="space-y-2">
              {cases.map((c) => (
                <Card key={c.id} className="flex items-center justify-between gap-2 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-medium">{c.title}</p>
                    <p className="text-sm text-muted">
                      Opened {shortDate(c.createdAt)}
                      {c.slaDueDate && ` · Due ${shortDate(c.slaDueDate)}`}
                    </p>
                  </div>
                  <Badge
                    tone={c.priority === "high" || c.priority === "urgent" ? "red" : "default"}
                  >
                    {c.priority}
                  </Badge>
                </Card>
              ))}
              {cases.length === 0 && (
                <p className="text-base text-muted">No support tickets.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
      <span className="text-right text-sm text-foreground">{value}</span>
    </div>
  );
}
