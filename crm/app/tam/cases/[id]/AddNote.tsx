"use client";

import { useState, useTransition } from "react";
import { Button, Textarea } from "@/components/ui";
import { toast } from "@/components/ui-client";
import { addNoteAction } from "../../actions";

// ---------------------------------------------------------------------------
// AddNote — inline composer for case notes (internal vs working/customer-facing)
//
// Visibility model:
//   internal  (isInternal=true)  — TAM-only; hidden in customer-facing view
//   working   (isInternal=false) — customer-safe; visible when toggle is off
//
// "Waiting on" derivation: requestStatus() in lib/tam.ts looks at the latest
// *working* note's body. A working note ending in "?" flips waiting-on to
// "customer". This composer participates automatically: when you submit a
// working note ending in "?" the server revalidates, the page re-fetches notes
// newest-first, and requestStatus() picks up the new note immediately.
// ---------------------------------------------------------------------------

interface AddNoteProps {
  caseId: string;
}

export function AddNote({ caseId }: AddNoteProps) {
  const [body, setBody] = useState("");
  const [isInternal, setIsInternal] = useState(true);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;

    startTransition(async () => {
      try {
        await addNoteAction(caseId, trimmed, isInternal);
        setBody("");
        toast(
          isInternal ? "Internal note added." : "Working note added.",
          { variant: "success" },
        );
      } catch {
        toast("Failed to add note.", { variant: "error" });
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Visibility toggle */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={!isInternal}
          onClick={() => setIsInternal((v) => !v)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-hmd-teal focus:ring-offset-2 ${
            isInternal ? "bg-border" : "bg-hmd-teal-600"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
              isInternal ? "translate-x-0" : "translate-x-5"
            }`}
          />
        </button>
        <span className="text-xs font-medium text-muted">
          {isInternal ? (
            <>
              <span className="font-semibold text-foreground">Internal note</span>
              {" "}— hidden from customer-facing view
            </>
          ) : (
            <>
              <span className="font-semibold text-foreground">Working note</span>
              {" "}— visible in customer-facing view · end with &ldquo;?&rdquo; to flip waiting-on to customer
            </>
          )}
        </span>
      </div>

      {/* Text area */}
      <Textarea
        placeholder={
          isInternal
            ? "Internal finding, triage detail, or next step…"
            : "Customer-safe update. End with a question mark to flag as waiting on customer reply."
        }
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        disabled={isPending}
      />

      <div className="flex justify-end">
        <Button
          type="submit"
          variant="primary"
          disabled={isPending || body.trim().length === 0}
        >
          {isPending ? "Saving…" : isInternal ? "Add internal note" : "Add working note"}
        </Button>
      </div>
    </form>
  );
}
