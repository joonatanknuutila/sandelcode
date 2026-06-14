"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Drawer, toast } from "@/components/ui-client";
import { Badge, Button } from "@/components/ui";
import {
  enrichAccountAction,
  commitEnrichmentAction,
} from "@/app/rep/enrich-actions";
import type {
  EnrichmentResult,
  EnrichmentConfidence,
  FoundItem,
  ProposedContact,
} from "@/lib/ai/enrich";

function confidenceTone(c: EnrichmentConfidence): "green" | "amber" | "default" {
  return c === "high" ? "green" : c === "medium" ? "amber" : "default";
}

function sourceHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}

interface EnrichmentPanelProps {
  accountId: string;
  accountName: string;
  /** Defense / government accounts: enrichment is off until the rep opts in. */
  sensitive: boolean;
  /** Tertiary placement (§3) — render a small, low-prominence trigger. */
  subtle?: boolean;
}

export function EnrichmentPanel({
  accountId,
  accountName,
  sensitive,
  subtle = false,
}: EnrichmentPanelProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, startLoad] = useTransition();
  const [saving, startSave] = useTransition();
  const [result, setResult] = useState<EnrichmentResult | null>(null);
  // Sensitive accounts require an explicit opt-in before anything is sent.
  const [optedIn, setOptedIn] = useState(!sensitive);
  // Selection sets — everything proposed starts selected; the rep deselects.
  const [keepFound, setKeepFound] = useState<Set<number>>(new Set());
  const [keepContacts, setKeepContacts] = useState<Set<number>>(new Set());

  function handleClose() {
    setOpen(false);
  }

  function runFetch() {
    startLoad(async () => {
      const r = await enrichAccountAction(accountId);
      setResult(r);
      setKeepFound(new Set(r.found.map((_, i) => i)));
      setKeepContacts(new Set(r.contacts.map((_, i) => i)));
    });
  }

  function toggle(set: Set<number>, i: number): Set<number> {
    const next = new Set(set);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    return next;
  }

  function handleApprove() {
    if (!result) return;
    const found = result.found.filter((_, i) => keepFound.has(i));
    const contacts = result.contacts.filter((_, i) => keepContacts.has(i));
    startSave(async () => {
      try {
        const res = await commitEnrichmentAction({
          accountId,
          summary: result.summary,
          found,
          contacts,
        });
        if (!res.ok) {
          toast(res.error ?? "Nothing saved", { variant: "error" });
          return;
        }
        toast(
          `Saved ${res.savedFields.length} field(s), ${res.savedContacts.length} contact(s)`,
          { variant: "success" },
        );
        setOpen(false);
        setResult(null);
        router.refresh();
      } catch (err) {
        toast(err instanceof Error ? err.message : "Save failed", {
          variant: "error",
        });
      }
    });
  }

  const selectedCount = keepFound.size + keepContacts.size;

  return (
    <>
      {subtle ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm text-muted underline-offset-2 hover:text-foreground hover:underline"
        >
          ✦ Fetch background
        </button>
      ) : (
        <Button variant="secondary" onClick={() => setOpen(true)}>
          ✦ Fetch background
        </Button>
      )}

      <Drawer
        open={open}
        onClose={handleClose}
        title="Fetch background"
        width="max-w-2xl"
      >
        <div className="space-y-5 text-sm">
          <p className="text-muted">
            Public-source research for <strong className="text-foreground">{accountName}</strong>.
            Only the company name and domain are sent to web search — never CRM data.
            Nothing is saved until you approve it below.
          </p>

          {/* Sensitive-account opt-in gate */}
          {sensitive && !optedIn && (
            <div className="rounded-md border border-amber-400/35 bg-amber-400/10 p-3 text-amber-200">
              <p className="font-medium">Sensitive account — enrichment is off by default.</p>
              <p className="mt-1 text-amber-200/80">
                This is a defense / government account. External research is disabled
                unless you explicitly enable it. Only public name + domain would be sent.
              </p>
              <label className="mt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={optedIn}
                  onChange={(e) => setOptedIn(e.target.checked)}
                />
                Enable public-source research for this account
              </label>
            </div>
          )}

          {!result && (
            <Button
              onClick={runFetch}
              disabled={loading || !optedIn}
            >
              {loading ? "Researching…" : "Run research"}
            </Button>
          )}

          {result && (
            <>
              {/* Honest degradation banner */}
              {!result.modelUsed && (
                <div className="rounded-md border border-border bg-background p-3 text-muted">
                  Web grounding is offline — nothing was invented. Use the checklist
                  on the right to research manually, or add the key to go live.
                </div>
              )}

              {result.summary && (
                <p className="rounded-md border border-border bg-card p-3 text-foreground">
                  {result.summary}
                </p>
              )}

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {/* Found this */}
                <section>
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
                    Found this
                  </h3>
                  {result.found.length === 0 && result.contacts.length === 0 ? (
                    <p className="text-muted">Nothing could be grounded in a public source.</p>
                  ) : (
                    <ul className="space-y-2">
                      {result.found.map((f: FoundItem, i) => (
                        <li
                          key={`f${i}`}
                          className="rounded-md border border-border bg-card p-2"
                        >
                          <label className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={keepFound.has(i)}
                              onChange={() => setKeepFound((s) => toggle(s, i))}
                            />
                            <span className="flex-1">
                              <span className="flex items-center justify-between gap-2">
                                <span className="text-sm uppercase tracking-wide text-muted">
                                  {f.field}
                                </span>
                                <Badge tone={confidenceTone(f.confidence)}>
                                  {f.confidence}
                                </Badge>
                              </span>
                              <span className="block text-foreground">{f.value}</span>
                              {f.sourceUrl && (
                                <a
                                  href={f.sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-hmd-teal underline"
                                >
                                  {sourceHost(f.sourceUrl)} ↗
                                </a>
                              )}
                            </span>
                          </label>
                        </li>
                      ))}
                      {result.contacts.map((c: ProposedContact, i) => (
                        <li
                          key={`c${i}`}
                          className="rounded-md border border-border bg-card p-2"
                        >
                          <label className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={keepContacts.has(i)}
                              onChange={() => setKeepContacts((s) => toggle(s, i))}
                            />
                            <span className="flex-1">
                              <span className="flex items-center justify-between gap-2">
                                <span className="text-sm uppercase tracking-wide text-muted">
                                  contact
                                </span>
                                <Badge tone={confidenceTone(c.confidence)}>
                                  {c.confidence}
                                </Badge>
                              </span>
                              <span className="block text-foreground">
                                {c.name}
                                {c.title ? ` — ${c.title}` : ""}
                              </span>
                              {c.publicProfileUrl && (
                                <a
                                  href={c.publicProfileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm text-hmd-teal underline"
                                >
                                  {sourceHost(c.publicProfileUrl)} ↗
                                </a>
                              )}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {/* Worth checking yourself */}
                <section>
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
                    Worth checking yourself
                  </h3>
                  {result.checkYourself.length === 0 ? (
                    <p className="text-muted">No open gaps flagged.</p>
                  ) : (
                    <ul className="space-y-2">
                      {result.checkYourself.map((g, i) => (
                        <li
                          key={`g${i}`}
                          className="rounded-md border border-dashed border-border p-2 text-muted"
                        >
                          <span className="block text-foreground/80">{g.topic}</span>
                          <span className="text-sm">{g.why}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                <span className="text-sm text-muted">
                  {selectedCount} item(s) selected to save
                </span>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={handleClose} disabled={saving}>
                    Cancel
                  </Button>
                  <Button onClick={handleApprove} disabled={saving || selectedCount === 0}>
                    {saving ? "Saving…" : `Approve & save`}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </Drawer>
    </>
  );
}
