import { getConversations } from "@/lib/db";
import { InboxScreen } from "@/components/Inbox";

// Sales Manager inbox — sees every conversation, and is the first approval gate.
export default async function SmInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const { c } = await searchParams;
  const conversations = await getConversations();
  return (
    <InboxScreen
      role="sm"
      basePath="/sm/inbox"
      conversations={conversations}
      selectedKey={c}
    />
  );
}
