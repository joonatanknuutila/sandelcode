"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Tables } from "@/lib/types.db";
import type { Deal } from "@/lib/types";
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
  unitPrice: number;
  quantity: number;
  invoicingModel?: Service["invoicing_model"];
  termYears?: number;
}

interface Props {
  deal: Deal;
  products: Product[];
  services: Service[];
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
    label: `${p.name} — ${eur(p.unit_price)} / unit`,
  }));
  const serviceOptions = services.map((s) => ({
    value: `service:${s.id}`,
    label: `${s.name} (${s.invoicing_model})`,
  }));
  return [
    { value: "", label: "— select a product or service —" },
    ...productOptions,
    ...serviceOptions,
  ];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

let keyCounter = 0;
function nextKey() {
  return ++keyCounter;
}

export function OfferBuilder({ deal, products, services }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [offerTitle, setOfferTitle] = useState(
    `Offer for ${deal.name}`,
  );
  const [lines, setLines] = useState<LineItem[]>([]);
  const [selectedCatalog, setSelectedCatalog] = useState("");
  const [selectedQty, setSelectedQty] = useState(1);
  const [discountPct, setDiscountPct] = useState(0);
  const [justification, setJustification] = useState("");
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
        unitPrice: p.unit_price,
      };
    } else {
      const s = services.find((x) => x.id === id);
      if (!s) return;
      // For services: use base_price or monthly_rate as unit price depending on model
      const unitPrice =
        s.invoicing_model === "monthly_recurring"
          ? (s.monthly_rate ?? 0)
          : (s.base_price ?? 0);
      item = {
        kind: "service",
        id: s.id,
        name: s.name,
        unitPrice,
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
        toast("Offer submitted for SM approval.", { variant: "success" });
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
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted">
          Offer details
        </h2>
        <Input
          label="Offer title"
          value={offerTitle}
          onChange={(e) => setOfferTitle(e.target.value)}
          placeholder="e.g. Nokia XR21 fleet — 200 units"
        />
      </Card>

      {/* Approval routing note */}
      <div className="rounded-lg border border-border bg-surface/60 px-4 py-3 text-xs text-muted">
        <span className="font-semibold text-foreground">
          Product assumption — approval routing:
        </span>{" "}
        Every submitted offer goes to the Sales Manager first. Discounts{" "}
        <span className="font-medium">{"≤10%"}</span> are approved by SM only;
        discounts{" "}
        <span className="font-medium">{">10%"}</span> automatically escalate to
        Finance after SM approves.
      </div>

      {/* Catalog picker */}
      <Card className="p-5 space-y-4">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted">
          Add line items
        </h2>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <Select
              label="Product / service"
              options={catalogOptions(products, services)}
              value={selectedCatalog}
              onChange={(e) => setSelectedCatalog(e.target.value)}
            />
          </div>
          <div className="w-28">
            <Input
              label="Qty"
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
            onClick={addLine}
            disabled={!selectedCatalog}
          >
            Add
          </Button>
        </div>

        {/* Line items table */}
        {lines.length > 0 && (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-medium uppercase tracking-wide text-muted border-b border-border">
                  <th className="pb-2 pr-4">Item</th>
                  <th className="pb-2 pr-4">Model</th>
                  <th className="pb-2 pr-4 text-right">Unit price</th>
                  <th className="pb-2 pr-4 text-right">Qty</th>
                  <th className="pb-2 text-right">Line total</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.key} className="border-b border-border/50">
                    <td className="py-2 pr-4 font-medium">{line.name}</td>
                    <td className="py-2 pr-4 text-muted text-xs capitalize">
                      {line.invoicingModel?.replace(/_/g, " ") ?? "one-off"}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {eur(line.unitPrice)}
                    </td>
                    <td className="py-2 pr-4 text-right">
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
                        className="w-16 rounded border border-border bg-surface px-2 py-1 text-sm text-right tabular-nums outline-none focus:border-hmd-teal focus:ring-1 focus:ring-hmd-teal/40"
                      />
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {eur(line.unitPrice * line.quantity)}
                    </td>
                    <td className="py-2 pl-3">
                      <button
                        onClick={() => removeLine(line.key)}
                        className="text-muted hover:text-danger transition-colors text-xs"
                        aria-label="Remove line"
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
          <p className="text-sm text-muted text-center py-4">
            No line items yet — select a product or service above.
          </p>
        )}
      </Card>

      {/* Discount slider + totals */}
      <Card className="p-5 space-y-4">
        <h2 className="text-xs font-medium uppercase tracking-wide text-muted">
          Discount & totals
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

        {/* Live totals */}
        <div className="mt-4 rounded-xl bg-[#e4ff00] px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-black/60">
                List total
              </p>
              <p className="text-lg font-semibold text-black tabular-nums line-through decoration-black/40">
                {eur(listTotal)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-wide text-black/60">
                Offer price ({discountPct}% off)
              </p>
              <p className="text-3xl font-bold text-black tabular-nums">
                {eur(discountedTotal)}
              </p>
            </div>
          </div>
          {discountPct > 0 && (
            <p className="mt-2 text-xs text-black/60 text-right">
              Saving {eur(savings)} vs. list
            </p>
          )}
        </div>

        {/* Justification */}
        {discountPct > 0 && (
          <Textarea
            label="Discount justification (required)"
            placeholder="Explain the business rationale for this discount…"
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
            <p className="text-sm text-danger">{submitError}</p>
          )}
        </div>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={() => router.push(`/rep/deals/${deal.id}`)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || lines.length === 0}>
            {isPending ? "Submitting…" : "Submit for approval"}
          </Button>
        </div>
      </div>
    </div>
  );
}
