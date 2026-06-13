// Meeting -> CRM capture with a HARD human-approval gate.
//
// Flow (brief P1 + house rule "no silent writes"):
//   1. draftFromTranscript()  — model reads the transcript, proposes a set of
//      changes and asks 3-5 follow-up questions. WRITES NOTHING.
//   2. human reviews/edits the proposed changes in the UI and answers questions.
//   3. commitMeeting()        — applies ONLY the changes the human approved, and
//      ONLY when approved === true. This is the single write path.
//
// The two steps are separate functions AND separate API routes, so a draft can
// never accidentally mutate state. Because the base mock data is read-only here,
// commits append to a session-local store (appliedActivities) that the getters
// could later merge — the point is the gate, not the persistence backend.

import { ChatMessage, complete } from "./provider";
import { getAccount, getDealsForAccount } from "@/lib/api";
import { Stage, STAGE_LABELS, STAGE_ORDER } from "@/lib/types";

export type ChangeType = "note" | "follow_up" | "contact" | "stage_move" | "case";

export interface ProposedChange {
  type: ChangeType;
  /** Short human label shown in the review diff. */
  label: string;
  /** The concrete content that would be written. */
  detail: string;
}

export interface MeetingDraft {
  accountId: string;
  summary: string;
  changes: ProposedChange[];
  /** 3-5 targeted questions the human should answer before committing. */
  questions: string[];
  modelUsed: boolean;
}

export async function draftFromTranscript(
  accountId: string,
  transcript: string,
): Promise<MeetingDraft> {
  const account = getAccount(accountId);
  const deals = getDealsForAccount(accountId);
  const stageList = STAGE_ORDER.filter((s) => s !== "won" && s !== "lost")
    .map((s) => STAGE_LABELS[s])
    .join(", ");

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        `You turn a meeting transcript into a DRAFT CRM update for ${account?.name ?? "an account"}. ` +
        `Known deals: ${deals.map((d) => `${d.name} (${STAGE_LABELS[d.stage]})`).join("; ") || "none"}. Valid stages: ${stageList}. ` +
        `Propose only changes clearly supported by the transcript. Do NOT invent commitments. ` +
        `Then ask 3-5 specific follow-up questions whose answers are needed before this can be saved. ` +
        `Return STRICT JSON: {"summary": string, "changes": [{"type": "note|follow_up|contact|stage_move|case", "label": string, "detail": string}], "questions": [string]}.`,
    },
    { role: "user", content: transcript },
  ];

  const raw = await complete(messages, { temperature: 0.2, maxTokens: 700, json: true });
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return {
        accountId,
        summary: String(parsed.summary ?? ""),
        changes: Array.isArray(parsed.changes) ? parsed.changes.slice(0, 8) : [],
        questions: Array.isArray(parsed.questions) ? parsed.questions.slice(0, 5) : [],
        modelUsed: true,
      };
    } catch {
      // fall through to deterministic
    }
  }

  return deterministicDraft(accountId, transcript);
}

// Heuristic fallback so capture works with no model key.
function deterministicDraft(accountId: string, transcript: string): MeetingDraft {
  const text = transcript.trim();
  const firstSentences = text.replace(/\s+/g, " ").split(/(?<=[.!?])\s/).slice(0, 2).join(" ");
  const lines = text.split(/\n|(?<=[.!?])\s/).map((l) => l.trim()).filter(Boolean);

  const changes: ProposedChange[] = [
    { type: "note", label: "Meeting note", detail: firstSentences || text.slice(0, 200) },
  ];

  // Action-ish lines become follow-ups.
  const actions = lines.filter((l) => /\b(will|to|next|follow up|send|schedule|confirm|owner|sign-?off|pilot)\b/i.test(l)).slice(0, 2);
  for (const a of actions) changes.push({ type: "follow_up", label: "Follow-up", detail: a });

  // Stage hint.
  const lower = text.toLowerCase();
  let stageHint: Stage | undefined;
  if (/contract|sign|terms|pricing approv/.test(lower)) stageHint = "contract_negotiation";
  else if (/pilot|test|trial/.test(lower)) stageHint = "customer_test";
  else if (/rfp|offer|proposal/.test(lower)) stageHint = "rfp";
  if (stageHint) {
    changes.push({ type: "stage_move", label: "Suggested stage", detail: `Consider moving to "${STAGE_LABELS[stageHint]}"` });
  }
  if (/case|issue|bug|crash|sla|ticket|escalat/.test(lower)) {
    changes.push({ type: "case", label: "Possible support case", detail: "Transcript mentions a technical issue — open a case?" });
  }

  return {
    accountId,
    summary: firstSentences,
    changes,
    questions: [
      "Did they commit to a specific pilot or order size?",
      "Who owns the security sign-off on their side?",
      "What's the target decision / signature date?",
      "Any blocker we should track as a support case?",
    ],
    modelUsed: false,
  };
}

// --- The single write path -------------------------------------------------

export interface AppliedActivity {
  id: string;
  accountId: string;
  body: string;
  createdAt: string;
}

// Session-local store of what got committed (stands in for a DB write).
const appliedActivities: AppliedActivity[] = [];

export interface CommitRequest {
  accountId: string;
  /** MUST be true — the explicit human approval. */
  approved: boolean;
  /** Only the changes the human kept after review. */
  changes: ProposedChange[];
  /** The human's answers to the follow-up questions, for the audit note. */
  answers?: string[];
}

export interface CommitResult {
  ok: boolean;
  applied: AppliedActivity[];
  error?: string;
}

export function commitMeeting(req: CommitRequest): CommitResult {
  // The gate. No approval, no write — full stop.
  if (req.approved !== true) {
    return { ok: false, applied: [], error: "Not approved — nothing written." };
  }
  if (!getAccount(req.accountId)) {
    return { ok: false, applied: [], error: "Unknown account." };
  }
  if (!req.changes?.length) {
    return { ok: false, applied: [], error: "No changes to apply." };
  }

  const now = new Date().toISOString();
  const applied: AppliedActivity[] = req.changes.map((c, i) => ({
    id: `mtg-${Date.now()}-${i}`,
    accountId: req.accountId,
    body: `[${c.type}] ${c.label}: ${c.detail}`,
    createdAt: now,
  }));
  appliedActivities.push(...applied);
  return { ok: true, applied };
}

export function getAppliedActivities(accountId: string): AppliedActivity[] {
  return appliedActivities.filter((a) => a.accountId === accountId);
}
