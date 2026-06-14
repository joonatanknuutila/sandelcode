import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAccount,
  getActivitiesForDeal,
  getDeal,
  getDealsForAccount,
  getOffersForDeal,
  getUser,
  isOverdue,
  isStalled,
} from "@/lib/db";
import { nextBestAction } from "@/lib/ai";
import { eur, relativeDays, shortDate } from "@/lib/format";
import {
  Badge,
  Button,
  Card,
  SectionTitle,
  StageBadge,
} from "@/components/ui";
import { StageStepper } from "@/components/StageStepper";
import { ForecastGrid } from "@/components/ForecastGrid";
import { ActivityTimeline } from "@/components/ActivityTimeline";

// Sales Manager deal lens — the SAME deal a rep works, framed for the manager:
// who owns it, why it's at risk, and the levers (board / inbox) a manager pulls.
// Read-only by design — the rep drives the deal; the SM coaches and unblocks.
// Mirrors /sm/accounts/[id] (each role gets its own detail route) so opening a
// deal from the SM dashboard or Team Board keeps the manager in their own view.
const OFFER_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_sm: "Awaiting your approval",
  pending_finance: "With Finance",
  approved: "Approved",
  rejected: "Rejected",
};

export default async function SmDealDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const deal = await getDeal(id);
  if (!deal) notFound();

  const [account, owner, activities, offers, accountDeals] = await Promise.all([
    getAccount(deal.accountId),
    getUser(deal.ownerId),
    getActivitiesForDeal(id),
    getOffersForDeal(id),
    getDealsForAccount(deal.accountId),
  ]);
  if (!account) notFound();

  // Follow-on / original-opportunity linkage — kept in the SM view (links stay
  // inside /sm/deals).
  const parentDeal = deal.parentDealId
    ? accountDeals.find((d) => d.id === deal.parentDealId)
    : undefined;
  const followOnDeals = accountDeals.filter((d) => d.parentDealId === deal.id);

  // Deal-risk flags — the reason this deal lands on the manager's radar.
  const overdue = isOverdue(deal);
  const stalled = isStalled(deal);
  const daysOverdue = overdue ? relativeDays(deal.expectedCloseDate) : 0;
  const idleDays = relativeDays(deal.updatedAt);

  // Grounded NBA — shown read-only here as coaching context ("what the rep
  // should do next"), not as a manager action.
  const nba = await nextBestAction(deal, activities, offers);

  // Derive per-unit economics from the seeded forecast (same as the rep view).
  const sample = deal.forecast.find((p) => p.devices > 0);
  const unitPrice = sample ? Math.round(sample.deviceRevenue / sample.devices) : 720;
  const serviceQuarterly = sample
    ? Math.round(sample.serviceRevenue / sample.devices)
    : 36;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link
        href={`/sm/accounts/${account.id}`}
        className="text-base text-muted hover:text-foreground"
      >
        ← {account.name}
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">
              {deal.name}
            </h1>
            <StageBadge stage={deal.stage} plain />
            {deal.channel === "reseller" && (
              <Badge tone="amber">Partner deal</Badge>
            )}
            {overdue && <Badge tone="red">{daysOverdue}d overdue</Badge>}
            {!overdue && stalled && <Badge tone="amber">{idleDays}d idle</Badge>}
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-base text-muted">
            <span className="font-medium text-foreground">{account.name}</span>
            <span>·</span>
            <Badge>{owner?.initials ?? "?"}</Badge>
            <span>{owner?.name ?? "Unassigned"}</span>
            <span>·</span>
            {overdue ? (
              <span className="font-medium text-warning">
                was due {shortDate(deal.expectedCloseDate)}
              </span>
            ) : (
              <span>expected to close {shortDate(deal.expectedCloseDate)}</span>
            )}
            <span>·</span>
            <span>{eur(deal.tcv)} TCV</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* The manager's levers — reassign / restage on the board, decide
              discounts in the inbox. The deal itself is the rep's to run. */}
          <Link href={`/sm/pipeline?rep=${deal.ownerId}`}>
            <Button variant="secondary" className="min-h-[44px] text-base">
              Open on Team Board
            </Button>
          </Link>
        </div>
      </div>

      {/* Follow-on / original-opportunity linkage */}
      {(parentDeal || followOnDeals.length > 0) && (
        <Card className="space-y-2 p-4">
          {parentDeal && (
            <p className="text-base">
              <span className="text-muted">Follow-on order of</span>{" "}
              <Link
                href={`/sm/deals/${parentDeal.id}`}
                className="font-medium text-foreground underline-offset-2 hover:underline"
              >
                {parentDeal.name}
              </Link>{" "}
              <span className="text-muted">
                — the original {eur(parentDeal.tcv, false)} opportunity.
              </span>
            </p>
          )}
          {followOnDeals.length > 0 && (
            <div className="text-base">
              <span className="text-muted">Follow-on orders from this deal:</span>
              <ul className="mt-1 space-y-1">
                {followOnDeals.map((f) => (
                  <li key={f.id}>
                    <Link
                      href={`/sm/deals/${f.id}`}
                      className="font-medium text-foreground underline-offset-2 hover:underline"
                    >
                      {f.name}
                    </Link>{" "}
                    <span className="text-muted">· {eur(f.tcv, false)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      <Card className="p-4">
        <StageStepper stage={deal.stage} channel={deal.channel} />
      </Card>

      {/* Coaching context — what the rep should do next, read-only for the SM. */}
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            What this deal needs
            {!nba.modelUsed && (
              <span className="ml-1 normal-case text-muted">
                · suggested from this deal&apos;s history
              </span>
            )}
          </p>
          <Badge tone="blue">AI</Badge>
        </div>
        <p className="mt-2 text-lg font-medium">{nba.headline}</p>
        <p className="mt-1 text-base text-muted">{nba.detail}</p>
      </Card>

      {/* Forecast — read-only manager lens. */}
      <section>
        <SectionTitle>3-year forecast</SectionTitle>
        <ForecastGrid
          forecast={deal.forecast}
          serviceModel={deal.serviceModel}
          unitPrice={unitPrice}
          serviceQuarterly={serviceQuarterly}
          readOnly
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Offers */}
        <section>
          <SectionTitle>Offers</SectionTitle>
          <div className="space-y-2">
            {offers.map((o) => (
              <Card key={o.id} className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-base font-medium">
                    Offer v{o.version} · {eur(o.total, false)}
                  </p>
                  <Badge
                    tone={
                      o.status === "approved"
                        ? "green"
                        : o.status === "rejected"
                          ? "red"
                          : "amber"
                    }
                  >
                    {OFFER_STATUS_LABEL[o.status] ?? o.status}
                  </Badge>
                </div>
                <ul className="mt-2 space-y-1 text-base text-muted">
                  {o.lines.map((l) => (
                    <li key={l.productId} className="flex justify-between">
                      <span>
                        {l.name} × {l.quantity}
                        {l.discountPct > 0 && (
                          <span className="font-medium text-warning">
                            {" "}
                            −{l.discountPct}%
                          </span>
                        )}
                      </span>
                      <span>{eur(l.quantity * l.unitPrice, false)}</span>
                    </li>
                  ))}
                </ul>
                {o.justification && (
                  <p className="mt-2 text-sm italic text-muted">
                    &ldquo;{o.justification}&rdquo;
                  </p>
                )}
                {o.status === "pending_sm" && (
                  <div className="mt-3">
                    <Link href="/sm/inbox">
                      <Button variant="secondary" className="min-h-[44px] text-base">
                        Review in Inbox →
                      </Button>
                    </Link>
                  </div>
                )}
              </Card>
            ))}
            {offers.length === 0 && (
              <Card className="p-4 text-base text-muted">
                No offers on this deal yet.
              </Card>
            )}
          </div>
        </section>

        {/* Timeline */}
        <section>
          <SectionTitle>History</SectionTitle>
          <ActivityTimeline activities={activities} />
        </section>
      </div>
    </div>
  );
}
