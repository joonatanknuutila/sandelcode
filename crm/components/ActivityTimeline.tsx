import {
  Activity,
  ActivityType,
  STAGE_LABELS,
  REP_STAGE_LABELS,
  STAGE_ORDER,
} from "@/lib/types";
import { getUsers } from "@/lib/db";
import { shortDate } from "@/lib/format";
import { Card } from "./ui";

// Stage-change activity bodies are stored once with the internal (jargon) stage
// names and shared across roles. In rep mode swap them to the plain rep labels
// at display time so reps never see "RFI"/"RFP"/etc. Two stored formats exist:
// the title-cased STAGE_LABELS string ("RFP / offer given") and a lowercase
// DB-enum-word form ("rfp offer given"). We cover both. Multi-word phrases only,
// so "won"/"lost" in ordinary prose isn't touched. Longest phrases first so no
// phrase clobbers a shorter overlap. Power roles render the body unchanged.
const PLAIN_BODY_SUBS: [string, string][] = (() => {
  const subs: [string, string][] = [];
  const push = (from: string, to: string) => {
    if (from && from !== to && !subs.some((e) => e[0] === from)) subs.push([from, to]);
  };
  for (const s of STAGE_ORDER) {
    const to = REP_STAGE_LABELS[s];
    const jargon = STAGE_LABELS[s];
    const rawEnumWords = jargon.toLowerCase().replace(/\s*\/\s*/g, " ").replace(/\s+/g, " ").trim();
    push(jargon, to);
    if (rawEnumWords.includes(" ")) push(rawEnumWords, to); // skip single tokens (won/lost)
  }
  return subs.sort((a, b) => b[0].length - a[0].length);
})();

function repBody(body: string): string {
  let out = body;
  for (const [from, to] of PLAIN_BODY_SUBS) out = out.split(from).join(to);
  return out;
}

const TYPE_LABEL: Record<ActivityType, string> = {
  note: "Note",
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  stage_change: "Stage change",
  offer_sent: "Offer sent",
  case_opened: "Case opened",
};

const TYPE_DOT: Record<ActivityType, string> = {
  note: "bg-hmd-gray",
  call: "bg-hmd-teal-600",
  email: "bg-hmd-teal-600",
  meeting: "bg-hmd-teal-600",
  stage_change: "bg-hmd-orange",
  offer_sent: "bg-hmd-orange",
  case_opened: "bg-danger",
};

export async function ActivityTimeline({
  activities,
  plain = false,
}: {
  activities: Activity[];
  /** Rep-facing: larger, easier-to-read text. */
  plain?: boolean;
}) {
  if (activities.length === 0) {
    return (
      <p className={`text-muted ${plain ? "text-base" : "text-sm"}`}>
        No activity recorded yet.
      </p>
    );
  }
  const users = await getUsers();
  const nameById = new Map(users.map((u) => [u.id, u.name]));
  return (
    <Card className="p-4">
      <ol className="relative space-y-5 border-l border-border pl-5">
        {activities.map((a) => {
          const author = nameById.get(a.authorId);
          return (
            <li key={a.id} className="relative">
              <span
                className={`absolute -left-[1.45rem] top-1 h-2.5 w-2.5 rounded-full ${TYPE_DOT[a.type]} ring-2 ring-surface`}
              />
              <div className="flex items-center justify-between">
                <p className={`font-medium uppercase tracking-wide text-muted ${plain ? "text-sm" : "text-xs"}`}>
                  {TYPE_LABEL[a.type]}
                </p>
                <p className={`text-muted ${plain ? "text-sm" : "text-xs"}`}>{shortDate(a.createdAt)}</p>
              </div>
              <p className={`mt-0.5 ${plain ? "text-base" : "text-sm"}`}>{plain ? repBody(a.body) : a.body}</p>
              {author && (
                <p className={`mt-0.5 text-muted ${plain ? "text-sm" : "text-xs"}`}>{author}</p>
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
