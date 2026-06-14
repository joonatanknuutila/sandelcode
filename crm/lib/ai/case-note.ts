// "Spar & structure" for a single case note — the AI tidies the TAM's raw jot
// into a clean timeline-ready line and, if the note is vague, asks ONE follow-up.
// Nothing is written here: this only proposes. The component shows the cleaned
// text (editable) + the optional question, and the TAM confirms before save.
//
// GROUNDED + degrades: when no model is configured (the demo default) it returns
// a deterministic light cleanup with modelUsed:false — same contract as every
// other AI path, so the Spar button always returns something usable.

import { ChatMessage, complete } from "./provider";

export interface CaseNoteDraft {
  /** Cleaned, timeline-ready version of the note. */
  cleaned: string;
  /** One clarifying question if the note is too vague to stand alone. */
  question?: string;
  modelUsed: boolean;
}

/** Deterministic tidy: trim, collapse whitespace, sentence-case, end-stop. */
function deterministicClean(text: string): string {
  let t = text.trim().replace(/\s+/g, " ");
  if (!t) return t;
  t = t.charAt(0).toUpperCase() + t.slice(1);
  if (!/[.?!]$/.test(t)) t += ".";
  return t;
}

export async function draftCaseNote(text: string): Promise<CaseNoteDraft> {
  const raw = text.trim();
  if (!raw) return { cleaned: "", modelUsed: false };

  const messages: ChatMessage[] = [
    {
      role: "system",
      content:
        "You tidy a technical account manager's rough case note into ONE clean, " +
        "professional timeline line. Keep it factual and faithful to the input — " +
        "never invent ticket numbers, names or outcomes. If the note is too vague " +
        "to stand alone, set a single short clarifying question. Reply as strict " +
        'JSON: {"cleaned": string, "question": string|null}.',
    },
    { role: "user", content: raw },
  ];

  const out = await complete(messages, { temperature: 0.2, maxTokens: 200, json: true });
  if (out && out.trim()) {
    try {
      const parsed = JSON.parse(out) as { cleaned?: string; question?: string | null };
      const cleaned = parsed.cleaned?.trim();
      if (cleaned) {
        return {
          cleaned,
          question: parsed.question?.trim() || undefined,
          modelUsed: true,
        };
      }
    } catch {
      /* fall through to deterministic */
    }
  }

  return { cleaned: deterministicClean(raw), modelUsed: false };
}
