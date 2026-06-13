import { notFound } from "next/navigation";
import { getAccountDetail } from "@/lib/db";
import { AccountDetailView } from "@/components/AccountDetailView";

// Sales Manager account 360 — read-only lens onto the same shared view.
export default async function SmAccountDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getAccountDetail(id);
  if (!data) notFound();
  return (
    <AccountDetailView
      {...data}
      backHref="/sm/accounts"
      backLabel="Accounts"
      dealHref="/rep/deals"
    />
  );
}
