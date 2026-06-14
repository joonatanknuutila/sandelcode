// Model-backed case summary — the thin AI layer over the deterministic
// summariseCase() in lib/tam. Only offered when a case has crossed the brief's
// "5+ notes" threshold (a long thread a TAM needs catching up on); below that
// the deterministic headline is enough and this is never called.
//
// GROUNDED: the model sees ONLY this case, its notes and the account's service
// history — never invents. READ-ONLY: it summarises, it never writes. When no
// model is configured (the demo default) it returns the deterministic summary,
// phrased as a paragraph, with modelUsed:false — same degradation contract as
// every other AI path (provider.ts, nextBestAction, forecastNarrative).

import { ChatMessage, complete } from "./provider";
import { Case } from "../types";
import {
  CaseNote,
  ServiceEvent,
  caseAgeDays,
  slaInfo,
  summariseCase,
} from "../tam";

/** The brief's threshold: only summarise once a thread is 5+ notes deep. */
export const AI_SUMMARY_MIN_NOTES = 5;

export interface AiCaseSummary {
  /** One-paragraph catch-up. */
  text: string;
  /** True when a live model phrased it; false = deterministic fallback. */
  modelUsed: boolean;
}

/** Whether the AI summary should be offered for this note count. */
export function shouldOfferAiSummary(noteCount: number): boolean {
  return noteCount >= AI_SUMMARY_MIN_NOTES;
}

export async function aiCaseSummary(
  c: Case,
  notes: CaseNote[],
  history: ServiceEvent[],
): Promise<AiCaseSummary> {
  const sla = slaInfo(c);

  // Grounded fact sheet — newest notes first, the way getNotesForCase returns
  // them. The case's own service-history events give cross-thread context.
  const noteLines = notes
    .map(
      (n) =>
        `- [${n.visibility}] ${n.createdAt.slice(0, 10)}: ${n.body}`,
    )
    .join("\n");
  const historyLines = history
    .filter((e) => e.kind === "incident" || e.kind === "escalation" || e.caseId === c.id)
    .slice(0, 6)
    .map((e) => `- ${e.createdAt.slice(0, 10)} ${e.kind}: ${e.body}`)
    .join("\n");

  const facts =
    `CASE: ${c.title}\n` +
    `Priority ${c.priority}, status ${c.status}, ${caseAgeDays(c)} days old, ${sla.label}.` +
    `${c.escalatedToThirdParty ? " Escalated to a 3rd-party vendor." : ""}\n` +
    `NOTES (${notes.length}, newest first):\n${noteLines || "none"}\n` +
    `RELATED HISTORY:\n${historyLines || "none"}`;

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "You are a precise technical account manager. Write ONE short paragraph (2-4 sentences) catching a colleague up on this case from the FACTS: what it is, what's been tried, who owes the next move, and the SLA pressure. Use ONLY the facts given — never invent names, ticket numbers or dates. No bullet points, no preamble.",
    },
    { role: "user", content: facts },
  ];

  const out = await complete(messages, { temperature: 0.2, maxTokens: 220 });
  if (out && out.trim()) return { text: out.trim(), modelUsed: true };

  // Deterministic fallback — phrase the grounded summariseCase() as a paragraph.
  const det = summariseCase(c, notes, history);
  const text = `${det.headline}. ${det.bullets.join(" ")} Suggested: ${det.suggestion}`;
  return { text, modelUsed: false };
}
