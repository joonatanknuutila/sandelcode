import { getAccountCards, getAccounts } from "@/lib/db";
import { AccountListView } from "@/components/AccountListView";

// Sales Manager — every account in the team's book (read-only browse).
export default async function SmAccountsPage() {
  const accounts = await getAccounts();
  const cards = await getAccountCards(accounts);
  return (
    <AccountListView
      cards={cards}
      basePath="/sm/accounts"
      title="Accounts"
      subtitle={`${accounts.length} accounts across the team.`}
    />
  );
}
