"use client";

// The core capture surface (§6). One field, two gestures:
//   • Save — stores the note to the timeline as-is. Zero friction, a quick jot.
//   • Spar & structure — the AI reads the free text, asks targeted follow-ups,
//     and proposes a clean timeline event / stage move / next step. NOTHING is
//     written until the rep reviews and confirms.
// It lives on the dashboard (account picked after writing), on every account
// (account fixed), and on every deal (account + deal fixed). The Spar path
// reuses the existing approval-gated meeting flow (/api/meeting/draft + commit).

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Select, Textarea } from "@/components/ui";
import { toast } from "@/components/ui-client";
import { VoiceInput } from "@/components/VoiceInput";
import { addNoteAction } from "@/app/rep/account-actions";

interface AccountRef {
  id: string;
  name: string;
}

interface ProposedChange {
  type: string;
  label: string;
  detail: string;
}
interface Draft {
  accountId: string;
  summary: string;
  changes: ProposedChange[];
  questions: string[];
  modelUsed: boolean;
}

const TYPE_LABEL: Record<string, string> = {
  note: "Note",
  follow_up: "Follow-up",
  contact: "Contact",
  stage_move: "Stage change",
  case: "Support case",
};

const DEFAULT_PLACEHOLDER =
  "Write what happened — key points, commitments, next steps. Or paste an email thread.";

