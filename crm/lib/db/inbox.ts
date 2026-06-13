// Inbox read layer (Supabase-backed) — SERVER ONLY.
//
// Internal messaging is never standalone: every message hangs off an account,
// deal or case (brief Block 4). We back messages with the existing `notes`
// table — its `note_entity_type` enum is exactly {account, deal, case} — so the
// Inbox needs no new storage. A "conversation" is one context plus its notes,
// and a deal conversation may also carry a pending discount approval (read from
// `offers`) that the UI renders as a special approve/reject message.
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getAccounts, getAllCases, getAllDeals, getAllOffers } from "./index";
import { ContextType, Conversation, InboxMessage } from "@/lib/types";

const CONTEXT_TYPES: ContextType[] = ["account", "deal", "case"];

/** A single context's messages, oldest-first (chronological thread order). */
export async function getInboxMessages(
  contextType: ContextType,
  contextId: string,
): Promise<InboxMessage[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notes")
    .select("*")
    .eq("entity_type", contextType)
    .eq("entity_id", contextId)
    .order("created_at", { ascending: true });
  return (data ?? []).map((n) => ({
    id: n.id,
    contextType,
    contextId,
    authorId: n.author_id ?? "",
    body: n.content,
    createdAt: n.created_at,
  }));
}

interface ContextMeta {
  accountId: string;
  title: string;
  subtitle: string;
}

/** All conversations, newest-active first. `accountIds` scopes to a role's
 *  reach (rep = own book, tam = case accounts); omit it for the all-seeing
 *  manager/finance lenses. */
export async function getConversations(opts?: {
  accountIds?: string[];
}): Promise<Conversation[]> {
  const supabase = await createClient();
  const [notesRes, accounts, deals, cases, offers] = await Promise.all([
    supabase
      .from("notes")
      .select("*")
      .in("entity_type", CONTEXT_TYPES)
      .order("created_at", { ascending: false }),
    getAccounts(),
    getAllDeals(),
    getAllCases(),
    getAllOffers(),
  ]);

  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const dealById = new Map(deals.map((d) => [d.id, d]));
  const caseById = new Map(cases.map((c) => [c.id, c]));

  function resolve(type: ContextType, id: string): ContextMeta | null {
    if (type === "account") {
      const a = accountById.get(id);
      return a
        ? { accountId: a.id, title: a.name, subtitle: `${a.industry} · ${a.region}` }
        : null;
    }
    if (type === "deal") {
      const d = dealById.get(id);
      if (!d) return null;
      return {
        accountId: d.accountId,
        title: d.name,
        subtitle: accountById.get(d.accountId)?.name ?? "Deal",
      };
    }
    const c = caseById.get(id);
    if (!c) return null;
    return {
      accountId: c.accountId,
      title: c.title,
      subtitle: accountById.get(c.accountId)?.name ?? "Case",
    };
  }

  const byKey = new Map<string, Conversation>();
  // Notes arrive newest-first, so the first row we see for a key is its latest.
  for (const n of notesRes.data ?? []) {
    const type = n.entity_type as ContextType;
    const meta = resolve(type, n.entity_id);
    if (!meta) continue;
    const key = `${type}:${n.entity_id}`;
    let conv = byKey.get(key);
    if (!conv) {
      conv = {
        contextType: type,
        contextId: n.entity_id,
        accountId: meta.accountId,
        title: meta.title,
        subtitle: meta.subtitle,
        lastMessageAt: n.created_at,
        lastSnippet: n.content,
        messageCount: 0,
        participantIds: [],
      };
      byKey.set(key, conv);
    }
    conv.messageCount += 1;
    if (n.author_id && !conv.participantIds.includes(n.author_id)) {
      conv.participantIds.push(n.author_id);
    }
  }

  // Overlay pending discount approvals onto their deal conversation.
  const pending = offers.filter(
    (o) => o.status === "pending_sm" || o.status === "pending_finance",
  );
  for (const o of pending) {
    const meta = resolve("deal", o.dealId);
    if (!meta) continue;
    const key = `deal:${o.dealId}`;
    let conv = byKey.get(key);
    if (!conv) {
      conv = {
        contextType: "deal",
        contextId: o.dealId,
        accountId: meta.accountId,
        title: meta.title,
        subtitle: meta.subtitle,
        lastMessageAt: o.createdAt,
        lastSnippet: `Discount approval requested · v${o.version}`,
        messageCount: 0,
        participantIds: [],
      };
      byKey.set(key, conv);
    }
    conv.pendingApproval = {
      offerId: o.id,
      gate: o.status === "pending_sm" ? "sm" : "finance",
      status: o.status,
      discountPct: Math.max(0, ...o.lines.map((l) => l.discountPct)),
      total: o.total,
      version: o.version,
      justification: o.justification,
      dealId: o.dealId,
    };
    if (new Date(o.createdAt) > new Date(conv.lastMessageAt)) {
      conv.lastMessageAt = o.createdAt;
    }
  }

  let list = [...byKey.values()];
  if (opts?.accountIds) {
    const allow = new Set(opts.accountIds);
    list = list.filter((c) => allow.has(c.accountId));
  }
  list.sort(
    (a, b) =>
      new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
  );
  return list;
}
