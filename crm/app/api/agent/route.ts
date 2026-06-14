import { runAgentTurn, type PageContext } from "@/lib/ai/agent";
import { addMessage, createChat, getChatWithMessages } from "@/lib/db/chats";
import { getCurrentUser } from "@/lib/db";
import { Role } from "@/lib/types";

const ROLES: Role[] = ["rep", "tam", "sm", "finance"];

// POST /api/agent — one agent turn. Persists the user + assistant messages,
// auto-applies any actions, and returns them (with Undo handles).
// Body: { chatId?, role, message, pageContext? }
export async function POST(req: Request) {
  let body: {
    chatId?: string;
    role?: Role;
    message?: string;
    pageContext?: PageContext;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { role, message, pageContext } = body;
  if (!role || !ROLES.includes(role) || !message?.trim()) {
    return Response.json({ error: "role and message are required" }, { status: 400 });
  }

  const me = await getCurrentUser();
  const userId = me?.id ?? null;

  // Resolve / create the chat, capturing prior turns for context.
  let chatId = body.chatId;
  let history: { role: "user" | "assistant"; content: string }[] = [];
  if (chatId) {
    const existing = await getChatWithMessages(chatId);
    if (existing) history = existing.messages.map((m) => ({ role: m.role, content: m.content }));
    else chatId = undefined;
  }
  if (!chatId) {
    const chat = await createChat(userId, role, message.trim().slice(0, 60));
    chatId = chat.id;
  }

  await addMessage(chatId, "user", message.trim());

  const turn = await runAgentTurn({
    role,
    userId,
    message: message.trim(),
    history,
    pageContext,
  });

  const assistant = await addMessage(chatId, "assistant", turn.reply, turn.executed);

  return Response.json({
    chatId,
    messageId: assistant.id,
    reply: turn.reply,
    executed: turn.executed,
    clarify: turn.clarify,
    modelUsed: turn.modelUsed,
  });
}
