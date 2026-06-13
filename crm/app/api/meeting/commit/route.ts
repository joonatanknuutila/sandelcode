import { commitMeeting, CommitRequest } from "@/lib/ai/meeting";

// POST /api/meeting/commit — the ONLY write path for meeting capture.
// Refuses unless approved === true. Body: CommitRequest.
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

  const result = commitMeeting(body);
  return Response.json(result, { status: result.ok ? 200 : 422 });
}
