import Link from "next/link";
import {
  getAccountsForRep,
  getCasesForAccount,
  getCurrentUser,
  getDealsForAccount,
  weightedValue,
} from "@/lib/db";
import { eur } from "@/lib/format";
import { Badge, Card, StageBadge } from "@/components/ui";

// Sales Rep — "all my accounts + deal status at a glance".
export default async function AccountsPage() {
  const user = await getCurrentUser();
  if (!user) return <p className="text-sm text-muted">No user signed in.</p>;
  const accounts = await getAccountsForRep(user.id);
  const cards = await Promise.all(
    accounts.map(async (account) => {
      const [deals, cases] = await Promise.all([
        getDealsForAccount(account.id),
        getCasesForAccount(account.id),
      ]);
      const openCases = cases.filter((c) => c.status !== "resolved");
      const tcv = deals.reduce((s, d) => s + d.tcv, 0);
      const weighted = deals.reduce((s, d) => s + weightedValue(d), 0);
      return { account, deals, openCases, tcv, weighted };
    }),
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My accounts</h1>
        <p className="mt-1 text-sm text-muted">
          {accounts.length} accounts in your book.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {cards.map(({ account, deals, openCases, tcv, weighted }) => {
          return (
            <Link key={account.id} href={`/rep/accounts/${account.id}`}>
              <Card className="h-full p-5 transition-colors hover:border-hmd-teal-600 hover:shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{account.name}</h2>
                    <p className="text-xs text-muted">
                      {account.industry} · {account.region}
                    </p>
                  </div>
                  <Badge tone={account.channel === "reseller" ? "amber" : "blue"}>
                    {account.channel}
                  </Badge>
                </div>
                {account.summary && (
                  <p className="mt-2 line-clamp-2 text-sm text-muted">
                    {account.summary}
                  </p>
                )}
                <div className="mt-4 flex items-center gap-4 text-xs text-muted">
                  <span>
                    <strong className="text-foreground">{deals.length}</strong>{" "}
                    deals
                  </span>
                  <span>
                    <strong className="text-foreground">{eur(tcv)}</strong> TCV
                  </span>
                  <span>
                    <strong className="text-hmd-teal-700">{eur(weighted)}</strong>{" "}
                    weighted
                  </span>
                  {openCases.length > 0 && (
                    <span className="text-warning">
                      {openCases.length} open case
                      {openCases.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {deals.slice(0, 3).map((d) => (
                    <StageBadge key={d.id} stage={d.stage} />
                  ))}
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
