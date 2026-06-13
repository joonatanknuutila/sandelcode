"use client";

import { useTransition } from "react";
import { toast } from "@/components/ui-client";
import { resolveCaseAction } from "./actions";

// ---------------------------------------------------------------------------
// QueueResolveButton — quick-resolve on the TAM queue row.
// Rendered next to the Link so the click doesn't navigate.
// ---------------------------------------------------------------------------

interface Props {
  caseId: string;
}

export function QueueResolveButton({ caseId }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Mark this case as resolved?")) return;
    startTransition(async () => {
      try {
        await resolveCaseAction(caseId);
        toast("Case resolved.", { variant: "success" });
      } catch {
        toast("Failed to resolve.", { variant: "error" });
      }
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      title="Resolve case"
      aria-label="Resolve case"
      className="shrink-0 rounded-lg border border-border bg-surface px-2.5 py-2 text-xs font-medium text-foreground transition-colors hover:border-hmd-teal-600 hover:text-hmd-teal-700 disabled:opacity-50"
    >
      {isPending ? "…" : "✓"}
    </button>
  );
}
