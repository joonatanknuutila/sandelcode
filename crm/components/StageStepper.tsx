import { Channel, Stage, STAGE_LABELS } from "@/lib/types";

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
}: {
  stage: Stage;
  channel: Channel;
}) {
  const flow = channel === "reseller" ? RESELLER_FLOW : DIRECT_FLOW;
  const lost = stage === "lost";
  const currentIdx = flow.indexOf(stage);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {flow.map((s, i) => {
        const done = !lost && i < currentIdx;
        const current = !lost && i === currentIdx;
        return (
          <div
            key={s}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              current
                ? "bg-hmd-teal-600 text-white"
                : done
                  ? "bg-hmd-teal/20 text-foreground"
                  : "bg-background text-muted"
            }`}
          >
            {STAGE_LABELS[s]}
          </div>
        );
      })}
      {lost && (
        <div className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
          Lost
        </div>
      )}
    </div>
  );
}
