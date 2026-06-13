import { ask } from "@/lib/ai/assistant";
import { Role } from "@/lib/types";

// POST /api/assistant — grounded, read-only persona assistant.
// Body: { role: Role, question: string, accountId?: string }
export async function POST(req: Request) {
  let body: { role?: Role; question?: string; accountId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { role, question, accountId } = body;
  if (!role || !question?.trim()) {
    return Response.json({ error: "role and question are required" }, { status: 400 });
  }

  const answer = await ask(role, question.trim(), accountId);
  return Response.json(answer);
}
