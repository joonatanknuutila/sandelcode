import { deleteChat, getChatWithMessages } from "@/lib/db/chats";

// GET /api/agent/chats/[id] — a chat with its messages.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const chat = await getChatWithMessages(id);
  if (!chat) return Response.json({ error: "Chat not found" }, { status: 404 });
  return Response.json(chat);
}

// DELETE /api/agent/chats/[id] — remove a chat (cascades its messages).
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteChat(id);
  return Response.json({ ok: true });
}
