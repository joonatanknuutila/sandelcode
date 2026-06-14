"use client";

// The case capture surface — identical language to the Rep's Add note (§0, §2
// step 4). One field, two gestures:
//   • Save — writes the note to the case timeline as-is (zero friction).
//   • Spar & structure — the assistant tidies the rough note (and asks one
//     question if it's vague); NOTHING is saved until the TAM confirms.
// A small toggle keeps the TAM's real internal-vs-sales-facing visibility model.
// Sales-facing notes also write a summary line to the account timeline.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Textarea } from "@/components/ui";
import { toast } from "@/components/ui-client";
import { VoiceInput } from "@/components/VoiceInput";
import { addNoteAction } from "../../actions";

interface Draft {
  cleaned: string;
  question?: string;
  modelUsed: boolean;
}

export function CaseAddNote({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [isInternal, setIsInternal] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [cleaned, setCleaned] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, startSaving] = useTransition();

  const canAct = body.trim().length > 0;

  function clearAll() {
    setBody("");
    setDraft(null);
    setCleaned("");
    setAnswer("");
  }

  async function persist(content: string) {
    try {
      await addNoteAction(caseId, content, isInternal);
      toast(
        isInternal
          ? "Internal note added to the case"
          : "Sales-facing note added to the case and account",
        { variant: "success" },
      );
      clearAll();
      router.refresh();
    } catch {
      toast("Couldn't save the note", { variant: "error" });
    }
  }

  function save() {
    if (!canAct) return;
    startSaving(() => persist(body.trim()));
  }

  async function spar() {
    if (!canAct || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/case-note/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: body.trim() }),
      });
      const data = await res.json();
      if (!res.ok || typeof data?.cleaned !== "string") {
        toast(data?.error ?? "Couldn't structure that note", { variant: "error" });
        return;
      }
      setDraft(data as Draft);
      setCleaned(data.cleaned);
    } catch {
      toast("Couldn't reach the assistant", { variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  function confirmSpar() {
    const final = answer.trim() ? `${cleaned.trim()} ${answer.trim()}` : cleaned.trim();
    if (!final) return;
    startSaving(() => persist(final));
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded bg-hmd-teal px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-hmd-charcoal">
            AI
          </span>
          <p className="text-base font-semibold">Add note</p>
        </div>
        <VoiceInput
          onTranscript={(t) => setBody((b) => (b ? `${b} ${t}` : t))}
          title="Dictate the note"
        />
      </div>

      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write what happened — what you did, what's next."
        rows={3}
        className="mt-3"
        aria-label="Add note"
      />

      {!draft && (
        <>
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

          {/* Visibility — the TAM's real internal/working model, demoted. */}
          <label className="mt-3 flex items-center gap-2 text-xs text-muted">
            <button
              type="button"
              role="switch"
              aria-checked={!isInternal}
              onClick={() => setIsInternal((v) => !v)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                isInternal ? "bg-border" : "bg-hmd-teal"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  isInternal ? "translate-x-0" : "translate-x-4"
                }`}
              />
            </button>
            {isInternal ? (
              <span><span className="font-semibold text-foreground">Internal</span> — only the service team sees this; case timeline only</span>
            ) : (
              <span><span className="font-semibold text-foreground">Sales-facing</span> — also appears on the account timeline so the rep stays informed</span>
            )}
          </label>
        </>
      )}

      {/* Review card — nothing is saved until the TAM confirms. */}
      {draft && (
        <div className="mt-4 space-y-3">
          <p className="rounded-md border border-amber-400/35 bg-amber-400/10 px-3 py-2 text-xs font-medium text-amber-200">
            Draft only — nothing is saved until you confirm.
            {draft.modelUsed === false && (
              <span className="ml-1 font-normal">(assistant offline — basic structuring)</span>
            )}
          </p>
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              Tidied for the timeline
            </p>
            <Textarea value={cleaned} onChange={(e) => setCleaned(e.target.value)} rows={2} />
          </div>
          {draft.question && (
            <div>
              <label className="text-sm">{draft.question}</label>
              <input
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Your answer (optional)…"
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:border-hmd-teal-600"
              />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={confirmSpar}
              disabled={saving || !cleaned.trim()}
              style={{ background: "#e4ff00", color: "#000" }}
            >
              {saving ? "Saving…" : "Confirm & save"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setDraft(null)} disabled={saving}>
              Back
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
