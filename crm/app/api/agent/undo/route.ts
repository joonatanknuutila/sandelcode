import { undoAction, type ExecutedAction } from "@/lib/ai/agent";
import { getMessage, setMessageActions } from "@/lib/db/chats";

// POST /api/agent/undo — reverse one executed action on a stored message.
// Body: { messageId, actionIndex }
export async function POST(req: Request) {
  let body: { messageId?: string; actionIndex?: number };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { messageId, actionIndex } = body;
  if (!messageId || typeof actionIndex !== "number") {
    return Response.json({ error: "messageId and actionIndex are required" }, { status: 400 });
  }

  const msg = await getMessage(messageId);
  const actions = (msg?.actions ?? []) as ExecutedAction[];
  const action = actions[actionIndex];
  if (!action) return Response.json({ error: "Action not found" }, { status: 404 });
  if (action.undone) return Response.json({ ok: true, alreadyUndone: true });

  await undoAction(action.inverse);
  actions[actionIndex] = { ...action, undone: true };
  await setMessageActions(messageId, actions);

  return Response.json({ ok: true });
}
