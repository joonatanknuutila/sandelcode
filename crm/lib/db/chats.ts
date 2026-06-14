// AI agent chat persistence — SERVER ONLY.
//
// Stores the always-on agent's conversations (ai_chats) and their turns
// (ai_messages). Like the rest of the write layer this runs through the
// service-role admin client and scopes by user_id in code (see lib/db/mutations
// for the same demo pattern + production-auth note). Each assistant message can
// carry the actions it executed, with their inverse descriptors, so the UI can
// offer Undo straight from history.
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/types.db";
import type { ExecutedAction } from "@/lib/ai/agent";
import type { Role } from "@/lib/types";

export interface ChatSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions: ExecutedAction[] | null;
  createdAt: string;
}

export interface ChatWithMessages {
  id: string;
  title: string;
  messages: StoredMessage[];
}

/** A new, empty chat for a user, scoped to the persona (role) it's started in.
 *  Title defaults; renamed from the first turn. */
export async function createChat(
  userId: string | null,
  role: Role,
  title = "New chat",
): Promise<ChatSummary> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ai_chats")
    .insert({ user_id: userId, role, title })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create chat");
  return { id: data.id, title: data.title, updatedAt: data.updated_at };
}

/** A user's chats FOR ONE PERSONA, most-recently-updated first. History is
 *  persona-specific — a rep never sees the TAM's chats and vice versa. */
export async function listChats(
  userId: string | null,
  role: Role,
): Promise<ChatSummary[]> {
  const admin = createAdminClient();
  let q = admin
    .from("ai_chats")
    .select("id, title, updated_at")
    .eq("role", role)
    .order("updated_at", { ascending: false })
    .limit(50);
  q = userId ? q.eq("user_id", userId) : q.is("user_id", null);
  const { data } = await q;
  return (data ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    updatedAt: c.updated_at,
  }));
}

/** A chat + its messages in order. Returns null when the chat doesn't exist. */
export async function getChatWithMessages(
  chatId: string,
): Promise<ChatWithMessages | null> {
  const admin = createAdminClient();
  const { data: chat } = await admin
    .from("ai_chats")
    .select("id, title")
    .eq("id", chatId)
    .maybeSingle();
  if (!chat) return null;
  const { data: msgs } = await admin
    .from("ai_messages")
    .select("*")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });
  return {
    id: chat.id,
    title: chat.title,
    messages: (msgs ?? []).map((m) => ({
      id: m.id,
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
      actions: (m.actions as ExecutedAction[] | null) ?? null,
      createdAt: m.created_at,
    })),
  };
}

/** Append a message and bump the chat's updated_at. */
export async function addMessage(
  chatId: string,
  role: "user" | "assistant",
  content: string,
  actions?: ExecutedAction[] | null,
): Promise<StoredMessage> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ai_messages")
    .insert({ chat_id: chatId, role, content, actions: (actions ?? null) as Json })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to add message");
  await admin
    .from("ai_chats")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", chatId);
  return {
    id: data.id,
    role,
    content: data.content,
    actions: (data.actions as ExecutedAction[] | null) ?? null,
    createdAt: data.created_at,
  };
}

/** Update a stored message's actions (e.g. mark one undone). */
export async function setMessageActions(
  messageId: string,
  actions: ExecutedAction[],
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("ai_messages")
    .update({ actions: actions as unknown as Json })
    .eq("id", messageId);
  if (error) throw new Error(error.message);
}

/** Load one stored message (for Undo lookups). */
export async function getMessage(messageId: string): Promise<StoredMessage | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("ai_messages")
    .select("*")
    .eq("id", messageId)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    role: data.role === "assistant" ? "assistant" : "user",
    content: data.content,
    actions: (data.actions as ExecutedAction[] | null) ?? null,
    createdAt: data.created_at,
  };
}

export async function renameChat(chatId: string, title: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("ai_chats")
    .update({ title: title.slice(0, 80) })
    .eq("id", chatId);
  if (error) throw new Error(error.message);
}

export async function deleteChat(chatId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("ai_chats").delete().eq("id", chatId);
  if (error) throw new Error(error.message);
}
