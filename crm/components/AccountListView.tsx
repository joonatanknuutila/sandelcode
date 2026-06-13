// Shared AccountList (brief Block 2) — one component, every role's lens. The
// route fetches role-scoped accounts (rep = own book, tam = case accounts,
// manager/finance = all) and passes the summarised cards + a basePath in.

import Link from "next/link";
import { AccountCard } from "@/lib/types";
import { eur } from "@/lib/format";
import { Badge, Card, StageBadge } from "./ui";

export function AccountListView({
  cards,
  basePath,
  title,
  subtitle,
}: {
  cards: AccountCard[];
  /** Account detail link base, e.g. "/sm/accounts". */
  basePath: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted">{subtitle}</p>
      </div>

      {cards.length === 0 ? (
        <Card className="p-6 text-sm text-muted">No accounts to show.</Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {cards.map(({ account, dealsCount, openCases, tcv, weighted, stages }) => (
            <Link key={account.id} href={`${basePath}/${account.id}`}>
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
                <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted">
                  <span>
                    <strong className="text-foreground">{dealsCount}</strong> deals
                  </span>
                  <span>
                    <strong className="text-foreground">{eur(tcv)}</strong> TCV
                  </span>
                  <span>
                    <strong className="text-foreground">{eur(weighted)}</strong>{" "}
                    weighted
                  </span>
                  {openCases > 0 && (
                    <span className="text-warning">
                      {openCases} open case{openCases > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {stages.map((s, i) => (
                    <StageBadge key={i} stage={s} />
                  ))}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
