import { draftFromTranscript } from "@/lib/ai/meeting";

// POST /api/meeting/draft — propose CRM changes from a transcript.
// READ-ONLY: this endpoint never mutates state. Body: { accountId, transcript }
export async function POST(req: Request) {
  let body: { accountId?: string; transcript?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { accountId, transcript } = body;
  if (!accountId || !transcript?.trim()) {
    return Response.json({ error: "accountId and transcript are required" }, { status: 400 });
  }

  const draft = await draftFromTranscript(accountId, transcript.trim());
  return Response.json(draft);
}
