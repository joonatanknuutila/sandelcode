import { getAccountCards, getAccountsForRep, getCurrentUser } from "@/lib/db";
import { AccountListView } from "@/components/AccountListView";

// Sales Rep — "all my accounts + deal status at a glance".
export default async function AccountsPage() {
  const user = await getCurrentUser();
  if (!user) return <p className="text-sm text-muted">No user signed in.</p>;
  const accounts = await getAccountsForRep(user.id);
  const cards = await getAccountCards(accounts);
  return (
    <AccountListView
      cards={cards}
      basePath="/rep/accounts"
      title="My accounts"
      subtitle={`${accounts.length} accounts in your book.`}
    />
  );
}
