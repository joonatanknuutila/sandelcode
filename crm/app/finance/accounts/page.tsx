import { getAccountCards, getAccounts } from "@/lib/db";
import { AccountListView } from "@/components/AccountListView";

// Finance — every account (read-only browse; the numbers live in Forecast).
export default async function FinanceAccountsPage() {
  const accounts = await getAccounts();
  const cards = await getAccountCards(accounts);
  return (
    <AccountListView
      cards={cards}
      basePath="/finance/accounts"
      title="Accounts"
      subtitle={`${accounts.length} accounts.`}
    />
  );
}
