import { getAllProducts, getAllServices } from "@/lib/db";
import { SectionTitle } from "@/components/ui";
import { CatalogEditor } from "./CatalogEditor";

export default async function CatalogPage() {
  const [products, services] = await Promise.all([
    getAllProducts(),
    getAllServices(),
  ]);

  return (
    <div className="space-y-8 p-6">
      <div>
        <SectionTitle>Pricing Catalog</SectionTitle>
        <p className="mt-1 text-sm text-muted">
          Manage products and services. Changes to list prices are immediately
          reflected in the rep offer builder. Retiring an item hides it from
          new offers while preserving historical data.
        </p>
      </div>
      <CatalogEditor products={products} services={services} />
    </div>
  );
}
