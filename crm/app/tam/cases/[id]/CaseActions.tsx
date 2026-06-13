"use client";

import { useState, useTransition } from "react";
import { Button, Textarea, Select } from "@/components/ui";
import { Modal, toast } from "@/components/ui-client";
import {
  resolveCaseAction,
  escalateCaseAction,
  reassignCaseAction,
} from "../../actions";
import type { User } from "@/lib/types";
import type { CaseStatus } from "@/lib/types";

// ---------------------------------------------------------------------------
// CaseActions — header-bar buttons for Resolve / Escalate / Reassign.
// Rendered client-side so we can drive Modal state without Server Components
// having to know about open/closed UI state.
// ---------------------------------------------------------------------------

interface CaseActionsProps {
  caseId: string;
  accountId: string;
  caseStatus: CaseStatus;
  /** All TAM-role users for the reassign select. */
  tamUsers: User[];
}

export function CaseActions({
  caseId,
  caseStatus,
  tamUsers,
}: CaseActionsProps) {
  const [isPending, startTransition] = useTransition();

  // --- Resolve ---------------------------------------------------------------
  function handleResolve() {
    if (!confirm("Mark this case as resolved?")) return;
    startTransition(async () => {
      try {
        await resolveCaseAction(caseId);
        toast("Case resolved.", { variant: "success" });
      } catch {
        toast("Failed to resolve case.", { variant: "error" });
      }
    });
  }

  // --- Escalate modal --------------------------------------------------------
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [refValue, setRefValue] = useState("");
  const [escalatePending, startEscalate] = useTransition();

  function submitEscalate(e: React.FormEvent) {
    e.preventDefault();
    startEscalate(async () => {
      try {
        await escalateCaseAction(caseId, refValue.trim() || undefined);
        toast("Case escalated to 3rd party.", { variant: "warning" });
        setEscalateOpen(false);
        setRefValue("");
      } catch {
        toast("Failed to escalate case.", { variant: "error" });
      }
    });
  }

  // --- Reassign modal --------------------------------------------------------
  const [reassignOpen, setReassignOpen] = useState(false);
  const [selectedTam, setSelectedTam] = useState("");
  const [reassignPending, startReassign] = useTransition();

  function submitReassign(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTam) return;
    const user = tamUsers.find((u) => u.id === selectedTam);
    if (!user) return;
    startReassign(async () => {
      try {
        await reassignCaseAction(caseId, user.id, user.name);
        toast(`Case reassigned to ${user.name}.`, { variant: "success" });
        setReassignOpen(false);
        setSelectedTam("");
      } catch {
        toast("Failed to reassign case.", { variant: "error" });
      }
    });
  }

  const isResolved = caseStatus === "resolved";
  const isEscalated = caseStatus === "escalated";

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {/* Resolve */}
        {!isResolved && (
          <Button
            variant="primary"
            onClick={handleResolve}
            disabled={isPending}
          >
            ✓ Resolve
          </Button>
        )}

        {/* Escalate */}
        {!isResolved && !isEscalated && (
          <Button
            variant="secondary"
            onClick={() => setEscalateOpen(true)}
            disabled={isPending}
          >
            ↑ Escalate
          </Button>
        )}

        {/* Reassign */}
        {!isResolved && (
          <Button
            variant="secondary"
            onClick={() => setReassignOpen(true)}
            disabled={isPending}
          >
            → Reassign
          </Button>
        )}
      </div>

      {/* Escalate modal */}
      <Modal
        open={escalateOpen}
        onClose={() => setEscalateOpen(false)}
        title="Escalate to 3rd-party vendor"
      >
        <form onSubmit={submitEscalate} className="space-y-4">
          <p className="text-sm text-muted">
            This will set the case status to <strong>escalated</strong> and raise the
            third-party flag. Optionally enter a vendor ticket or RMA reference.
          </p>
          <Textarea
            label="Vendor reference (optional)"
            placeholder="e.g. JIRA-1234, RMA-5678, Nokia #9ABC…"
            rows={2}
            value={refValue}
            onChange={(e) => setRefValue(e.target.value)}
            disabled={escalatePending}
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEscalateOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={escalatePending}>
              {escalatePending ? "Escalating…" : "Escalate"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reassign modal */}
      <Modal
        open={reassignOpen}
        onClose={() => setReassignOpen(false)}
        title="Reassign case"
      >
        <form onSubmit={submitReassign} className="space-y-4">
          <p className="text-sm text-muted">
            Both the current and new TAM will receive an in-app notification.
          </p>
          <Select
            label="Assign to"
            placeholder="Select a TAM…"
            options={tamUsers.map((u) => ({ value: u.id, label: u.name }))}
            value={selectedTam}
            onChange={(e) => setSelectedTam(e.target.value)}
            disabled={reassignPending}
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setReassignOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={reassignPending || !selectedTam}
            >
              {reassignPending ? "Reassigning…" : "Reassign"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
