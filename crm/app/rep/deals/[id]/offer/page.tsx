import { notFound } from "next/navigation";
import Link from "next/link";
import { getDeal, getProducts, getServices } from "@/lib/db";
import { OfferBuilder } from "./OfferBuilder";

export default async function OfferBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [deal, products, services] = await Promise.all([
    getDeal(id),
    getProducts(),
    getServices(),
  ]);

  if (!deal) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link
            href={`/rep/deals/${id}`}
            className="text-sm font-medium uppercase tracking-wide text-muted hover:text-foreground transition-colors"
          >
            ← Back to {deal.name}
          </Link>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Build &amp; send offer
          </h1>
          <p className="mt-2 text-base text-muted">
            {deal.name} — pick what you&apos;re selling, set a discount if you
            need one, then send it for approval.
          </p>
        </div>
      </div>

      <OfferBuilder deal={deal} products={products} services={services} />
    </div>
  );
}
