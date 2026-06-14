"use client";

import { useState } from "react";
import { Role } from "@/lib/types";
import { Card } from "@/components/ui";

// Grounded persona assistant widget (brief §05.03 conversational query). It is
// read-only: answers from CRM facts and never writes. Posts to /api/assistant.
// Drops a small "model offline" tag when the deterministic fallback answered,
// so it's honest about what produced the answer.

interface Turn {
  q: string;
  a?: string;
  modelUsed?: boolean;
  pending?: boolean;
}

const DEFAULT_SUGGESTIONS = [
  "Which cases are at risk of breaching SLA?",
  "What's the top case I should act on?",
  "Anything blocked on a 3rd party?",
];

export function Assistant({
  role,
  accountId,
  scopeLabel,
  suggestions = DEFAULT_SUGGESTIONS,
}: {
  role: Role;
  accountId?: string;
  scopeLabel?: string;
  suggestions?: string[];
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setInput("");
    setBusy(true);
    setTurns((t) => [...t, { q, pending: true }]);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, question: q, accountId }),
      });
      const data = await res.json();
      setTurns((t) =>
        t.map((turn, i) =>
          i === t.length - 1
            ? { q, a: data.text ?? data.error ?? "No answer.", modelUsed: data.modelUsed }
            : turn,
        ),
      );
    } catch {
      setTurns((t) => t.map((turn, i) => (i === t.length - 1 ? { q, a: "Request failed." } : turn)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <span className="rounded bg-hmd-teal px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-hmd-charcoal">
          AI
        </span>
        <p className="text-sm font-semibold">Ask about {scopeLabel ?? "your cases"}</p>
      </div>
      <p className="mt-1 text-xs text-muted">Grounded in your CRM data · read-only.</p>

      {turns.length > 0 && (
        <div className="mt-3 space-y-3">
          {turns.map((t, i) => (
            <div key={i}>
              <p className="text-sm font-medium">{t.q}</p>
              {t.pending ? (
                <p className="mt-0.5 text-sm text-muted">Thinking…</p>
              ) : (
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">
                  {t.a}
                  {t.modelUsed === false && (
                    <span className="ml-1 align-middle text-[10px] text-muted">(model offline)</span>
                  )}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {turns.length === 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="rounded-full border border-border px-2.5 py-1 text-xs text-muted hover:border-hmd-teal-600 hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mt-3 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question…"
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-hmd-teal-600"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-md bg-hmd-teal px-3.5 py-2 text-sm font-medium text-hmd-teal-700 hover:bg-hmd-teal/90 disabled:opacity-40"
        >
          Ask
        </button>
      </form>
    </Card>
  );
}
