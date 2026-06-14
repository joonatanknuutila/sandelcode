import { Channel, Stage, STAGE_LABELS, REP_STAGE_LABELS } from "@/lib/types";

// Visual pipeline progress. Reseller deals skip "Contract negotiation"
// (brief 2.3), so we drop it from the stepper for reseller channel.
const DIRECT_FLOW: Stage[] = [
  "interest",
  "rfi",
  "rfp",
  "customer_test",
  "contract_negotiation",
  "won",
];
const RESELLER_FLOW: Stage[] = [
  "interest",
  "rfi",
  "rfp",
  "customer_test",
  "won",
];

export function StageStepper({
  stage,
  channel,
  plain = false,
}: {
  stage: Stage;
  channel: Channel;
  /** Rep-facing: plain-language stage names + larger pills. */
  plain?: boolean;
}) {
  const flow = channel === "reseller" ? RESELLER_FLOW : DIRECT_FLOW;
  const lost = stage === "lost";
  const currentIdx = flow.indexOf(stage);
  const labels = plain ? REP_STAGE_LABELS : STAGE_LABELS;
  const sizeClass = plain ? "px-3.5 py-1.5 text-sm" : "px-3 py-1 text-xs";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {flow.map((s, i) => {
        const done = !lost && i < currentIdx;
        const current = !lost && i === currentIdx;
        return (
          <div
            key={s}
            className={`rounded-full font-medium ${sizeClass} ${
              current
                ? "bg-hmd-teal text-hmd-teal-700"
                : done
                  ? "bg-hmd-teal/20 text-foreground"
                  : "bg-background text-muted"
            }`}
          >
            {labels[s]}
          </div>
        );
      })}
      {lost && (
        <div className={`rounded-full border border-red-400/35 bg-red-400/10 font-medium text-red-200 ${sizeClass}`}>
          Lost
        </div>
      )}
    </div>
  );
}
