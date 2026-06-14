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
  const [partyValue, setPartyValue] = useState("3rd-party SOC");
  const [escalationStatus, setEscalationStatus] = useState<"waiting" | "replied" | "resolved">("waiting");
  const [refValue, setRefValue] = useState("");
  const [escalationDetail, setEscalationDetail] = useState("");
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolution, setResolution] = useState("");
  const [reassignOpen, setReassignOpen] = useState(false);
  const [selectedTam, setSelectedTam] = useState("");

  function pick(next: CaseStatus) {
    if (next === status || isPending) return;
    if (next === "escalated") {
      setEscalateOpen(true);
      return;
    }
    if (next === "resolved") {
      setResolveOpen(true);
      return;
    }
    startTransition(async () => {
      try {
        await setCaseStatusAction(caseId, next);
        toast(
          next === "in_progress" ? "Marked in progress." : "Case reopened.",
          { variant: "success" },
        );
      } catch {
        toast("Couldn't update the status.", { variant: "error" });
      }
    });
  }

  function submitEscalate(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await escalateCaseAction(caseId, {
          party: partyValue,
          status: escalationStatus,
          reference: refValue,
          detail: escalationDetail,
        });
        toast(
          escalationStatus === "waiting"
            ? "Case is waiting on an external party."
            : "3rd-party update recorded.",
          { variant: "warning" },
        );
        setEscalateOpen(false);
        setPartyValue("3rd-party SOC");
        setEscalationStatus("waiting");
        setRefValue("");
        setEscalationDetail("");
      } catch {
        toast("Couldn't escalate the case.", { variant: "error" });
      }
    });
  }

  function submitResolve(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await resolveCaseAction(caseId, resolution);
        toast("Case resolved — resolution recorded.", { variant: "success" });
        setResolveOpen(false);
        setResolution("");
      } catch {
        toast("Couldn't resolve the case.", { variant: "error" });
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
      <Modal open={escalateOpen} onClose={() => setEscalateOpen(false)} title="Escalate to 3rd party">
        <form onSubmit={submitEscalate} className="space-y-4">
          <p className="text-sm text-muted">
            Logs the external dependency on the case timeline and keeps the case
            visibly waiting on that party until it is resolved.
          </p>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
              Party
            </span>
            <input
              value={partyValue}
              onChange={(e) => setPartyValue(e.target.value)}
              placeholder="e.g. 3rd-party SOC, MDM vendor, carrier"
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-hmd-teal-600"
              disabled={isPending}
            />
          </label>
          <Select
            label="Escalation status"
            options={[
              { value: "waiting", label: "Waiting" },
              { value: "replied", label: "Replied" },
              { value: "resolved", label: "External issue resolved" },
            ]}
            value={escalationStatus}
            onChange={(e) => setEscalationStatus(e.target.value as "waiting" | "replied" | "resolved")}
            disabled={isPending}
          />
          <Textarea
            label="Reference"
            placeholder="e.g. SOC-7741, RMA-5678"
            rows={2}
            value={refValue}
            onChange={(e) => setRefValue(e.target.value)}
            disabled={isPending}
          />
          <Textarea
            label="What happened?"
            placeholder="What did you ask for, or what did they reply?"
            rows={3}
            value={escalationDetail}
            onChange={(e) => setEscalationDetail(e.target.value)}
            disabled={isPending}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setEscalateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isPending}>
              {isPending ? "Recording…" : "Record escalation"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Resolve — always capture the resolution while closing. */}
      <Modal open={resolveOpen} onClose={() => setResolveOpen(false)} title="Resolve case">
        <form onSubmit={submitResolve} className="space-y-4">
          <p className="text-sm text-muted">
            Record the resolution before closing so it stays on the case history
            instead of disappearing into email.
          </p>
          <Textarea
            label="Resolution"
            placeholder="What fixed it? What should the next TAM know?"
            rows={4}
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            disabled={isPending}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setResolveOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isPending || !resolution.trim()}>
              {isPending ? "Resolving…" : "Resolve and record"}
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
