import { commitMeeting, CommitRequest } from "@/lib/ai/meeting";

// POST /api/meeting/commit — the ONLY write path for meeting capture.
// HARD GATE: refuses unless approved === true in the request body.
// Declining (approved !== true) writes NOTHING to the database.
export async function POST(req: Request) {
  let body: CommitRequest;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.accountId) {
    return Response.json({ error: "accountId is required" }, { status: 400 });
  }

  // Enforce the gate at the route layer as well — belt-and-suspenders.
  if (body.approved !== true) {
    return Response.json(
      { ok: false, activities: [], notes: [], error: "Not approved — nothing written." },
      { status: 422 },
    );
  }

  const result = await commitMeeting(body);
  return Response.json(result, { status: result.ok ? 200 : 422 });
}
