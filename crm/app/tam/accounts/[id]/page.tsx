import { notFound } from "next/navigation";
import { getAccountDetail } from "@/lib/db";
import { AccountDetailView } from "@/components/AccountDetailView";

// TAM account 360 — case/service emphasis; deals are context only (not links).
export default async function TamAccountDetail({
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
      backHref="/tam/accounts"
      backLabel="Accounts"
      dealHref={null}
    />
  );
}
