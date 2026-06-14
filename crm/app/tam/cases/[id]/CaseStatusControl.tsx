"use client";

import { useState, useTransition } from "react";
import { Button, Textarea, Select } from "@/components/ui";
import { Modal, toast } from "@/components/ui-client";
import {
  setCaseStatusAction,
  resolveCaseAction,
  escalateCaseAction,
  reassignCaseAction,
} from "../../actions";
import type { CaseStatus, User } from "@/lib/types";

// One-click status control — the case's lifecycle as a single segmented row,
// right next to the title (demo step 5: "Closes it" in one obvious gesture).
//   Open · In progress  → direct, one click (setCaseStatusAction)
//   Escalated           → opens a tiny prompt for the optional vendor reference
//   Resolved            → resolveCaseAction (stamps resolved_at + timeline event)
// Reassign stays as a quiet secondary action so the header doesn't lose it.

const STEPS: { value: CaseStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "escalated", label: "Escalated" },
  { value: "resolved", label: "Resolved" },
];

export function CaseStatusControl({
  caseId,
  status,
  tamUsers,
}: {
  caseId: string;
  status: CaseStatus;
  tamUsers: User[];
}) {
  const [isPending, startTransition] = useTransition();
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [refValue, setRefValue] = useState("");
  const [reassignOpen, setReassignOpen] = useState(false);
  const [selectedTam, setSelectedTam] = useState("");

  function pick(next: CaseStatus) {
    if (next === status || isPending) return;
    if (next === "escalated") {
      setEscalateOpen(true);
      return;
    }
    startTransition(async () => {
      try {
        if (next === "resolved") {
          await resolveCaseAction(caseId);
          toast("Case resolved — moved to recently resolved.", { variant: "success" });
        } else {
          await setCaseStatusAction(caseId, next);
          toast(
            next === "in_progress" ? "Marked in progress." : "Case reopened.",
            { variant: "success" },
          );
        }
      } catch {
        toast("Couldn't update the status.", { variant: "error" });
      }
    });
  }

  function submitEscalate(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await escalateCaseAction(caseId, refValue.trim() || undefined);
        toast("Escalated to 3rd-party vendor.", { variant: "warning" });
        setEscalateOpen(false);
        setRefValue("");
      } catch {
        toast("Couldn't escalate the case.", { variant: "error" });
      }
    });
  }

  function submitReassign(e: React.FormEvent) {
    e.preventDefault();
    const user = tamUsers.find((u) => u.id === selectedTam);
    if (!user) return;
    startTransition(async () => {
      try {
        await reassignCaseAction(caseId, user.id, user.name);
        toast(`Reassigned to ${user.name}.`, { variant: "success" });
        setReassignOpen(false);
        setSelectedTam("");
      } catch {
        toast("Couldn't reassign the case.", { variant: "error" });
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div className="inline-flex rounded-lg border border-border bg-background p-0.5">
        {STEPS.map((s) => {
          const active = s.value === status;
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => pick(s.value)}
              disabled={isPending}
              aria-pressed={active}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60 ${
                active
                  ? s.value === "resolved"
                    ? "bg-green-500/20 text-green-200 ring-1 ring-green-400/40"
                    : s.value === "escalated"
                      ? "bg-amber-400/20 text-amber-200 ring-1 ring-amber-400/40"
                      : "bg-hmd-teal text-hmd-charcoal"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => setReassignOpen(true)}
        className="text-xs font-medium text-muted hover:text-foreground"
      >
        Reassign →
      </button>

      {/* Escalate — optional vendor reference */}
      <Modal open={escalateOpen} onClose={() => setEscalateOpen(false)} title="Escalate to 3rd-party vendor">
        <form onSubmit={submitEscalate} className="space-y-4">
          <p className="text-sm text-muted">
            Sets the case to <strong>escalated</strong> and raises the third-party flag.
            Optionally add a vendor ticket or RMA reference.
          </p>
          <Textarea
            label="Vendor reference (optional)"
            placeholder="e.g. JIRA-1234, RMA-5678, Nokia #9ABC…"
            rows={2}
            value={refValue}
            onChange={(e) => setRefValue(e.target.value)}
            disabled={isPending}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setEscalateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isPending}>
              {isPending ? "Escalating…" : "Escalate"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reassign */}
      <Modal open={reassignOpen} onClose={() => setReassignOpen(false)} title="Reassign case">
        <form onSubmit={submitReassign} className="space-y-4">
          <p className="text-sm text-muted">
            Both the current and new TAM get an in-app notification.
          </p>
          <Select
            label="Assign to"
            placeholder="Select a TAM…"
            options={tamUsers.map((u) => ({ value: u.id, label: u.name }))}
            value={selectedTam}
            onChange={(e) => setSelectedTam(e.target.value)}
            disabled={isPending}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setReassignOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isPending || !selectedTam}>
              {isPending ? "Reassigning…" : "Reassign"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
