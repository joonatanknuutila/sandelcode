import { getAccountsForTam, getConversations, getCurrentUser } from "@/lib/db";
import { InboxScreen } from "@/components/Inbox";

// TAM inbox — scoped to the accounts the TAM has cases on.
export default async function TamInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c } = await searchParams;
  const user = await getCurrentUser();
  const accounts = user ? await getAccountsForTam(user.id) : [];
  const conversations = await getConversations({
    accountIds: accounts.map((a) => a.id),
  });
  return (
    <InboxScreen
      role="tam"
      basePath="/tam/inbox"
      conversations={conversations}
      selectedKey={c}
    />
  );
}
