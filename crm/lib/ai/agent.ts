// The always-on agent — grounded, ACTING assistant behind the Agent Dock.
//
// Unlike lib/ai/assistant.ts (read-only Q&A), this turns a chat message into
// concrete CRM writes. Design decision (with the user): AUTO-APPLY + UNDO — the
// agent executes immediately and every executed action carries an INVERSE so the
// UI can reverse it. This deliberately overrides the "no silent writes" rule for
// this surface, so the guardrails below matter:
//   • only the allow-listed tools run; unknown tools are dropped;
//   • every id the model references is verified to exist before any write;
//   • stage / status strings are normalised to valid enum values;
//   • at most MAX_ACTIONS writes per turn;
//   • when the model is unsure it must ask (clarify) instead of acting;
//   • with no model key we fall back to a READ-ONLY answer and write nothing.
//
// Agentic behaviour rides on the JSON protocol the codebase already uses
// (lib/ai/meeting.ts) — complete(messages, { json: true }) — so there is no
// provider rewrite and it degrades gracefully.
import "server-only";
import { ChatMessage, complete } from "./provider";
import { ask, buildContext } from "./assistant";
import {
  getAccount,
  getAccounts,
  getAllCases,
  getCase,
  getCasesForTam,
  getDeal,
  getDealsForRep,
  getOpenDeals,
} from "@/lib/db";
import {
  createCase,
  createContact,
  deleteActivity,
  deleteCase,
  deleteContact,
  logActivity,
  updateCaseStatus,
  updateDealStage,
} from "@/lib/db/mutations";
import {
  CaseStatus,
  REP_STAGE_LABELS,
  Role,
  STAGE_LABELS,
  STAGE_ORDER,
  Stage,
} from "@/lib/types";

const MAX_ACTIONS = 3;

export type ToolName =
  | "log_note"
  | "move_deal_stage"
  | "add_contact"
  | "open_case"
  | "update_case_status";

/** How to reverse an executed action. Persisted on the assistant message. */
export type Inverse =
  | { kind: "delete_activity"; id: string }
  | { kind: "delete_contact"; id: string }
  | { kind: "delete_case"; id: string }
  | { kind: "set_stage"; dealId: string; stage: Stage }
  | { kind: "set_case_status"; caseId: string; status: CaseStatus };

export interface ExecutedAction {
  tool: ToolName;
  /** Human summary shown in the chat, e.g. 'Moved "Acme 5G" to Contract negotiation'. */
  label: string;
  inverse: Inverse;
  /** Set true once the user taps Undo. */
  undone?: boolean;
}

export interface PageContext {
  accountId?: string;
  dealId?: string;
  caseId?: string;
}

export interface AgentTurnResult {
  reply: string;
  executed: ExecutedAction[];
  /** Questions the agent needs answered before it can act. */
  clarify: string[];
  /** True when a live model produced the turn; false = read-only fallback. */
  modelUsed: boolean;
}

// --- normalisation ----------------------------------------------------------

function normalizeStage(raw: unknown): Stage | null {
  if (typeof raw !== "string") return null;
  const q = raw.trim().toLowerCase();
  if ((STAGE_ORDER as string[]).includes(q)) return q as Stage;
  for (const s of STAGE_ORDER) {
    if (STAGE_LABELS[s].toLowerCase() === q || REP_STAGE_LABELS[s].toLowerCase() === q) {
      return s;
    }
  }
  return null;
}

