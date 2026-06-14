"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, SectionTitle, StageBadge } from "@/components/ui";
import { toast } from "@/components/ui-client";
import { eur, shortDate } from "@/lib/format";
import type { Deal } from "@/lib/types";
import { createDealAction, renameDealAction } from "@/app/rep/account-actions";

export function AccountDealsPanel({
  accountId,
  currentUserId,
  deals,
  dealHref,
  plain = false,
  editable = false,
}: {
  accountId: string;
  currentUserId?: string;
  deals: Deal[];
  /** Deal card link base, e.g. "/rep/deals". Null = deals are not clickable. */
  dealHref?: string | null;
  plain?: boolean;
  editable?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draftTitle, setDraftTitle] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  function createDeal(e: React.FormEvent) {
    e.preventDefault();
    const title = draftTitle.trim();
    if (!title) return;
    startTransition(async () => {
      try {
        const { id } = await createDealAction({
          accountId,
          ownerId: currentUserId,
          title,
          stage: "interest",
          channel: "direct",
        });
        setDraftTitle("");
        toast("Deal created", { variant: "success" });
        router.push(`/rep/deals/${id}`);
      } catch (err) {
        toast(err instanceof Error ? err.message : "Failed to create deal", {
          variant: "error",
        });
      }
    });
  }

  function startRename(deal: Deal) {
    setEditingId(deal.id);
    setEditingTitle(deal.name);
  }

  function saveRename(deal: Deal) {
    const title = editingTitle.trim();
    if (!title || title === deal.name) {
      setEditingId(null);
      return;
    }
    startTransition(async () => {
      const res = await renameDealAction({ dealId: deal.id, accountId, title });
      if (!res.ok) {
        toast(res.error ?? "Could not rename deal", { variant: "error" });
        return;
      }
      setEditingId(null);
      toast("Deal renamed", { variant: "success" });
      router.refresh();
    });
  }

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <SectionTitle>Deals</SectionTitle>
        {editable && (
          <form onSubmit={createDeal} className="flex min-w-0 flex-1 justify-end gap-2 sm:max-w-xl">
            <Input
              aria-label="New deal title"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder="New deal title"
              className="min-w-0"
            />
            <Button type="submit" disabled={pending || !draftTitle.trim()}>
              Add deal
            </Button>
          </form>
        )}
      </div>
      <div className="space-y-2">
        {deals.map((d) => {
          const isEditing = editingId === d.id;
          const content = (
            <Card className="flex items-center justify-between gap-4 p-4 transition-colors hover:border-hmd-teal-600">
              <div className="min-w-0 flex-1">
                {editable && isEditing ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      saveRename(d);
                    }}
                    className="flex gap-2"
                  >
                    <Input
                      aria-label="Deal title"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      autoFocus
                    />
                    <Button type="submit" disabled={pending || !editingTitle.trim()}>
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setEditingId(null)}
                      disabled={pending}
                    >
                      Cancel
                    </Button>
                  </form>
                ) : (
                  <>
                    {dealHref ? (
                      <Link
                        href={`${dealHref}/${d.id}`}
                        className={`font-medium hover:underline ${plain ? "text-base" : ""}`}
                      >
                        {d.name}
                      </Link>
                    ) : (
                      <p className={`font-medium ${plain ? "text-base" : ""}`}>{d.name}</p>
                    )}
                    <p className={`text-muted ${plain ? "text-sm" : "text-xs"}`}>
                      {plain ? "Expected to close" : "Expected close"}{" "}
                      {shortDate(d.expectedCloseDate)}
                    </p>
                  </>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-4">
                {!isEditing && editable && (
                  <Button type="button" variant="secondary" onClick={() => startRename(d)}>
                    Rename
                  </Button>
                )}
                <div className="text-right">
                  <p className={`font-semibold ${plain ? "text-lg" : ""}`}>{eur(d.tcv)}</p>
                </div>
                <StageBadge stage={d.stage} plain={plain} />
              </div>
            </Card>
          );
          return <div key={d.id}>{content}</div>;
        })}
        {deals.length === 0 && (
          <p className={`text-muted ${plain ? "text-base" : "text-sm"}`}>No deals yet.</p>
        )}
      </div>
    </section>
  );
}
