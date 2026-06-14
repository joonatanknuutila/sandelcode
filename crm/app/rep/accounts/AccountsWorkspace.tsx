"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AccountListView } from "@/components/AccountListView";
import { PipelineBoard, type BoardDeal } from "@/components/PipelineBoard";
import { VoiceInput } from "@/components/VoiceInput";
import { Button, Card, Input, Select, Textarea } from "@/components/ui";
import { Modal, toast } from "@/components/ui-client";
import {
  createAccountAction,
  parseLeadAction,
  type CreateAccountActionInput,
} from "@/app/rep/account-actions";
import type { AccountCard } from "@/lib/types";
import type { ParsedLead } from "@/lib/ai/lead";

type ViewMode = "list" | "kanban";

export function AccountsWorkspace({
  cards,
  boardDeals,
  accountCount,
}: {
  cards: AccountCard[];
  boardDeals: BoardDeal[];
  accountCount: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialView = searchParams.get("view") === "kanban" ? "kanban" : "list";
  const [view, setView] = useState<ViewMode>(initialView);
  const [newOpen, setNewOpen] = useState(false);
  const subtitle = `You look after ${accountCount} ${accountCount === 1 ? "customer" : "customers"}.`;

  function switchView(next: ViewMode) {
    setView(next);
    router.replace(`/rep/accounts${next === "kanban" ? "?view=kanban" : ""}`, {
      scroll: false,
    });
  }

  return (
    <div className="mx-auto max-w-[100rem] space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Accounts</h1>
          <p className="mt-2 text-base text-muted">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex rounded-md border border-border bg-surface p-1">
            <button
              type="button"
              onClick={() => switchView("list")}
              className={`min-h-9 rounded px-3 text-sm font-medium ${
                view === "list" ? "bg-hmd-teal text-hmd-teal-700" : "text-muted"
              }`}
            >
              List
            </button>
            <button
              type="button"
              onClick={() => switchView("kanban")}
              className={`min-h-9 rounded px-3 text-sm font-medium ${
                view === "kanban" ? "bg-hmd-teal text-hmd-teal-700" : "text-muted"
              }`}
            >
              Kanban
            </button>
          </div>
          <Button onClick={() => setNewOpen(true)}>New account</Button>
        </div>
      </div>

      {view === "list" ? (
        <AccountListView
          cards={cards}
          basePath="/rep/accounts"
          title="Accounts"
          subtitle={subtitle}
          showHeader={false}
          plain
        />
      ) : (
        <PipelineBoard
          deals={boardDeals}
          capabilities={{ canDrag: true, canReassign: false }}
          dealHref="/rep/deals"
          plain
        />
      )}

      <NewAccountModal open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  );
}

function NewAccountModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [leadText, setLeadText] = useState("");
  const [parsed, setParsed] = useState<ParsedLead | null>(null);
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [region, setRegion] = useState("");
  const [website, setWebsite] = useState("");
  const [summary, setSummary] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactTitle, setContactTitle] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const canCreate = name.trim().length > 0;

  const parserStatus = useMemo(() => {
    if (!parsed) return "";
    return parsed.modelUsed ? "Parsed with AI" : "Filled what could be detected locally";
  }, [parsed]);

  function reset() {
    setLeadText("");
    setParsed(null);
    setName("");
    setIndustry("");
    setRegion("");
    setWebsite("");
    setSummary("");
    setContactName("");
    setContactTitle("");
    setContactEmail("");
    setContactPhone("");
  }

  function close() {
    reset();
    onClose();
  }

  function applyParsed(next: ParsedLead) {
    setParsed(next);
    setName(next.company ?? "");
    setIndustry(next.industry ?? "");
    setRegion(next.region ?? "");
    setWebsite(next.website ?? "");
    setSummary(next.summary ?? "");
    setContactName(next.primaryContact?.name ?? "");
    setContactTitle(next.primaryContact?.title ?? "");
    setContactEmail(next.primaryContact?.email ?? "");
    setContactPhone(next.primaryContact?.phone ?? "");
  }

  function parseText() {
    if (!leadText.trim()) return;
    startTransition(async () => {
      try {
        applyParsed(await parseLeadAction(leadText));
      } catch (err) {
        toast(err instanceof Error ? err.message : "Could not parse lead", {
          variant: "error",
        });
      }
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canCreate) return;
    startTransition(async () => {
      try {
        const input: CreateAccountActionInput = {
          name: name.trim(),
          industry: industry.trim() || undefined,
          region: region.trim() || undefined,
          website: website.trim() || undefined,
          summary: summary.trim() || undefined,
        };
        if (contactName.trim() || contactEmail.trim()) {
          input.primaryContact = {
            name: contactName.trim() || contactEmail.trim(),
            jobTitle: contactTitle.trim() || undefined,
            email: contactEmail.trim() || undefined,
            phone: contactPhone.trim() || undefined,
            isPrimary: true,
          };
        }
        const { id } = await createAccountAction(input);
        toast("Account created", { variant: "success" });
        close();
        router.push(`/rep/accounts/${id}`);
      } catch (err) {
        toast(err instanceof Error ? err.message : "Failed to create account", {
          variant: "error",
        });
      }
    });
  }

  return (
    <Modal open={open} onClose={close} title="New account" className="max-w-3xl">
      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <Card className="p-4">
          <Textarea
            label="Paste prospect email thread"
            value={leadText}
            onChange={(e) => setLeadText(e.target.value)}
            placeholder="Paste the inbound email thread here..."
            rows={12}
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <VoiceInput
                onTranscript={(t) => setLeadText((v) => (v ? `${v} ${t}` : t))}
                title="Dictate"
              />
              <p className="text-sm text-muted">{parserStatus}</p>
            </div>
            <Button type="button" onClick={parseText} disabled={pending || !leadText.trim()}>
              {pending ? "Parsing..." : "Determine fields"}
            </Button>
          </div>
        </Card>

        <form onSubmit={submit} className="space-y-4">
          <Input label="Account name" value={name} onChange={(e) => setName(e.target.value)} required />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="Choose industry"
              options={[
                { value: "Government", label: "Government" },
                { value: "Defense", label: "Defense" },
                { value: "Healthcare", label: "Healthcare" },
                { value: "Finance", label: "Finance" },
                { value: "Energy", label: "Energy" },
                { value: "Enterprise", label: "Enterprise" },
              ]}
            />
            <Input label="Region" value={region} onChange={(e) => setRegion(e.target.value)} />
          </div>
          <Input label="Website" value={website} onChange={(e) => setWebsite(e.target.value)} />
          <Textarea label="Account note" value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Primary contact" value={contactName} onChange={(e) => setContactName(e.target.value)} />
            <Input label="Job title" value={contactTitle} onChange={(e) => setContactTitle(e.target.value)} />
            <Input label="Email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            <Input label="Phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={close} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !canCreate}>
              {pending ? "Creating..." : "Create account"}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
