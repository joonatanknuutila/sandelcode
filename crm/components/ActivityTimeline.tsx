import { Activity, ActivityType } from "@/lib/types";
import { getUsers } from "@/lib/db";
import { shortDate } from "@/lib/format";
import { Card } from "./ui";

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
}: {
  activities: Activity[];
}) {
  if (activities.length === 0) {
    return <p className="text-sm text-muted">No activity recorded yet.</p>;
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
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  {TYPE_LABEL[a.type]}
                </p>
                <p className="text-xs text-muted">{shortDate(a.createdAt)}</p>
              </div>
              <p className="mt-0.5 text-sm">{a.body}</p>
              {author && (
                <p className="mt-0.5 text-xs text-muted">{author}</p>
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
