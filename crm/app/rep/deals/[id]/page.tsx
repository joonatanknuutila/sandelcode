import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAccount,
  getActivitiesForDeal,
  getDeal,
  getOffersForDeal,
} from "@/lib/db";
import { nextBestAction } from "@/lib/ai";
import { eur, shortDate } from "@/lib/format";
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
import { DealActions, LogActivityButton } from "./DealActions";
import { setForecastPhasesAction } from "../../account-actions";

const OFFER_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_sm: "Pending Sales Manager",
  pending_finance: "Pending Finance",
  approved: "Approved",
  rejected: "Rejected",
};

export default async function DealDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const deal = await getDeal(id);
  if (!deal) notFound();

  const [account, activities, offers] = await Promise.all([
    getAccount(deal.accountId),
    getActivitiesForDeal(id),
    getOffersForDeal(id),
  ]);
  if (!account) notFound();

  // Grounded NBA — async, uses full timeline + offers
  const nba = await nextBestAction(deal, activities, offers);

  // Derive per-unit price + per-quarter service rate from the seeded forecast
  // so inline edits keep the same economics.
  const sample = deal.forecast.find((p) => p.devices > 0);
  const unitPrice = sample ? Math.round(sample.deviceRevenue / sample.devices) : 720;
  const serviceQuarterly = sample
    ? Math.round(sample.serviceRevenue / sample.devices)
    : 36;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link
        href={`/rep/accounts/${account.id}`}
        className="text-sm text-muted hover:text-foreground"
      >
        ← {account.name}
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {deal.name}
            </h1>
            <StageBadge stage={deal.stage} />
            {deal.channel === "reseller" && <Badge tone="amber">reseller</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted">
            {account.name} · expected close {shortDate(deal.expectedCloseDate)}
          </p>
        </div>
        <div className="flex gap-2">
          {/* Wired "+ Log activity" button */}
          <LogActivityButton dealId={deal.id} accountId={deal.accountId} />
          <Link href={`/rep/deals/${deal.id}/offer`}>
            <Button>Build &amp; send offer</Button>
          </Link>
        </div>
      </div>

      <Card className="p-4">
        <StageStepper stage={deal.stage} channel={deal.channel} />
      </Card>

      {/* AI next best action — hero banner */}
      <Card className="border-[#e4ff00]/40 bg-[#e4ff00]/5 p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 rounded-md bg-[#e4ff00] px-2 py-1 text-xs font-semibold text-black">
            {nba.modelUsed ? "AI" : "AI"}
          </span>
          <div className="flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Next best action{!nba.modelUsed && (
                <span className="ml-2 text-[10px] font-normal normal-case text-muted/60">
                  (deterministic)
                </span>
              )}
            </p>
            <p className="mt-1 font-medium">{nba.headline}</p>
            <p className="mt-1 text-sm text-muted">{nba.detail}</p>
          </div>

          {/* CTA — open_offer links directly; others open modals via DealActions */}
          {nba.cta.kind === "open_offer" ? (
            <Link href={`/rep/deals/${deal.id}/offer`}>
              <Button variant="secondary">{nba.cta.label}</Button>
            </Link>
          ) : (
            <DealActions
              dealId={deal.id}
              accountId={deal.accountId}
              dealName={deal.name}
              accountName={account.name}
              currentStage={deal.stage}
              cta={nba.cta}
              nbaDetail={nba.detail}
            />
          )}
        </div>
      </Card>

      {/* Forecast */}
      <section>
        <SectionTitle>3-year time-phased forecast</SectionTitle>
        <ForecastGrid
          forecast={deal.forecast}
          serviceModel={deal.serviceModel}
          unitPrice={unitPrice}
          serviceQuarterly={serviceQuarterly}
          dealId={deal.id}
          accountId={deal.accountId}
          onSave={setForecastPhasesAction}
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
                  <p className="font-medium">
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
                    {OFFER_STATUS_LABEL[o.status]}
                  </Badge>
                </div>
                <ul className="mt-2 space-y-1 text-sm text-muted">
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
                  <p className="mt-2 text-xs italic text-muted">
                    &ldquo;{o.justification}&rdquo;
                  </p>
                )}
                <div className="mt-3">
                  <Link href={`/rep/deals/${deal.id}/offer`}>
                    <Button variant="secondary" className="text-xs">
                      View offer →
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
            {offers.length === 0 && (
              <Card className="p-4 text-sm text-muted">
                No offers yet. Build one from the product catalog.
              </Card>
            )}
          </div>
        </section>

        {/* Timeline */}
        <section>
          <SectionTitle>Deal activity</SectionTitle>
          <ActivityTimeline activities={activities} />
        </section>
      </div>
    </div>
  );
}
