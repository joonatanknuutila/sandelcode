import { getAccounts, getConfidenceOverrides, getOpenDeals } from "@/lib/db";
import { confidence } from "@/lib/ai/confidence";
import { ConfidenceOverride, DealConfidenceVM } from "../ConfidenceOverride";

export default async function FinanceConfidencePage() {
  const [open, accounts, overrides] = await Promise.all([
    getOpenDeals(),
    getAccounts(),
    getConfidenceOverrides(),
  ]);
  const accountById = new Map(accounts.map((account) => [account.id, account]));

  const confidenceVMs: DealConfidenceVM[] = await Promise.all(
    open.map(async (deal) => {
      const score = await confidence(deal);
      const stored = overrides[deal.id];
      return {
        dealId: deal.id,
        dealName: deal.name,
        accountName: accountById.get(deal.accountId)?.name ?? "Unknown account",
        tcv: deal.tcv,
        base: score.base,
        score: score.score,
        band: score.band,
        reasons: score.reasons,
        storedOverride: stored?.value,
        storedReason: stored?.reason ?? undefined,
      };
    }),
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Confidence overrides
        </h1>
        <p className="mt-1 text-sm text-muted">
          Rules compute the score; Finance adjusts the realistic number that
          feeds gap-to-target and ordering.
        </p>
      </div>

      <ConfidenceOverride deals={confidenceVMs} />
    </div>
  );
}
