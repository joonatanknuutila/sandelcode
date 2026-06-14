import { notFound } from "next/navigation";
import {
  getAccount,
  getActivitiesForAccount,
  getCasesForAccount,
  getContactsForAccount,
  getCurrentUser,
  getDealsForAccount,
  getUser,
  getUsers,
} from "@/lib/db";
import { AccountDetailView } from "@/components/AccountDetailView";
import { isSensitiveIndustry } from "@/lib/ai/enrich";
import { AccountActionBar } from "./NewRecordModals";

// Account 360 — the rep's editable lens (quick actions in the action slot).
// params is a Promise in Next 16.
export default async function AccountDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const account = await getAccount(id);
  if (!account) notFound();

  const [contacts, deals, cases, activities, tam, currentUser, allUsers] =
    await Promise.all([
      getContactsForAccount(id),
      getDealsForAccount(id),
      getCasesForAccount(id),
      getActivitiesForAccount(id),
      account.tamId ? getUser(account.tamId) : Promise.resolve(null),
      getCurrentUser(),
      getUsers(),
    ]);
  const tamUsers = allUsers.filter((u) => u.role === "tam");

  return (
    <AccountDetailView
      account={account}
      contacts={contacts}
      deals={deals}
      cases={cases}
      activities={activities}
      tam={tam}
      backHref="/rep/accounts"
      backLabel="My customers"
      dealHref="/rep/deals"
      plain
      actions={
        <AccountActionBar
          accountId={id}
          accountName={account.name}
          currentUserId={currentUser?.id ?? ""}
          tamUsers={tamUsers}
          defaultTamId={account.tamId}
          sensitive={isSensitiveIndustry(account.industry)}
        />
      }
    />
  );
}
