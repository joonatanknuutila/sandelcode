"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Tables } from "@/lib/types.db";
import type { Deal, Offer } from "@/lib/types";
import { eur } from "@/lib/format";
import { Button, Card, Input, Select, Slider, Textarea } from "@/components/ui";
import { toast } from "@/components/ui-client";
import {
  createOfferAction,
  type OfferLineActionInput,
} from "@/app/rep/offer-actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Product = Tables<"products">;
type Service = Tables<"services">;

interface LineItem {
  key: number;
  kind: "product" | "service";
  id: string;
  name: string;
  billingLabel: string;
  unitPrice: number;
  quantity: number;
  invoicingModel?: Service["invoicing_model"];
  termYears?: number;
}

interface Props {
  deal: Deal;
  products: Product[];
  services: Service[];
  existingOffer?: Offer;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compute per-line extended price then apply the header-level discount. */
function computeTotals(lines: LineItem[], discountPct: number) {
  const listTotal = lines.reduce(
    (acc, l) => acc + l.unitPrice * l.quantity,
    0,
  );
  const discountedTotal = listTotal * (1 - discountPct / 100);
  return { listTotal, discountedTotal };
}

function catalogOptions(products: Product[], services: Service[]) {
  const productOptions = products.map((p) => ({
    value: `product:${p.id}`,
    label: `${p.name} - ${eur(p.unit_price)} per device`,
  }));
  const serviceOptions = services.map((s) => ({
    value: `service:${s.id}`,
    label: `${s.name} - ${servicePriceLabel(s)}`,
  }));
  return [
    { value: "", label: "Select from pricing catalog" },
    ...productOptions,
    ...serviceOptions,
  ];
}

function servicePriceLabel(service: Service): string {
  if (service.invoicing_model === "monthly_recurring") {
    const years = service.term_years ?? 1;
    return `${eur(service.monthly_rate ?? 0)} / month, ${years} year${years === 1 ? "" : "s"}`;
  }
  if (service.invoicing_model === "fixed_term") {
    const years = service.term_years ?? 1;
    return `${eur(service.base_price ?? 0)} fixed, ${years} year${years === 1 ? "" : "s"}`;
  }
  return `${eur(service.base_price ?? 0)} one-off`;
}

function serviceLinePrice(service: Service): number {
  if (service.invoicing_model === "monthly_recurring") {
    return (service.monthly_rate ?? 0) * 12 * (service.term_years ?? 1);
  }
  return service.base_price ?? 0;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

let keyCounter = 0;
function nextKey() {
  return ++keyCounter;
}

function offerLineBillingLabel(line: Offer["lines"][number]): string {
  if (line.itemType === "product") return "Device";
  if (line.invoicingModel === "monthly_recurring") {
    const years = line.termYears ?? 1;
    return `Monthly service, ${years} year${years === 1 ? "" : "s"}`;
  }
  if (line.invoicingModel === "fixed_term") {
    const years = line.termYears ?? 1;
    return `Fixed service, ${years} year${years === 1 ? "" : "s"}`;
  }
  return "One-off service";
}

function lineFromOffer(line: Offer["lines"][number]): LineItem {
  const kind = line.itemType;
  return {
    key: nextKey(),
    kind,
    id: kind === "service" ? (line.serviceId ?? line.productId) : line.productId,
    name: line.name,
    billingLabel: offerLineBillingLabel(line),
    unitPrice: line.unitPrice,
    quantity: line.quantity,
    invoicingModel: line.invoicingModel,
    termYears: line.termYears,
  };
}

export function OfferBuilder({ deal, products, services, existingOffer }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [offerTitle, setOfferTitle] = useState(
    existingOffer?.title ?? `Offer for ${deal.name}`,
  );
  const [lines, setLines] = useState<LineItem[]>(
    () => existingOffer?.lines.map(lineFromOffer) ?? [],
  );
  const [selectedCatalog, setSelectedCatalog] = useState("");
  const [selectedQty, setSelectedQty] = useState(1);
  const [discountPct, setDiscountPct] = useState(existingOffer?.discountPct ?? 0);
  const [justification, setJustification] = useState(existingOffer?.justification ?? "");
  const [justificationError, setJustificationError] = useState("");
  const [submitError, setSubmitError] = useState("");

  const { listTotal, discountedTotal } = computeTotals(lines, discountPct);
  const savings = listTotal - discountedTotal;

  // ---------------------------------------------------------------------------
  // Catalog picker actions
  // ---------------------------------------------------------------------------

  const addLine = useCallback(() => {
    if (!selectedCatalog) return;
    const [kind, id] = selectedCatalog.split(":") as ["product" | "service", string];

    let item: Omit<LineItem, "key" | "quantity"> | null = null;

    if (kind === "product") {
      const p = products.find((x) => x.id === id);
      if (!p) return;
      item = {
        kind: "product",
        id: p.id,
        name: p.name,
        billingLabel: "Device",
        unitPrice: p.unit_price,
      };
    } else {
      const s = services.find((x) => x.id === id);
      if (!s) return;
      item = {
        kind: "service",
        id: s.id,
        name: s.name,
        billingLabel: servicePriceLabel(s),
        unitPrice: serviceLinePrice(s),
        invoicingModel: s.invoicing_model,
        termYears: s.term_years ?? undefined,
      };
    }

    if (!item) return;

    setLines((prev) => [
      ...prev,
      { ...item!, key: nextKey(), quantity: Math.max(1, selectedQty) },
    ]);
    setSelectedCatalog("");
    setSelectedQty(1);
  }, [selectedCatalog, selectedQty, products, services]);

  const removeLine = useCallback((key: number) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }, []);

  const updateLineQty = useCallback((key: number, qty: number) => {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, quantity: Math.max(1, qty) } : l)),
    );
  }, []);

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  const handleSubmit = () => {
    setJustificationError("");
    setSubmitError("");

    if (lines.length === 0) {
      setSubmitError("Add at least one product or service before submitting.");
      return;
    }

    if (discountPct > 0 && !justification.trim()) {
      setJustificationError(
        "A justification is required when applying a discount.",
      );
      return;
    }

    const actionLines: OfferLineActionInput[] = lines.map((l) => ({
      description: l.name,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      ...(l.kind === "product" ? { productId: l.id } : { serviceId: l.id }),
      invoicingModel: l.invoicingModel,
      termYears: l.termYears,
    }));

    startTransition(async () => {
      const result = await createOfferAction({
        dealId: deal.id,
        accountId: deal.accountId,
        title: offerTitle,
        discountPct,
        discountJustification: discountPct > 0 ? justification.trim() : undefined,
        lines: actionLines,
      });

      if (result.success) {
        toast(
          discountPct > 0
            ? "Discount submitted to your manager."
            : "Offer submitted to your manager.",
          { variant: "success" },
        );
        router.push(`/rep/deals/${deal.id}`);
      } else {
        setSubmitError(result.error ?? "Submission failed.");
      }
    });
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Offer title */}
      <Card className="p-5 space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
          Offer name
        </h2>
        <Input
          label="Offer title"
          className="py-2.5 text-base"
          value={offerTitle}
          onChange={(e) => setOfferTitle(e.target.value)}
          placeholder="e.g. Nokia XR21 fleet — 200 units"
        />
      </Card>

      {/* Approval routing note */}
      <div className="rounded-lg border border-border bg-surface/60 px-4 py-3 text-base text-muted">
        <span className="font-semibold text-foreground">How approval works:</span>{" "}
        Your manager checks every submitted offer. Discounts up to 10% can be
        approved there; larger discounts automatically continue to Finance.
      </div>

      {/* Catalog picker */}
      <Card className="p-5 space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
          Pricing catalog
        </h2>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <Select
              label="Catalog item"
              className="py-2.5 text-base"
              options={catalogOptions(products, services)}
              value={selectedCatalog}
              onChange={(e) => setSelectedCatalog(e.target.value)}
            />
          </div>
          <div className="w-28">
            <Input
              label="How many"
              className="py-2.5 text-base"
              type="number"
              min={1}
              value={selectedQty}
              onChange={(e) =>
                setSelectedQty(Math.max(1, parseInt(e.target.value, 10) || 1))
              }
            />
          </div>
          <Button
            variant="secondary"
            className="min-h-[44px] px-5 text-base"
            onClick={addLine}
            disabled={!selectedCatalog}
          >
            Add
          </Button>
        </div>

        {/* Line items table */}
        {lines.length > 0 && (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-base">
              <thead>
                <tr className="text-left text-sm font-medium uppercase tracking-wide text-muted border-b border-border">
                  <th className="pb-2 pr-4">Item</th>
                  <th className="pb-2 pr-4">Billing</th>
                  <th className="pb-2 pr-4 text-right">Price each</th>
                  <th className="pb-2 pr-4 text-right">How many</th>
                  <th className="pb-2 text-right">Total</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.key} className="border-b border-border/50">
                    <td className="py-2.5 pr-4 font-medium">{line.name}</td>
                    <td className="py-2.5 pr-4 text-muted text-sm">
                      {line.billingLabel}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">
                      {eur(line.unitPrice)}
                    </td>
                    <td className="py-2.5 pr-4 text-right">
                      <input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(e) =>
                          updateLineQty(
                            line.key,
                            parseInt(e.target.value, 10) || 1,
                          )
                        }
                        className="w-20 rounded border border-border bg-surface px-2 py-2 text-base text-right tabular-nums outline-none focus:border-hmd-teal focus:ring-1 focus:ring-hmd-teal/40"
                      />
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      {eur(line.unitPrice * line.quantity)}
                    </td>
                    <td className="py-2.5 pl-3">
                      <button
                        onClick={() => removeLine(line.key)}
                        className="grid h-9 w-9 place-items-center rounded text-muted hover:text-danger transition-colors text-base"
                        aria-label="Remove item"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {lines.length === 0 && (
          <p className="text-base text-muted text-center py-4">
            Nothing added yet — pick a product or service above.
          </p>
        )}
      </Card>

      {/* Discount slider + totals */}
      <Card className="p-5 space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
          Discount &amp; total
        </h2>

        <Slider
          label="Discount"
          value={discountPct}
          min={0}
          max={30}
          step={1}
          formatValue={(v) => `${v}%`}
          onChange={(e) => setDiscountPct(Number(e.target.value))}
        />

        {/* Live totals — quiet until there's a line item (§5), so the page
            doesn't open with a big empty €0 / €0 band. */}
        {lines.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-border px-5 py-4 text-center text-sm text-muted">
            Add a product or service to see the total.
          </p>
        ) : (
          <div className="mt-4 rounded-xl bg-[#e4ff00] px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-black/60">
                  Catalog total
                </p>
                <p className="text-xl font-semibold text-black tabular-nums line-through decoration-black/40">
                  {eur(listTotal)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold uppercase tracking-wide text-black/60">
                  Submitted price ({discountPct}% off)
                </p>
                <p className="text-3xl font-bold text-black tabular-nums">
                  {eur(discountedTotal)}
                </p>
              </div>
            </div>
            {discountPct > 0 && (
              <p className="mt-2 text-sm text-black/60 text-right">
                Discount value {eur(savings)}
              </p>
            )}
          </div>
        )}

        {/* Justification */}
        {discountPct > 0 && (
          <Textarea
            label="Discount justification (required)"
            className="text-base"
            placeholder="A short reason, such as order size, strategic account, or competitive pressure."
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            error={justificationError}
            rows={3}
          />
        )}
      </Card>

      {/* Submit */}
      <div className="flex items-center justify-between gap-4">
        <div>
          {submitError && (
            <p className="text-base text-danger">{submitError}</p>
          )}
        </div>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            className="min-h-[44px] px-5 text-base"
            onClick={() => router.push(`/rep/deals/${deal.id}`)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            className="min-h-[44px] px-5 text-base"
            onClick={handleSubmit}
            disabled={isPending || lines.length === 0}
          >
            {isPending
              ? "Submitting..."
              : discountPct > 0
                ? "Submit discount"
                : "Submit offer"}
          </Button>
        </div>
      </div>
    </div>
  );
}