const CASE_STATUSES: CaseStatus[] = ["open", "in_progress", "escalated", "resolved"];
function normalizeStatus(raw: unknown): CaseStatus | null {
  if (typeof raw !== "string") return null;
  const q = raw.trim().toLowerCase().replace(/\s+/g, "_");
  return (CASE_STATUSES as string[]).includes(q) ? (q as CaseStatus) : null;
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

// --- grounded action scope --------------------------------------------------
// The model can only act on entities listed here, by id. Scoped to the role so a
// rep sees their deals, a TAM sees their cases.

interface ActionScope {
  text: string;
  dealIds: Set<string>;
  caseIds: Set<string>;
  accountIds: Set<string>;
}

async function buildActionScope(
  role: Role,
  userId: string | null,
  page: PageContext,
): Promise<ActionScope> {
  const accounts = await getAccounts();
  const acctName = new Map(accounts.map((a) => [a.id, a.name]));

  const openDeals =
    role === "rep" && userId
      ? (await getDealsForRep(userId)).filter((d) => d.stage !== "won" && d.stage !== "lost")
      : await getOpenDeals();
  const cases = (
    role === "tam" && userId ? await getCasesForTam(userId) : await getAllCases()
  ).filter((c) => c.status !== "resolved");

  const lines: string[] = [];
  if (page.accountId) lines.push(`CURRENT PAGE: account ${page.accountId} (${acctName.get(page.accountId) ?? "?"}).`);
  if (page.dealId) lines.push(`CURRENT PAGE: deal ${page.dealId}.`);
  if (page.caseId) lines.push(`CURRENT PAGE: case ${page.caseId}.`);

  lines.push("ACCOUNTS (id — name):");
  for (const a of accounts) lines.push(`  ${a.id} — ${a.name}`);

  lines.push(`DEALS you may act on (id — name [account], stage):`);
  for (const d of openDeals.slice(0, 30)) {
    lines.push(`  ${d.id} — ${d.name} [${acctName.get(d.accountId) ?? "?"}], ${STAGE_LABELS[d.stage]}`);
  }

  lines.push(`CASES you may act on (id — title [account], status):`);
  for (const c of cases.slice(0, 30)) {
    lines.push(`  ${c.id} — ${c.title} [${acctName.get(c.accountId) ?? "?"}], ${c.status}`);
  }

  return {
    text: lines.join("\n"),
    dealIds: new Set(openDeals.map((d) => d.id)),
    caseIds: new Set(cases.map((c) => c.id)),
    accountIds: new Set(accounts.map((a) => a.id)),
  };
}

// --- execution --------------------------------------------------------------

interface RawAction {
  tool?: string;
  args?: Record<string, unknown>;
  label?: string;
}

/** Validate + execute one model-proposed action. Returns the executed record
 *  (with its inverse) or null when the action is invalid (skipped silently). */
async function executeAction(
  raw: RawAction,
  scope: ActionScope,
  page: PageContext,
  userId: string | null,
): Promise<ExecutedAction | null> {
  const args = raw.args ?? {};
  switch (raw.tool) {
    case "log_note": {
      const dealId = str(args.dealId) ?? page.dealId;
      let accountId = str(args.accountId) ?? page.accountId;
      if (dealId && !accountId) accountId = (await getDeal(dealId))?.accountId;
      if (!accountId || !scope.accountIds.has(accountId)) return null;
      if (dealId && !scope.dealIds.has(dealId)) return null;
      const title = str(args.title) ?? "Note";
      const body = str(args.body) ?? title;
      const kind = args.kind === "follow_up" ? "follow_up" : "note";
      const activity = await logActivity({
        accountId,
        eventType: kind,
        title,
        body,
        entityType: dealId ? "deal" : "account",
        entityId: dealId ?? accountId,
        actorId: userId ?? undefined,
      });
      return {
        tool: "log_note",
        label: raw.label ?? `${kind === "follow_up" ? "Logged follow-up" : "Logged note"}: ${title}`,
        inverse: { kind: "delete_activity", id: activity.id },
      };
    }
    case "move_deal_stage": {
      const dealId = str(args.dealId) ?? page.dealId;
      const stage = normalizeStage(args.stage);
      if (!dealId || !scope.dealIds.has(dealId) || !stage) return null;
      const before = await getDeal(dealId);
      if (!before) return null;
      const after = await updateDealStage(dealId, stage);
      return {
        tool: "move_deal_stage",
        label: raw.label ?? `Moved "${after.name}" to ${STAGE_LABELS[stage]}`,
        inverse: { kind: "set_stage", dealId, stage: before.stage },
      };
    }
    case "add_contact": {
      const accountId = str(args.accountId) ?? page.accountId;
      const name = str(args.name);
      if (!accountId || !scope.accountIds.has(accountId) || !name) return null;
      const contact = await createContact({
        accountId,
        name,
        jobTitle: str(args.jobTitle),
        email: str(args.email),
        phone: str(args.phone),
      });
      return {
        tool: "add_contact",
        label: raw.label ?? `Added contact ${contact.name}`,
        inverse: { kind: "delete_contact", id: contact.id },
      };
    }
    case "open_case": {
      const accountId = str(args.accountId) ?? page.accountId;
      const title = str(args.title);
      if (!accountId || !scope.accountIds.has(accountId) || !title) return null;
      const priority = (["low", "medium", "high", "urgent"] as const).find(
        (p) => p === str(args.priority),
      );
      const created = await createCase({
        accountId,
        title,
        description: str(args.description),
        priority,
        assigneeId: userId ?? undefined,
      });
      return {
        tool: "open_case",
        label: raw.label ?? `Opened case "${created.title}"`,
        inverse: { kind: "delete_case", id: created.id },
      };
    }
    case "update_case_status": {
      const caseId = str(args.caseId) ?? page.caseId;
      const status = normalizeStatus(args.status);
      if (!caseId || !scope.caseIds.has(caseId) || !status) return null;
      const before = await getCase(caseId);
      if (!before) return null;
      const after = await updateCaseStatus(caseId, status);
      return {
        tool: "update_case_status",
        label: raw.label ?? `Set "${after.title}" to ${status.replace("_", " ")}`,
        inverse: { kind: "set_case_status", caseId, status: before.status },
      };
    }
    default:
      return null;
  }
}

/** Reverse a previously executed action. Used by /api/agent/undo. */
export async function undoAction(inverse: Inverse): Promise<void> {
  switch (inverse.kind) {
    case "delete_activity":
      return deleteActivity(inverse.id);
    case "delete_contact":
      return deleteContact(inverse.id);
    case "delete_case":
      return deleteCase(inverse.id);
    case "set_stage":
      await updateDealStage(inverse.dealId, inverse.stage);
      return;
    case "set_case_status":
      await updateCaseStatus(inverse.caseId, inverse.status);
      return;
  }
}

// --- the turn ---------------------------------------------------------------

const PERSONA: Record<Role, string> = {
  rep: "a brisk, action-oriented sales-rep agent. You move deals forward.",
  tam: "a precise technical-account-manager agent. You manage cases and SLAs.",
  sm: "a concise sales-manager agent. You watch pipeline and team performance.",
  finance: "a neutral, exact finance agent.",
};

const TOOL_SPEC = `TOOLS you may call (only these):
- log_note            args: { accountId?, dealId?, title, body, kind?: "note"|"follow_up" }
- move_deal_stage     args: { dealId, stage }   stage ∈ interest|rfi|rfp|customer_test|contract_negotiation|won|lost
- add_contact         args: { accountId, name, jobTitle?, email?, phone? }
- open_case           args: { accountId, title, description?, priority?: low|medium|high|urgent }
- update_case_status  args: { caseId, status }  status ∈ open|in_progress|escalated|resolved`;

export async function runAgentTurn(opts: {
  role: Role;
  userId: string | null;
  message: string;
  history?: { role: "user" | "assistant"; content: string }[];
  pageContext?: PageContext;
}): Promise<AgentTurnResult> {
  const { role, userId, message } = opts;
  const page = opts.pageContext ?? {};

  const [facts, scope] = await Promise.all([
    buildContext(role, page.accountId, message),
    buildActionScope(role, userId, page),
  ]);

  const system = `You are ${PERSONA[role]} You are the always-on agent inside the HMD Secure CRM.
You can ANSWER questions and TAKE ACTIONS. Ground every answer in the FACTS — never invent deals, cases, names, numbers or dates.

${TOOL_SPEC}

RULES:
- Only reference ids that appear in ACTION SCOPE. Never invent an id.
- Take an action only when the user's intent is clear. If you are missing a required detail (which deal? which account? what should the note say?), DO NOT act — put a short question in "clarify" instead.
- Prefer the CURRENT PAGE entity when the user says "this/here".
- Keep "reply" short (1-3 sentences). Describe what you did or asked.
- Return STRICT JSON ONLY:
{"reply": string, "actions": [{"tool": string, "args": object, "label": string}], "clarify": string[]}
Use an empty array when there are no actions or no questions.

ACTION SCOPE:
${scope.text}

FACTS:
${facts}`;

  const messages: ChatMessage[] = [{ role: "system", content: system }];
  for (const h of (opts.history ?? []).slice(-6)) {
    messages.push({ role: h.role, content: h.content });
  }
  messages.push({ role: "user", content: message });

  const raw = await complete(messages, { temperature: 0.2, maxTokens: 700, json: true });

  if (!raw) {
    // No model: read-only grounded answer, no writes.
    const fallback = await ask(role, message, page.accountId);
    return { reply: fallback.text, executed: [], clarify: [], modelUsed: false };
  }

  let parsed: { reply?: string; actions?: RawAction[]; clarify?: string[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { reply: raw.trim(), executed: [], clarify: [], modelUsed: true };
  }

  const executed: ExecutedAction[] = [];
  for (const a of (parsed.actions ?? []).slice(0, MAX_ACTIONS)) {
    try {
      const done = await executeAction(a, scope, page, userId);
      if (done) executed.push(done);
    } catch (err) {
      console.error("agent action failed", a, err);
    }
  }

  const clarify = Array.isArray(parsed.clarify)
    ? parsed.clarify.filter((q): q is string => typeof q === "string").slice(0, 4)
    : [];

  let reply = str(parsed.reply) ?? "";
  if (!reply) {
    reply = executed.length
      ? "Done."
      : clarify.length
        ? "I need a bit more detail."
        : "I'm not sure how to help with that yet.";
  }

  return { reply, executed, clarify, modelUsed: true };
}
