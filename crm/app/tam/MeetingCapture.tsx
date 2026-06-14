"use client";

import { useState } from "react";
import { Card } from "@/components/ui";

// Meeting -> CRM capture with the human-approval gate made visible.
// Paste a transcript -> AI drafts changes + asks follow-ups -> you edit, tick
// what to keep, answer -> only then does "Approve & save" write anything.

interface ProposedChange {
  type: string;
  label: string;
  detail: string;
}
interface Draft {
  summary: string;
  changes: ProposedChange[];
  questions: string[];
  modelUsed: boolean;
}

const TYPE_LABEL: Record<string, string> = {
  note: "Note",
  follow_up: "Follow-up",
  contact: "Contact",
  stage_move: "Stage move",
  case: "Case",
};

// Two front-ends over the SAME meeting→CRM approval gate. "email" is the demo
// stand-in for the Azure/Graph inbound-email→case webhook (see
// lib/integrations/graph.ts): paste an inbound email, it proposes a case, a
// human approves before anything is written.
type CaptureMode = "meeting" | "email";

const COPY: Record<
  CaptureMode,
  { trigger: string; title: string; placeholder: string; draftCta: string; note?: string }
> = {
  meeting: {
    trigger: "+ Log a meeting",
    title: "Log a meeting",
    placeholder: "Paste meeting notes or a transcript…",
    draftCta: "Draft update",
  },
  email: {
    trigger: "+ Paste an inbound email",
    title: "Inbound email → propose a case",
    placeholder: "Paste an inbound customer email…",
    draftCta: "Propose from email",
    note: "Demo stand-in for the Azure/Graph email→case webhook — same human-approval gate.",
  },
};

export function MeetingCapture({
  accountId,
  mode = "meeting",
}: {
  accountId: string;
  mode?: CaptureMode;
}) {
  const copy = COPY[mode];
  const [open, setOpen] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [keep, setKeep] = useState<boolean[]>([]);
  const [details, setDetails] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<{ count: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function makeDraft() {
    if (!transcript.trim() || busy) return;
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const res = await fetch("/api/meeting/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, transcript: transcript.trim() }),
      });
      const data: Draft = await res.json();
      setDraft(data);
      setKeep(data.changes.map(() => true));
      setDetails(data.changes.map((c) => c.detail));
      setAnswers(data.questions.map(() => ""));
    } catch {
      setError("Couldn't draft from that transcript.");
    } finally {
      setBusy(false);
    }
  }

  async function approveAndSave() {
    if (!draft || busy) return;
    setBusy(true);
    setError(null);
    const changes = draft.changes
      .map((c, i) => ({ ...c, detail: details[i] }))
      .filter((_, i) => keep[i]);
    try {
      const res = await fetch("/api/meeting/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, approved: true, changes, answers }),
      });
      const data = await res.json();
      if (data.ok) {
        setSaved({ count: data.applied.length });
        setDraft(null);
        setTranscript("");
      } else {
        setError(data.error ?? "Save failed.");
      }
    } catch {
      setError("Save failed.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setDraft(null);
    setTranscript("");
    setError(null);
    setSaved(null);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium text-foreground hover:border-hmd-teal-600"
      >
        {copy.trigger}
      </button>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded bg-hmd-teal px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-hmd-charcoal">
            AI
          </span>
          <p className="text-sm font-semibold">{copy.title}</p>
        </div>
        <button onClick={() => { setOpen(false); reset(); }} className="text-xs text-muted hover:text-foreground">
          Close
        </button>
      </div>

      {saved && (
        <p className="mt-3 rounded-md border border-green-400/35 bg-green-400/10 px-3 py-2 text-sm text-green-200">
          Saved {saved.count} approved change{saved.count === 1 ? "" : "s"} to the account timeline.
        </p>
      )}

      {!draft && (
        <>
          {copy.note && (
            <p className="mt-3 text-xs text-muted">{copy.note}</p>
          )}
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder={copy.placeholder}
            rows={5}
            className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-hmd-teal-600"
          />
          <button
            onClick={makeDraft}
            disabled={busy || !transcript.trim()}
            className="mt-2 rounded-md bg-hmd-teal px-3.5 py-2 text-sm font-medium text-hmd-teal-700 hover:bg-hmd-teal/90 disabled:opacity-40"
          >
            {busy ? "Drafting…" : copy.draftCta}
          </button>
        </>
      )}

      {draft && (
        <div className="mt-3 space-y-4">
          <p className="rounded-md border border-amber-400/35 bg-amber-400/10 px-3 py-2 text-xs font-medium text-amber-200">
            Draft only — nothing is saved until you approve.
            {draft.modelUsed === false && <span className="ml-1 font-normal">(model offline — heuristic draft)</span>}
          </p>

          {draft.summary && <p className="text-sm text-muted">{draft.summary}</p>}

          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Proposed changes</p>
            <div className="space-y-2">
              {draft.changes.map((c, i) => (
                <div key={i} className="flex gap-2.5 rounded-lg border border-border p-2.5">
                  <input
                    type="checkbox"
                    checked={keep[i]}
                    onChange={(e) => setKeep((k) => k.map((v, j) => (j === i ? e.target.checked : v)))}
                    className="mt-1"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="inline-block rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                      {TYPE_LABEL[c.type] ?? c.type}
                    </span>
                    <input
                      value={details[i]}
                      onChange={(e) => setDetails((d) => d.map((v, j) => (j === i ? e.target.value : v)))}
                      className="mt-1.5 w-full rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:border-hmd-teal-600"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {draft.questions.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Follow-up questions</p>
              <div className="space-y-2">
                {draft.questions.map((qn, i) => (
                  <div key={i}>
                    <label className="text-sm">{qn}</label>
                    <input
                      value={answers[i] ?? ""}
                      onChange={(e) => setAnswers((a) => a.map((v, j) => (j === i ? e.target.value : v)))}
                      placeholder="Your answer…"
                      className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:border-hmd-teal-600"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={approveAndSave}
              disabled={busy || keep.every((v) => !v)}
              className="rounded-md bg-hmd-teal px-3.5 py-2 text-sm font-medium text-hmd-teal-700 hover:bg-hmd-teal/90 disabled:opacity-40"
            >
              {busy ? "Saving…" : `Approve & save (${keep.filter(Boolean).length})`}
            </button>
            <button onClick={reset} className="rounded-lg border border-border px-3.5 py-2 text-sm font-medium hover:bg-background">
              Discard
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </Card>
  );
}
