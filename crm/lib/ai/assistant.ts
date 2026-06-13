// Per-persona assistant — "ask about your accounts" (brief differentiator).
//
// GROUNDED: we hand the model only the facts for the relevant scope (an account
// or the user's queue), and the system prompt forbids invention. READ-ONLY: the
// assistant answers questions; it never writes. Any change to CRM data goes
// through the meeting->CRM approval gate (lib/ai/meeting.ts), never here.

import { ChatMessage, complete } from "./provider";
import {
  getAccount,
  getAllCases,
  getContactsForAccount,
  getDealsForAccount,
  getNotesForCase,
  getServiceHistory,
} from "@/lib/db";
import {
  caseAgeDays,
  requestStatus,
  slaInfo,
  summariseCase,
  triageSort,
} from "@/lib/tam";
import { Role, STAGE_LABELS } from "@/lib/types";
import { eur } from "@/lib/format";

const PERSONA: Record<Role, string> = {
  rep: "a brisk, action-oriented sales-rep assistant. Focus on moving deals.",
  tam: "a precise, technical account-manager assistant. Focus on cases, SLAs and service history.",
  sm: "a concise sales-manager assistant. Focus on pipeline and team performance.",
  finance: "a neutral, numeric finance assistant. Be cautious and exact.",
};

/** Build the grounded fact sheet the assistant is allowed to use. */
export async function buildContext(role: Role, accountId?: string): Promise<string> {
  const lines: string[] = [];

  if (accountId) {
    const account = await getAccount(accountId);
    if (account) {
      lines.push(`ACCOUNT: ${account.name} (${account.industry}, ${account.region}, ${account.channel}).`);
      if (account.summary) lines.push(`Summary: ${account.summary}`);
      const contacts = await getContactsForAccount(accountId);
      if (contacts.length) lines.push(`Contacts: ${contacts.map((c) => `${c.name} (${c.title})`).join("; ")}.`);
      for (const d of await getDealsForAccount(accountId)) {
        lines.push(`DEAL ${d.name}: stage ${STAGE_LABELS[d.stage]}, TCV ${eur(d.tcv, false)}, expected close ${d.expectedCloseDate}.`);
      }
    }
  }

  // TAM/case grounding — the cases in scope (account-filtered if given).
  const cases = (await getAllCases()).filter((c) => !accountId || c.accountId === accountId);
  for (const c of triageSort(cases)) {
    const sla = slaInfo(c);
    const notes = await getNotesForCase(c.id);
    const req = requestStatus(c, notes);
    const account = await getAccount(c.accountId);
    lines.push(
      `CASE ${c.id} "${c.title}" [${account?.name}]: ${c.priority} priority, ${c.status}, ${caseAgeDays(c)}d old, ${sla.label}, ${req.label}${c.escalatedToThirdParty ? ", 3rd-party escalated" : ""}.`,
    );
    const internal = notes.find((n) => n.visibility === "internal");
    if (internal) lines.push(`  internal note: ${internal.body}`);
  }

  if (accountId) {
    const hist = (await getServiceHistory(accountId)).slice(0, 6);
    if (hist.length) {
      lines.push("RECENT SERVICE HISTORY:");
      for (const e of hist) lines.push(`  ${e.createdAt.slice(0, 10)} ${e.kind}: ${e.body}`);
    }
  }

  return lines.join("\n");
}

export interface AssistantAnswer {
  text: string;
  /** True when a live model produced the answer; false = deterministic fallback. */
  modelUsed: boolean;
}

export async function ask(
  role: Role,
  question: string,
  accountId?: string,
): Promise<AssistantAnswer> {
  const context = await buildContext(role, accountId);

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `You are ${PERSONA[role]} You are part of the HMD Secure CRM. Answer ONLY from the FACTS below. If the answer isn't in the facts, say you don't have that on record — never invent names, numbers or dates. Be concise (2-4 sentences). You are read-only; if asked to change data, say it must go through the meeting->CRM approval flow.\n\nFACTS:\n${context}`,
    },
    { role: "user", content: question },
  ];

  const out = await complete(messages, { temperature: 0.2, maxTokens: 350 });
  if (out) return { text: out.trim(), modelUsed: true };

  return { text: await deterministicAnswer(role, question, accountId), modelUsed: false };
}

// Deterministic fallback so the assistant is useful with no model key. Handles
// the common intents from the brief; otherwise returns the grounded facts.
async function deterministicAnswer(role: Role, question: string, accountId?: string): Promise<string> {
  const q = question.toLowerCase();
  const cases = (await getAllCases()).filter((c) => !accountId || c.accountId === accountId);

  if (/breach|sla|overdue|urgent|risk/.test(q)) {
    const pressing = triageSort(cases.filter((c) => c.status !== "resolved")).filter((c) => ["breach", "soon"].includes(slaInfo(c).state));
    if (!pressing.length) return "No cases are past or within 24h of their SLA right now.";
    const named = await Promise.all(
      pressing.map(async (c) => {
        const account = await getAccount(c.accountId);
        return `• ${c.title} (${account?.name}) — ${slaInfo(c).label}${c.escalatedToThirdParty ? ", 3rd-party" : ""}`;
      }),
    );
    return "SLA pressure:\n" + named.join("\n");
  }

  if (/case|ticket|issue/.test(q)) {
    const open = triageSort(cases.filter((c) => c.status !== "resolved"));
    if (!open.length) return "No open cases in scope.";
    const top = open[0];
    const [notes, history] = await Promise.all([
      getNotesForCase(top.id),
      getServiceHistory(top.accountId),
    ]);
    const s = summariseCase(top, notes, history);
    return `${open.length} open case(s). Top priority: ${top.title} — ${s.headline}. ${s.suggestion}`;
  }

  if (/deal|pipeline|status|forecast/.test(q) && accountId) {
    const deals = await getDealsForAccount(accountId);
    if (!deals.length) return "No deals on this account.";
    return deals.map((d) => `${d.name}: ${STAGE_LABELS[d.stage]}, ${eur(d.tcv, false)} TCV, close ${d.expectedCloseDate}.`).join("\n");
  }

  const ctx = await buildContext(role, accountId);
  return ctx ? `Model is offline — here are the grounded facts:\n${ctx}` : "I don't have anything on record for that.";
}
