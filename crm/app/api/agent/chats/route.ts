import { createChat, listChats } from "@/lib/db/chats";
import { getCurrentUser } from "@/lib/db";
import { Role } from "@/lib/types";

const ROLES: Role[] = ["rep", "tam", "sm", "finance"];

// GET /api/agent/chats?role=rep — the user's chat history FOR THAT PERSONA.
export async function GET(req: Request) {
  const role = new URL(req.url).searchParams.get("role") as Role | null;
  if (!role || !ROLES.includes(role)) {
    return Response.json({ error: "valid role is required" }, { status: 400 });
  }
  const me = await getCurrentUser();
  const chats = await listChats(me?.id ?? null, role);
  return Response.json({ chats });
}

// POST /api/agent/chats?role=rep — start a new (empty) chat for that persona.
export async function POST(req: Request) {
  const role = new URL(req.url).searchParams.get("role") as Role | null;
  if (!role || !ROLES.includes(role)) {
    return Response.json({ error: "valid role is required" }, { status: 400 });
  }
  const me = await getCurrentUser();
  const chat = await createChat(me?.id ?? null, role);
  return Response.json({ chat });
}
