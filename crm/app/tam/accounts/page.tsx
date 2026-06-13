import { getAccountCards, getAccountsForTam, getCurrentUser } from "@/lib/db";
import { AccountListView } from "@/components/AccountListView";

// TAM — accounts where they have cases (brief Block 2).
export default async function TamAccountsPage() {
  const user = await getCurrentUser();
  if (!user) return <p className="text-sm text-muted">No user signed in.</p>;
  const accounts = await getAccountsForTam(user.id);
  const cards = await getAccountCards(accounts);
  return (
    <AccountListView
      cards={cards}
      basePath="/tam/accounts"
      title="Accounts"
      subtitle="Accounts where you have open or recent cases."
    />
  );
}
