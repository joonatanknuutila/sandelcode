import { getConversations } from "@/lib/db";
import { InboxScreen } from "@/components/Inbox";

// Finance inbox — sees every conversation, and is the second approval gate.
export default async function FinanceInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c } = await searchParams;
  const conversations = await getConversations();
  return (
    <InboxScreen
      role="finance"
      basePath="/finance/inbox"
      conversations={conversations}
      selectedKey={c}
    />
  );
}
