"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Modal, toast } from "@/components/ui-client";
import { Button, Input, Select, Textarea } from "@/components/ui";
import {
  createDealAction,
  createCaseAction,
  createContactAction,
} from "@/app/rep/account-actions";
import { REP_STAGE_LABELS, type Channel, type Stage, type User } from "@/lib/types";

// Creatable HMD pipeline stages (brief §2.3) — open stages only; won/lost are
// reached later via the stage stepper, not at creation. Reseller deals skip
// "contract negotiation" (direct-only), so the picker drops it for resellers.
const CREATABLE_STAGES: Stage[] = [
  "interest",
  "rfi",
  "rfp",
  "customer_test",
  "contract_negotiation",
];

function stageOptionsFor(channel: Channel) {
  return CREATABLE_STAGES.filter(
    (s) => !(channel === "reseller" && s === "contract_negotiation"),
  ).map((s) => ({ value: s, label: REP_STAGE_LABELS[s] }));
}

// ---------------------------------------------------------------------------
// New Deal modal
// ---------------------------------------------------------------------------

interface DealRef {
  id: string;
  name: string;
}

interface NewDealModalProps {
  open: boolean;
  onClose: () => void;
  accountId: string;
  currentUserId: string;
  /** Existing deals on this account — to optionally mark a follow-on order. */
  existingDeals?: DealRef[];
}

export function NewDealModal({
  open,
  onClose,
  accountId,
  currentUserId,
  existingDeals = [],
}: NewDealModalProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [channel, setChannel] = useState<Channel>("direct");
  const [stage, setStage] = useState<Stage>("interest");
  const [closeDate, setCloseDate] = useState("");
  const [parentDealId, setParentDealId] = useState("");
  // Optional 12-month forecast at creation — off by default (an interest-stage
  // deal needn't have one yet); the full 3-year grid lives on the deal page.
  const [fcOpen, setFcOpen] = useState(false);
  const [fcPhones, setFcPhones] = useState("");
  const [fcPrice, setFcPrice] = useState("720");
  const [fcService, setFcService] = useState("36");

  // Switching to reseller while on the direct-only "contract negotiation" stage
  // would submit a stage that channel can't have — snap back to interest.
  function handleChannel(next: Channel) {
    setChannel(next);
    if (next === "reseller" && stage === "contract_negotiation") {
      setStage("interest");
    }
  }

  function handleClose() {
    setTitle("");
    setChannel("direct");
    setStage("interest");
    setCloseDate("");
    setParentDealId("");
    setFcOpen(false);
    setFcPhones("");
    setFcPrice("720");
    setFcService("36");
    onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    startTransition(async () => {
      try {
        const phones = Math.max(0, Math.round(Number(fcPhones) || 0));
        const { id } = await createDealAction({
          accountId,
          title: title.trim(),
          channel,
          stage,
          expectedCloseDate: closeDate || undefined,
          ownerId: currentUserId,
          parentDealId: parentDealId || undefined,
          forecast12mo:
            fcOpen && phones > 0
              ? {
                  totalPhones: phones,
                  unitPrice: Math.max(0, Number(fcPrice) || 0),
                  serviceQuarterly: Math.max(0, Number(fcService) || 0),
                }
              : undefined,
        });
        toast("Deal created", { variant: "success" });
        handleClose();
        // Land on the new deal so the rep enters the 3-year forecast next
        // (brief §07.02: "creates a deal … enters a 12-month forecast").
        router.push(`/rep/deals/${id}`);
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
          onChange={(e) => handleChannel(e.target.value as Channel)}
          options={[
            { value: "direct", label: "Direct" },
            { value: "reseller", label: "Reseller (partner)" },
          ]}
        />
        <Select
          label="Stage"
          value={stage}
          onChange={(e) => setStage(e.target.value as Stage)}
          options={stageOptionsFor(channel)}
        />
        <Input
          label="Expected close date"
          type="date"
          value={closeDate}
          onChange={(e) => setCloseDate(e.target.value)}
        />
        {existingDeals.length > 0 && (
          <Select
            label="Follow-on of (optional)"
            value={parentDealId}
            onChange={(e) => setParentDealId(e.target.value)}
            placeholder="Standalone — not a follow-on"
            options={existingDeals.map((d) => ({ value: d.id, label: d.name }))}
          />
        )}

        {/* Optional 12-month forecast at creation. */}
        <div className="rounded-md border border-border p-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={fcOpen}
              onChange={(e) => setFcOpen(e.target.checked)}
            />
            Add a 12-month forecast now (optional)
          </label>
          {fcOpen ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Input
                label="Phones (12 mo)"
                type="number"
                min={0}
                value={fcPhones}
                onChange={(e) => setFcPhones(e.target.value)}
                placeholder="e.g. 300"
              />
              <Input
                label="Price / phone €"
                type="number"
                min={0}
                value={fcPrice}
                onChange={(e) => setFcPrice(e.target.value)}
              />
              <Input
                label="Service €/phone/qtr"
                type="number"
                min={0}
                value={fcService}
                onChange={(e) => setFcService(e.target.value)}
              />
            </div>
          ) : (
            <p className="mt-1.5 text-xs text-muted">
              Not needed at the interest stage — you can fill the full 3-year forecast on
              the deal afterwards.
            </p>
          )}
        </div>

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
  currentUserId: string;
  tamUsers: User[];
  defaultTamId?: string;
  /** Existing deals on this account, for the "follow-on of" picker. */
  existingDeals?: DealRef[];
}

// Action buttons ordered by how often a rep reaches for them (§3): Message team
// (primary, capture/Add-note lives as the field at the top of the page), then
// New deal · Open service case · Add contact. Fetch background is demoted to a
// quiet control in the side column — it's rendered by the page, not here.
export function AccountActionBar({
  accountId,
  currentUserId,
  tamUsers,
  defaultTamId,
  existingDeals = [],
}: AccountActionBarProps) {
  const [dealOpen, setDealOpen] = useState(false);
  const [caseOpen, setCaseOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Link href={`/rep/inbox?account=${accountId}`}>
          <Button>Message team</Button>
        </Link>
        <Button variant="secondary" onClick={() => setDealOpen(true)}>
          New deal
        </Button>
        <Button variant="secondary" onClick={() => setCaseOpen(true)}>
          Open service case
        </Button>
        <Button variant="secondary" onClick={() => setContactOpen(true)}>
          Add contact
        </Button>
      </div>

      <NewDealModal
        open={dealOpen}
        onClose={() => setDealOpen(false)}
        accountId={accountId}
        currentUserId={currentUserId}
        existingDeals={existingDeals}
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
