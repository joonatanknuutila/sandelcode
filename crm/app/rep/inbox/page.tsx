import { getAccountsForRep, getConversations, getCurrentUser } from "@/lib/db";
import { InboxScreen } from "@/components/Inbox";

// Rep inbox — scoped to the rep's own book of accounts.
export default async function RepInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c } = await searchParams;
  const user = await getCurrentUser();
  const accounts = user ? await getAccountsForRep(user.id) : [];
  const conversations = await getConversations({
    accountIds: accounts.map((a) => a.id),
  });
  return (
    <InboxScreen
      role="rep"
      basePath="/rep/inbox"
      conversations={conversations}
      selectedKey={c}
      plain
    />
  );
}
