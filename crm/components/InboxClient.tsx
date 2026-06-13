"use client";

// Client interactions for the Inbox: the reply composer and the approve/reject
// buttons. Both call Server Actions whose `revalidatePath` re-renders the
// server thread + status bar in place — no extra router.refresh(), so a click is
// one round-trip, not two (keeps the live view snappy).

import { useState, useTransition } from "react";
import { Button, Textarea } from "./ui";
import { toast } from "./ui-client";
import { decideApprovalAction, postMessageAction } from "@/app/inbox-actions";
import { ContextType } from "@/lib/types";

export function MessageComposer({
  contextType,
  contextId,
}: {
  contextType: ContextType;
  contextId: string;
}) {
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();

  function send() {
    const text = body.trim();
    if (!text) return;
    start(async () => {
      const res = await postMessageAction({ contextType, contextId, body: text });
      if (res.ok) {
        setBody("");
        toast("Message sent", { variant: "success" });
      } else {
        toast(res.error ?? "Could not send", { variant: "error" });
      }
    });
  }

  return (
    <div className="border-t border-border bg-surface p-3">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        placeholder="Reply to the team — this stays internal, attached to this context…"
        disabled={pending}
      />
      <div className="mt-2 flex justify-end">
        <Button onClick={send} disabled={pending || !body.trim()}>
          {pending ? "Sending…" : "Send"}
        </Button>
      </div>
    </div>
  );
}

export function ApprovalActions({
  offerId,
  gate,
  dealId,
}: {
  offerId: string;
  gate: "sm" | "finance";
  dealId: string;
}) {
  const [pending, start] = useTransition();

  function decide(decision: "approved" | "rejected") {
    start(async () => {
      const res = await decideApprovalAction({ offerId, gate, decision, dealId });
      if (res.ok) {
        toast(decision === "approved" ? "Approved" : "Rejected", {
          variant: decision === "approved" ? "success" : "warning",
        });
      } else {
        toast(res.error ?? "Could not record decision", { variant: "error" });
      }
    });
  }

  return (
    <div className="flex gap-2">
      <Button onClick={() => decide("approved")} disabled={pending}>
        Approve
      </Button>
      <Button
        variant="secondary"
        onClick={() => decide("rejected")}
        disabled={pending}
      >
        Reject
      </Button>
    </div>
  );
}
