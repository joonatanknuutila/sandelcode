import { getAccounts, getOpenDeals } from "@/lib/db";
import { confidence, ConfidenceBand } from "@/lib/ai/confidence";
import { forecastNarrative } from "@/lib/ai/forecast";
import { eur } from "@/lib/format";
import { STAGE_LABELS } from "@/lib/types";
import { Card, SectionTitle, StatTile } from "@/components/ui";
import { Assistant } from "../Assistant";
import { MeetingCapture } from "../MeetingCapture";

// AI workspace — the differentiator layer, all in one reachable page.
// Server-renders confidence + forecast (deterministic, grounded); the assistant
// and meeting-capture are interactive client widgets. No model key needed —
// everything degrades to grounded fallbacks and is labelled honestly.

const BAND_TONE: Record<ConfidenceBand, string> = {
  high: "bg-green-100 text-green-700",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-danger/10 text-danger ring-1 ring-danger/30",
};

export default async function AiWorkspace() {
  const [forecast, openDeals, accounts] = await Promise.all([
    forecastNarrative(),
    getOpenDeals(),
    getAccounts(),
  ]);
  const f = forecast.figures;
  const accountById = new Map(accounts.map((a) => [a.id, a]));

  // Riskiest-first: open deals scored by confidence.
  const scored = (
    await Promise.all(
      openDeals.map(async (d) => ({ deal: d, c: await confidence(d) })),
    )
  ).sort((a, b) => a.c.score - b.c.score);

  // Account to demo meeting-capture against (first with a deal).
  const captureAccountId = openDeals[0]?.accountId ?? accounts[0]?.id;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI workspace</h1>
        <p className="mt-1 text-sm text-muted">
          Grounded, persona-tailored AI. Read-only by default; the only write
          path (meeting capture) is gated behind your approval.
          {!forecast.modelUsed && (
            <span className="ml-1 text-xs">· model offline — deterministic fallbacks</span>
          )}
        </p>
      </div>

      {/* Assistant */}
      <Assistant role="tam" scopeLabel="your accounts & cases" />

      {/* Forecast narrative */}
      <section>
        <SectionTitle>Forecast narrative</SectionTitle>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <span className="rounded bg-hmd-teal px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-hmd-charcoal">
              AI
            </span>
            <p className="text-sm font-semibold">Weighted pipeline outlook</p>
          </div>
          <p className="mt-2 text-sm text-foreground">{forecast.text}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Committed" value={eur(f.committed)} hint="≥80%, bankable" tone="success" />
            <StatTile label="At-risk" value={eur(f.atRisk)} hint="mid-stage, weighted" tone="warning" />
            <StatTile label="Upside" value={eur(f.upside)} hint="early, weighted" />
            <StatTile label="Near-term units" value={String(f.nearTermDevices)} hint="for component buying" />
          </div>
        </Card>
      </section>

      {/* Confidence scoring */}
      <section>
        <SectionTitle>Deal confidence — riskiest first</SectionTitle>
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-background text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Deal</th>
                <th className="px-4 py-2.5 font-medium">Stage</th>
                <th className="px-4 py-2.5 text-center font-medium">Confidence</th>
                <th className="px-4 py-2.5 font-medium">Why</th>
              </tr>
            </thead>
            <tbody>
              {scored.map(({ deal, c }) => {
                const account = accountById.get(deal.accountId);
                return (
                  <tr key={deal.id} className="border-t border-border align-top">
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{account?.name}</p>
                      <p className="text-xs text-muted">{eur(deal.tcv)} · 3-yr</p>
                    </td>
                    <td className="px-4 py-2.5 text-muted">{STAGE_LABELS[deal.stage]}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${BAND_TONE[c.band]}`}>
                        {c.score}%
                      </span>
                      {c.score !== c.base && (
                        <p className="mt-0.5 text-[10px] text-muted">base {c.base}%</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted">{c.reasons.join(" ")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
        <p className="mt-2 text-xs text-muted">
          Rule logic; Finance can override the realistic number per deal (feeds gap-to-target).
        </p>
      </section>

      {/* Meeting capture — the human-approval gate */}
      {captureAccountId && (
        <section>
          <SectionTitle>Meeting → CRM ({accountById.get(captureAccountId)?.name})</SectionTitle>
          <MeetingCapture accountId={captureAccountId} />
        </section>
      )}
    </div>
  );
}
