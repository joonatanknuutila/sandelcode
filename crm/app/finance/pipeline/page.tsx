import Link from "next/link";
import { getAccounts, getAllDeals, getUsers, isStalled, isOverdue } from "@/lib/db";
import { dealProbability } from "@/lib/types";
import { relativeDays } from "@/lib/format";
import { BoardDeal, PipelineBoard } from "@/components/PipelineBoard";

// Finance pipeline — read-only context. Forecast (with judgment adjustment) is
// Finance's real tool, so the board just links there.
export default async function FinancePipelinePage() {
  const [deals, accounts, users] = await Promise.all([
    getAllDeals(),
    getAccounts(),
    getUsers(),
  ]);
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const userById = new Map(users.map((u) => [u.id, u]));

  const boardDeals: BoardDeal[] = deals.map((d) => ({
    id: d.id,
    accountName: accountById.get(d.accountId)?.name ?? "Unknown account",
    dealName: d.name,
    ownerId: d.ownerId,
    ownerInitials: userById.get(d.ownerId)?.initials ?? "?",
    tcv: d.tcv,
    channel: d.channel,
    stage: d.stage,
    confidence: Math.round(dealProbability(d) * 100),
    stalled: isStalled(d),
    overdue: isOverdue(d),
    idleDays: relativeDays(d.updatedAt),
  }));

  return (
    <div className="mx-auto max-w-[100rem] space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
          <p className="mt-1 text-sm text-muted">
            Read-only context. Use Forecast to adjust confidence and commit
            figures.
          </p>
        </div>
        <Link
          href="/finance"
          className="inline-flex items-center gap-1.5 rounded-md bg-hmd-teal px-3.5 py-2 text-sm font-medium text-hmd-teal-700 hover:bg-hmd-teal/90"
        >
          Open in forecast →
        </Link>
      </div>
      <PipelineBoard
        deals={boardDeals}
        capabilities={{ canDrag: false, canReassign: false }}
        dealHref="/rep/deals"
      />
    </div>
  );
}