export function AddNote({
  accountId,
  dealId,
  accounts,
  sensitive = false,
  placeholder,
  heading = "Add note",
  className = "",
}: {
  /** Fixed account (account / deal pages). */
  accountId?: string;
  /** Fixed deal — the note also attaches to this deal's timeline. */
  dealId?: string;
  /** Dashboard anchor: let the rep write first, then pick the account. */
  accounts?: AccountRef[];
  /** Defense / sensitive account — note stays typed-only, no dictation. */
  sensitive?: boolean;
  placeholder?: string;
  heading?: string;
  className?: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [picked, setPicked] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [keep, setKeep] = useState<boolean[]>([]);
  const [details, setDetails] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [saving, startSaving] = useTransition();

  const needsPicker = !accountId && Boolean(accounts?.length);
  const effectiveAccountId = accountId ?? (picked || "");
  const canAct = body.trim().length > 0 && Boolean(effectiveAccountId);

  const accountName = useMemo(
    () => accounts?.find((a) => a.id === effectiveAccountId)?.name,
    [accounts, effectiveAccountId],
  );

  function resetDraft() {
    setDraft(null);
    setKeep([]);
    setDetails([]);
    setAnswers([]);
  }

  function clearAll() {
    setBody("");
    setPicked("");
    resetDraft();
  }

  // --- Save: zero-friction timeline write ----------------------------------
  function save() {
    if (!canAct) return;
    startSaving(async () => {
      const res = await addNoteAction({ accountId: effectiveAccountId, dealId, body });
      if (res.ok) {
        toast("Note added to the timeline", { variant: "success" });
        clearAll();
        router.refresh();
      } else {
        toast(res.error ?? "Couldn't save the note", { variant: "error" });
      }
    });
  }

  // --- Spar: propose structured changes, write nothing until confirmed -----
  async function spar() {
    if (!canAct || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/meeting/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: effectiveAccountId, transcript: body.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !Array.isArray(data?.changes) || !Array.isArray(data?.questions)) {
        toast(data?.error ?? "Couldn't structure that note", { variant: "error" });
        return;
      }
      const d = data as Draft;
      setDraft(d);
      setKeep(d.changes.map(() => true));
      setDetails(d.changes.map((c) => c.detail));
      setAnswers(d.questions.map(() => ""));
    } catch {
      toast("Couldn't reach the assistant", { variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function confirmSpar() {
    if (!draft || busy) return;
    setBusy(true);
    try {
      const changes = draft.changes
        .map((c, i) => ({ ...c, detail: details[i] }))
        .filter((_, i) => keep[i]);
      const res = await fetch("/api/meeting/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: effectiveAccountId,
          dealId,
          approved: true,
          changes,
          answers: answers.filter(Boolean),
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        const n =
          (Array.isArray(data.activities) ? data.activities.length : 0) +
          (Array.isArray(data.notes) ? data.notes.length : 0);
        toast(`Saved ${n} change${n === 1 ? "" : "s"} to the timeline`, { variant: "success" });
        clearAll();
        router.refresh();
      } else {
        toast(data.error ?? "Couldn't save those changes", { variant: "error" });
      }
    } catch {
      toast("Couldn't save those changes", { variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={`p-4 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded bg-hmd-teal px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-hmd-charcoal">
            AI
          </span>
          <p className="text-base font-semibold">{heading}</p>
        </div>
        {/* Dictation — typed/dictated both fine, but off for sensitive accounts (§6). */}
        {!sensitive && (
          <VoiceInput
            onTranscript={(t) => setBody((b) => (b ? `${b} ${t}` : t))}
            title="Dictate the note"
          />
        )}
      </div>

      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder ?? DEFAULT_PLACEHOLDER}
        rows={3}
        className="mt-3"
        aria-label="Add note"
      />

      {needsPicker && body.trim().length > 0 && (
        <div className="mt-3">
          <Select
            label="Which account?"
            value={picked}
            onChange={(e) => setPicked(e.target.value)}
            placeholder="Pick the account…"
            options={(accounts ?? []).map((a) => ({ value: a.id, label: a.name }))}
          />
        </div>
      )}

      {sensitive && (
        <p className="mt-2 text-xs text-muted">
          Sensitive account — notes stay typed-only inside the EU tenant (no dictation).
        </p>
      )}

      {!draft && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={spar}
            disabled={!canAct || busy || saving}
            style={{ background: "#e4ff00", color: "#000" }}
          >
            {busy ? "Reading…" : "Spar & structure"}
          </Button>
          <Button type="button" variant="secondary" onClick={save} disabled={!canAct || busy || saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <span className="text-xs text-muted">
            Spar lets the assistant tidy it up first — Save jots it down as-is.
          </span>
        </div>
      )}

      {/* Review card — nothing is written until the rep confirms (§6). */}
      {draft && (
        <div className="mt-4 space-y-4">
          <p className="rounded-md border border-amber-400/35 bg-amber-400/10 px-3 py-2 text-xs font-medium text-amber-200">
            Draft only — nothing is saved until you confirm.
            {draft.modelUsed === false && (
              <span className="ml-1 font-normal">(assistant offline — basic structuring)</span>
            )}
            {accountName && <span className="ml-1 font-normal">· {accountName}</span>}
          </p>

          {draft.summary && <p className="text-sm text-muted">{draft.summary}</p>}

          {draft.changes.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                Proposed for the timeline
              </p>
              <div className="space-y-2">
                {draft.changes.map((c, i) => (
                  <div key={i} className="flex gap-2.5 rounded-lg border border-border p-2.5">
                    <input
                      type="checkbox"
                      checked={keep[i] ?? false}
                      onChange={(e) =>
                        setKeep((k) => k.map((v, j) => (j === i ? e.target.checked : v)))
                      }
                      className="mt-1"
                      aria-label={`Keep ${c.label}`}
                    />
                    <div className="min-w-0 flex-1">
                      <span className="inline-block rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
                        {TYPE_LABEL[c.type] ?? c.type}
                      </span>
                      <input
                        value={details[i] ?? ""}
                        onChange={(e) =>
                          setDetails((d) => d.map((v, j) => (j === i ? e.target.value : v)))
                        }
                        className="mt-1.5 w-full rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:border-hmd-teal-600"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {draft.questions.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                A few things to confirm
              </p>
              <div className="space-y-2">
                {draft.questions.map((q, i) => (
                  <div key={i}>
                    <label className="text-sm">{q}</label>
                    <input
                      value={answers[i] ?? ""}
                      onChange={(e) =>
                        setAnswers((a) => a.map((v, j) => (j === i ? e.target.value : v)))
                      }
                      placeholder="Your answer (optional)…"
                      className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:border-hmd-teal-600"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={confirmSpar}
              disabled={busy || keep.every((v) => !v)}
              style={{ background: "#e4ff00", color: "#000" }}
            >
              {busy ? "Saving…" : `Confirm & save (${keep.filter(Boolean).length})`}
            </Button>
            <Button type="button" variant="secondary" onClick={resetDraft} disabled={busy}>
              Back
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
