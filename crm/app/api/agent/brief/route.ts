import { buildBrief } from "@/lib/ai/brief";
import { getCurrentUser } from "@/lib/db";
import { Role } from "@/lib/types";

const ROLES: Role[] = ["rep", "tam", "sm", "finance"];

// GET /api/agent/brief?role=rep[&caseId=…] — the "what's going on / what to do"
// brief. On a TAM case page the caseId tailors the suggested questions.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const role = url.searchParams.get("role") as Role | null;
  const caseId = url.searchParams.get("caseId") ?? undefined;
  if (!role || !ROLES.includes(role)) {
    return Response.json({ error: "valid role is required" }, { status: 400 });
  }
  const me = await getCurrentUser();
  const brief = await buildBrief(role, me?.id ?? null, { caseId });
  return Response.json(brief);
}
