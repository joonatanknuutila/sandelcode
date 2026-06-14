import { draftCaseNote } from "@/lib/ai/case-note";

// POST /api/case-note/draft — tidy a rough case note into a timeline-ready line.
// READ-ONLY: never writes. Body: { text }. The TAM confirms before any save.
export async function POST(req: Request) {
  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = body.text?.trim();
  if (!text) {
    return Response.json({ error: "text is required" }, { status: 400 });
  }

  const draft = await draftCaseNote(text);
  return Response.json(draft);
}
