import {
  getAccounts,
  getCurrentUser,
  getDealsForRep,
  getUsers,
  isStalled,
} from "@/lib/db";
import { dealProbability } from "@/lib/types";
import { relativeDays } from "@/lib/format";
import { BoardDeal, PipelineBoard } from "@/components/PipelineBoard";

// Sales Rep pipeline — only their own deals; drag a card to restage it (the
// move is logged on the account timeline).
export default async function RepPipelinePage() {
  const user = await getCurrentUser();
  if (!user) return <p className="text-sm text-muted">No user signed in.</p>;

  const [deals, accounts, users] = await Promise.all([
    getDealsForRep(user.id),
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
    idleDays: relativeDays(d.updatedAt),
  }));

  return (
    <div className="mx-auto max-w-[100rem] space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My pipeline</h1>
        <p className="mt-1 text-sm text-muted">
          Drag a deal between stages to update it. Reseller deals skip contract
          negotiation. Every move is recorded on the account timeline.
        </p>
      </div>
      <PipelineBoard
        deals={boardDeals}
        capabilities={{ canDrag: true, canReassign: false }}
        dealHref="/rep/deals"
      />
    </div>
  );
}
