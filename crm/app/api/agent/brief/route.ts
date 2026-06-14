import { buildBrief } from "@/lib/ai/brief";
import { getCurrentUser } from "@/lib/db";
import { Role } from "@/lib/types";

const ROLES: Role[] = ["rep", "tam", "sm", "finance"];

// GET /api/agent/brief?role=rep — the "what's going on / what to do" brief.
export async function GET(req: Request) {
  const role = new URL(req.url).searchParams.get("role") as Role | null;
  if (!role || !ROLES.includes(role)) {
    return Response.json({ error: "valid role is required" }, { status: 400 });
  }
  const me = await getCurrentUser();
  const brief = await buildBrief(role, me?.id ?? null);
  return Response.json(brief);
}
