"use client";

import { useState, useTransition } from "react";
import { Modal, toast } from "@/components/ui-client";
import { Button, Select, Textarea } from "@/components/ui";
import { ActivityType, Channel, Stage, REP_STAGE_LABELS, STAGE_ORDER } from "@/lib/types";
import type { NbaCTA } from "@/lib/ai";
import {
  logActivityAction,
  moveStageAction,
  draftEmailAction,
} from "../../actions";

// ---------------------------------------------------------------------------
// Activity type options
// ---------------------------------------------------------------------------
const ACTIVITY_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Meeting" },
  { value: "note", label: "Note" },
];

// ---------------------------------------------------------------------------
// LogActivityModal — shared by "Log activity" button and log_call CTA
// ---------------------------------------------------------------------------
function LogActivityModal({
  open,
  onClose,
  dealId,
  accountId,
  defaultType = "call",
}: {
  open: boolean;
  onClose: () => void;
  dealId: string;
  accountId: string;
  defaultType?: ActivityType;
}) {
  const [activityType, setActivityType] = useState<string>(defaultType);
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    startTransition(async () => {
      const result = await logActivityAction({
        dealId,
        accountId,
        type: activityType as ActivityType,
        title: ACTIVITY_TYPE_OPTIONS.find((o) => o.value === activityType)?.label ?? activityType,
        body: body.trim(),
      });
      if (result.ok) {
        toast("Activity logged", { variant: "success" });
        setBody("");
        onClose();
      } else {
        toast(result.error ?? "Failed to log activity", { variant: "error" });
      }
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Log activity">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Type"
          value={activityType}
          options={ACTIVITY_TYPE_OPTIONS}
          onChange={(e) => setActivityType(e.target.value)}
        />
        <Textarea
          label="Notes"
          placeholder="What happened? Key points, commitments, next steps…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
        />
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={pending || !body.trim()}
            style={{ background: "#e4ff00", color: "#000" }}
          >
            {pending ? "Saving…" : "Log activity"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// EmailDraftModal — draft + "Log as sent" path
// ---------------------------------------------------------------------------
function EmailDraftModal({
  open,
  onClose,
  dealId,
  accountId,
  dealName,
  accountName,
  rationale,
}: {
  open: boolean;
  onClose: () => void;
  dealId: string;
  accountId: string;
  dealName: string;
  accountName: string;
  rationale: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [modelUsed, setModelUsed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  // Fetch draft when modal opens
  function fetchDraft() {
    setLoading(true);
    draftEmailAction({ dealName, accountName, rationale })
      .then((res) => {
        setDraft(res.draft);
        setModelUsed(res.modelUsed);
      })
      .finally(() => setLoading(false));
  }

  // Reset when closed
  function handleClose() {
    setDraft(null);
    setModelUsed(false);
    onClose();
  }

  // Log as sent
  function handleLogSent() {
    if (!draft) return;
    startTransition(async () => {
      const result = await logActivityAction({
        dealId,
        accountId,
        type: "email",
        title: "Email sent",
        body: draft.trim(),
      });
      if (result.ok) {
        toast("Email logged as sent", { variant: "success" });
        handleClose();
      } else {
        toast(result.error ?? "Failed to log email", { variant: "error" });
      }
    });
  }

  return (
    <Modal open={open} onClose={handleClose} title="Draft email">
      <div className="space-y-4">
        {draft === null ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <p className="text-sm text-muted">
              Generate an AI draft based on the deal context, then review and
              edit before logging it as sent.
            </p>
            <Button
              onClick={fetchDraft}
              disabled={loading}
              style={{ background: "#e4ff00", color: "#000" }}
            >
              {loading ? "Drafting…" : "Generate draft"}
            </Button>
          </div>
        ) : (
          <>
            {!modelUsed && (
              <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
                Model offline — this is a templated draft. Edit before sending.
              </p>
            )}
            <Textarea
              label="Email body (review & edit)"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={8}
            />
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="secondary" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleLogSent}
                disabled={pending || !draft.trim()}
                style={{ background: "#e4ff00", color: "#000" }}
              >
                {pending ? "Saving…" : "Log as sent"}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// MoveStageModal — advance stage with one click
// ---------------------------------------------------------------------------
function MoveStageModal({
  open,
  onClose,
  dealId,
  accountId,
  currentStage,
  channel,
}: {
  open: boolean;
  onClose: () => void;
  dealId: string;
  accountId: string;
  currentStage: Stage;
  channel: Channel;
}) {
  // Reseller deals skip contract negotiation (brief 2.3) — don't offer it as a
  // move target, mirroring StageStepper and the server-side guard.
  const availableStages = STAGE_ORDER.filter(
    (s) =>
      s !== currentStage &&
      !(channel === "reseller" && s === "contract_negotiation"),
  );
  const [targetStage, setTargetStage] = useState<string>(
    availableStages[0] ?? currentStage,
  );
  const [pending, startTransition] = useTransition();

  const stageOptions = availableStages.map((s) => ({
    value: s,
    label: REP_STAGE_LABELS[s],
  }));

  function handleConfirm() {
    startTransition(async () => {
      const result = await moveStageAction(dealId, accountId, targetStage as Stage);
      if (result.ok) {
        toast(`Stage updated to "${REP_STAGE_LABELS[targetStage as Stage]}"`, {
          variant: "success",
        });
        onClose();
      } else {
        toast(result.error ?? "Failed to update stage", { variant: "error" });
      }
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Move deal stage">
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Current stage:{" "}
          <span className="font-medium text-foreground">
            {REP_STAGE_LABELS[currentStage]}
          </span>
        </p>
        <Select
          label="Move to"
          value={targetStage}
          options={stageOptions}
          onChange={(e) => setTargetStage(e.target.value)}
        />
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={pending}
            style={{ background: "#e4ff00", color: "#000" }}
          >
            {pending ? "Saving…" : "Confirm"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// DealActions — hero component for the cockpit
// ---------------------------------------------------------------------------
export interface DealActionsProps {
  dealId: string;
  accountId: string;
  dealName: string;
  accountName: string;
  currentStage: Stage;
  /** Deal channel — gates reseller-specific stage rules in the move modal. */
  channel: Channel;
  /** CTA descriptor from the NBA result */
  cta: NbaCTA;
  /** Rationale text used to ground the email draft */
  nbaDetail: string;
}

type ActiveModal =
  | "none"
  | "log_call"
  | "draft_email"
  | "move_stage";

export function DealActions({
  dealId,
  accountId,
  dealName,
  accountName,
  currentStage,
  channel,
  cta,
  nbaDetail,
}: DealActionsProps) {
  const [activeModal, setActiveModal] = useState<ActiveModal>("none");

  function handleCtaClick() {
    switch (cta.kind) {
      case "log_call":
        setActiveModal("log_call");
        break;
      case "draft_email":
        setActiveModal("draft_email");
        break;
      case "move_stage":
        setActiveModal("move_stage");
        break;
      case "open_offer":
        // Navigation handled by the parent via Link — no modal needed
        break;
    }
  }

  return (
    <>
      {/* NBA CTA button */}
      <Button
        className="min-h-[44px] px-5 text-base"
        onClick={cta.kind !== "open_offer" ? handleCtaClick : undefined}
        style={
          cta.kind !== "open_offer"
            ? { background: "#e4ff00", color: "#000" }
            : undefined
        }
        variant={cta.kind === "open_offer" ? "secondary" : undefined}
      >
        {cta.label}
      </Button>

      {/* "+ Log activity" button rendered by parent — triggers via prop */}
      {/* (parent passes onLogActivity which calls setActiveModal("log_call")) */}

      {/* Modals */}
      <LogActivityModal
        open={activeModal === "log_call"}
        onClose={() => setActiveModal("none")}
        dealId={dealId}
        accountId={accountId}
        defaultType={cta.kind === "log_call" ? "call" : "note"}
      />
      <EmailDraftModal
        open={activeModal === "draft_email"}
        onClose={() => setActiveModal("none")}
        dealId={dealId}
        accountId={accountId}
        dealName={dealName}
        accountName={accountName}
        rationale={nbaDetail}
      />
      <MoveStageModal
        open={activeModal === "move_stage"}
        onClose={() => setActiveModal("none")}
        dealId={dealId}
        accountId={accountId}
        currentStage={currentStage}
        channel={channel}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// LogActivityButton — standalone "Log activity" button with its modal
// Embedded in the header button row; shares the same LogActivityModal.
// ---------------------------------------------------------------------------
export function LogActivityButton({
  dealId,
  accountId,
}: {
  dealId: string;
  accountId: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="secondary"
        className="min-h-[44px] px-5 text-base"
        onClick={() => setOpen(true)}
      >
        + Log activity
      </Button>
      <LogActivityModal
        open={open}
        onClose={() => setOpen(false)}
        dealId={dealId}
        accountId={accountId}
      />
    </>
  );
}
