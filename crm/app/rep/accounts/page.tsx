import {
  getAccountCards,
  getAccounts,
  getAccountsForRep,
  getCurrentUser,
  getDealsForRep,
  getUsers,
  isOverdue,
  isStalled,
} from "@/lib/db";
import { relativeDays } from "@/lib/format";
import { dealProbability } from "@/lib/types";
import { AccountsWorkspace } from "./AccountsWorkspace";
import type { BoardDeal } from "@/components/PipelineBoard";

// Sales Rep — accounts + deal Kanban in one place.
export default async function AccountsPage() {
  const user = await getCurrentUser();
  if (!user) return <p className="text-sm text-muted">No user signed in.</p>;

  const [accounts, deals, allAccounts, users] = await Promise.all([
    getAccountsForRep(user.id),
    getDealsForRep(user.id),
    getAccounts(),
    getUsers(),
  ]);
  const cards = await getAccountCards(accounts);
  const accountById = new Map(allAccounts.map((a) => [a.id, a]));
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

  return <AccountsWorkspace cards={cards} boardDeals={boardDeals} accountCount={accounts.length} />;
}
