import { createChat, listChats } from "@/lib/db/chats";
import { getCurrentUser } from "@/lib/db";

// GET /api/agent/chats — the current user's chat history (recent first).
export async function GET() {
  const me = await getCurrentUser();
  const chats = await listChats(me?.id ?? null);
  return Response.json({ chats });
}

// POST /api/agent/chats — start a new (empty) chat.
export async function POST() {
  const me = await getCurrentUser();
  const chat = await createChat(me?.id ?? null);
  return Response.json({ chat });
}
