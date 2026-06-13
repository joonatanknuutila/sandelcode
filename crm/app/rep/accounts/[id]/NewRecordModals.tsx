"use client";

import { useState, useTransition } from "react";
import { Modal, toast } from "@/components/ui-client";
import { Button, Input, Select, Textarea } from "@/components/ui";
import {
  createDealAction,
  createCaseAction,
  createContactAction,
} from "@/app/rep/account-actions";
import { EnrichmentPanel } from "./EnrichmentPanel";
import type { User } from "@/lib/types";

// ---------------------------------------------------------------------------
// New Deal modal
// ---------------------------------------------------------------------------

interface NewDealModalProps {
  open: boolean;
  onClose: () => void;
  accountId: string;
  currentUserId: string;
}

export function NewDealModal({
  open,
  onClose,
  accountId,
  currentUserId,
}: NewDealModalProps) {
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [channel, setChannel] = useState<"direct" | "reseller">("direct");
  const [stage, setStage] = useState("interest_shown");
  const [closeDate, setCloseDate] = useState("");

  function handleClose() {
    setTitle("");
    setChannel("direct");
    setStage("interest_shown");
    setCloseDate("");
    onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    startTransition(async () => {
      try {
        await createDealAction({
          accountId,
          title: title.trim(),
          channel,
          stage: stage as Parameters<typeof createDealAction>[0]["stage"],
          expectedCloseDate: closeDate || undefined,
          ownerId: currentUserId,
        });
        toast("Deal created", { variant: "success" });
        handleClose();
      } catch (err) {
        toast(err instanceof Error ? err.message : "Failed to create deal", {
          variant: "error",
        });
      }
    });
  }

  return (
    <Modal open={open} onClose={handleClose} title="New deal">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Deal title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Nordic Police Fleet 2025"
          required
        />
        <Select
          label="Channel"
          value={channel}
          onChange={(e) =>
            setChannel(e.target.value as "direct" | "reseller")
          }
          options={[
            { value: "direct", label: "Direct" },
            { value: "reseller", label: "Reseller" },
          ]}
        />
        <Select
          label="Stage"
          value={stage}
          onChange={(e) => setStage(e.target.value)}
          options={[
            { value: "interest_shown", label: "Interest shown" },
            { value: "discovery", label: "Discovery" },
            { value: "pilot", label: "Pilot" },
            { value: "proposal", label: "Proposal" },
            { value: "negotiation", label: "Negotiation" },
            { value: "closed_won", label: "Closed won" },
            { value: "closed_lost", label: "Closed lost" },
          ]}
        />
        <Input
          label="Expected close date"
          type="date"
          value={closeDate}
          onChange={(e) => setCloseDate(e.target.value)}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={pending || !title.trim()}>
            {pending ? "Creating…" : "Create deal"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// New Service Case modal
// ---------------------------------------------------------------------------

interface NewCaseModalProps {
  open: boolean;
  onClose: () => void;
  accountId: string;
  tamUsers: User[];
  defaultTamId?: string;
}

export function NewCaseModal({
  open,
  onClose,
  accountId,
  tamUsers,
  defaultTamId,
}: NewCaseModalProps) {
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [caseType, setCaseType] = useState("inquiry");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState(defaultTamId ?? "");

  function handleClose() {
    setTitle("");
    setPriority("medium");
    setCaseType("inquiry");
    setDescription("");
    setAssigneeId(defaultTamId ?? "");
    onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    startTransition(async () => {
      try {
        await createCaseAction({
          accountId,
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          assigneeId: assigneeId || undefined,
        });
        toast("Service case opened", { variant: "success" });
        handleClose();
      } catch (err) {
        toast(err instanceof Error ? err.message : "Failed to open case", {
          variant: "error",
        });
      }
    });
  }

  return (
    <Modal open={open} onClose={handleClose} title="Open service case">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Case title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Device connectivity issue"
          required
        />
        <Select
          label="Priority"
          value={priority}
          onChange={(e) =>
            setPriority(
              e.target.value as "low" | "medium" | "high" | "urgent",
            )
          }
          options={[
            { value: "low", label: "Low" },
            { value: "medium", label: "Medium" },
            { value: "high", label: "High" },
            { value: "urgent", label: "Urgent" },
          ]}
        />
        <Select
          label="Case type"
          value={caseType}
          onChange={(e) => setCaseType(e.target.value)}
          options={[
            { value: "inquiry", label: "Inquiry" },
            { value: "request", label: "Request" },
            { value: "complaint", label: "Complaint" },
            { value: "incident", label: "Incident" },
          ]}
        />
        {tamUsers.length > 0 && (
          <Select
            label="Assigned TAM"
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            placeholder="Unassigned"
            options={tamUsers.map((u) => ({ value: u.id, label: u.name }))}
          />
        )}
        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional additional detail…"
          rows={3}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={pending || !title.trim()}>
            {pending ? "Opening…" : "Open case"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// New Contact modal
// ---------------------------------------------------------------------------

interface NewContactModalProps {
  open: boolean;
  onClose: () => void;
  accountId: string;
}

export function NewContactModal({ open, onClose, accountId }: NewContactModalProps) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);

  function handleClose() {
    setName("");
    setJobTitle("");
    setEmail("");
    setPhone("");
    setIsPrimary(false);
    onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    startTransition(async () => {
      try {
        await createContactAction({
          accountId,
          name: name.trim(),
          jobTitle: jobTitle.trim() || undefined,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          isPrimary,
        });
        toast("Contact added", { variant: "success" });
        handleClose();
      } catch (err) {
        toast(err instanceof Error ? err.message : "Failed to add contact", {
          variant: "error",
        });
      }
    });
  }

  return (
    <Modal open={open} onClose={handleClose} title="Add contact">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Anna Virtanen"
          required
        />
        <Input
          label="Job title"
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
          placeholder="e.g. Head of IT Security"
        />
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isPrimary}
            onChange={(e) => setIsPrimary(e.target.checked)}
          />
          Primary decision-maker
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={pending || !name.trim()}>
            {pending ? "Adding…" : "Add contact"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Trigger bar — client shell that owns modal open state
// ---------------------------------------------------------------------------

interface AccountActionBarProps {
  accountId: string;
  accountName: string;
  currentUserId: string;
  tamUsers: User[];
  defaultTamId?: string;
  /** Defense / government account: enrichment is off until the rep opts in. */
  sensitive: boolean;
}

export function AccountActionBar({
  accountId,
  accountName,
  currentUserId,
  tamUsers,
  defaultTamId,
  sensitive,
}: AccountActionBarProps) {
  const [dealOpen, setDealOpen] = useState(false);
  const [caseOpen, setCaseOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <EnrichmentPanel
          accountId={accountId}
          accountName={accountName}
          sensitive={sensitive}
        />
        <Button variant="secondary" onClick={() => setContactOpen(true)}>
          + Add contact
        </Button>
        <Button variant="secondary" onClick={() => setCaseOpen(true)}>
          + Open service case
        </Button>
        <Button onClick={() => setDealOpen(true)}>+ New deal</Button>
      </div>

      <NewDealModal
        open={dealOpen}
        onClose={() => setDealOpen(false)}
        accountId={accountId}
        currentUserId={currentUserId}
      />
      <NewCaseModal
        open={caseOpen}
        onClose={() => setCaseOpen(false)}
        accountId={accountId}
        tamUsers={tamUsers}
        defaultTamId={defaultTamId}
      />
      <NewContactModal
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        accountId={accountId}
      />
    </>
  );
}
