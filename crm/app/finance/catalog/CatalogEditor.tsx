"use client";

import { useState, useTransition } from "react";
import { Badge, Button, Input, Select, Textarea } from "@/components/ui";
import { Modal, toast } from "@/components/ui-client";
import type { Tables } from "@/lib/types.db";
import type { UpsertProductInput, UpsertServiceInput } from "@/lib/db/mutations";
import {
  upsertProductAction,
  retireProductAction,
  reactivateProductAction,
  upsertServiceAction,
  retireServiceAction,
  reactivateServiceAction,
} from "../catalog-actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Product = Tables<"products">;
type Service = Tables<"services">;

interface Props {
  products: Product[];
  services: Service[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function eur(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("fi-FI", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

const SERVICE_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "internal", label: "Internal" },
  { value: "third_party", label: "Third Party" },
];

const INVOICING_MODEL_OPTIONS: { value: string; label: string }[] = [
  { value: "one_off", label: "One-off" },
  { value: "fixed_term", label: "Fixed Term" },
  { value: "monthly_recurring", label: "Monthly Recurring" },
];

// ---------------------------------------------------------------------------
// Product form
// ---------------------------------------------------------------------------

interface ProductFormState {
  name: string;
  description: string;
  sku: string;
  unitPrice: string;
  currency: string;
  category: string;
}

function emptyProductForm(): ProductFormState {
  return { name: "", description: "", sku: "", unitPrice: "", currency: "EUR", category: "" };
}

function productToForm(p: Product): ProductFormState {
  return {
    name: p.name,
    description: p.description ?? "",
    sku: p.sku ?? "",
    unitPrice: String(p.unit_price ?? ""),
    currency: p.currency ?? "EUR",
    category: p.category ?? "",
  };
}

function formToProductInput(
  form: ProductFormState,
  id?: string,
  isActive?: boolean,
): UpsertProductInput {
  return {
    ...(id ? { id } : {}),
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    sku: form.sku.trim() || undefined,
    unitPrice: parseFloat(form.unitPrice) || 0,
    currency: form.currency || "EUR",
    category: form.category.trim() || undefined,
    isActive: isActive ?? true,
  };
}

// ---------------------------------------------------------------------------
// Service form
// ---------------------------------------------------------------------------

interface ServiceFormState {
  name: string;
  description: string;
  serviceType: string;
  invoicingModel: string;
  basePrice: string;
  currency: string;
  termYears: string;
  monthlyRate: string;
}

function emptyServiceForm(): ServiceFormState {
  return {
    name: "",
    description: "",
    serviceType: "internal",
    invoicingModel: "one_off",
    basePrice: "",
    currency: "EUR",
    termYears: "",
    monthlyRate: "",
  };
}

function serviceToForm(s: Service): ServiceFormState {
  return {
    name: s.name,
    description: s.description ?? "",
    serviceType: s.service_type ?? "internal",
    invoicingModel: s.invoicing_model ?? "one_off",
    basePrice: String(s.base_price ?? ""),
    currency: s.currency ?? "EUR",
    termYears: String(s.term_years ?? ""),
    monthlyRate: String(s.monthly_rate ?? ""),
  };
}

function formToServiceInput(
  form: ServiceFormState,
  id?: string,
  isActive?: boolean,
): UpsertServiceInput {
  return {
    ...(id ? { id } : {}),
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    serviceType: (form.serviceType || "internal") as Tables<"services">["service_type"],
    invoicingModel: (form.invoicingModel || "one_off") as Tables<"services">["invoicing_model"],
    basePrice: form.basePrice ? parseFloat(form.basePrice) : undefined,
    currency: form.currency || "EUR",
    termYears: form.termYears ? parseInt(form.termYears, 10) : undefined,
    monthlyRate: form.monthlyRate ? parseFloat(form.monthlyRate) : undefined,
    isActive: isActive ?? true,
  };
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge tone="green">Active</Badge>
  ) : (
    <Badge tone="red">Retired</Badge>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CatalogEditor({ products: initProducts, services: initServices }: Props) {
  // Local optimistic state (server revalidates; page refetch brings truth)
  const [products, setProducts] = useState<Product[]>(initProducts);
  const [services, setServices] = useState<Service[]>(initServices);
  const [, startTransition] = useTransition();

  // ------- Product modal state -------
  const [productModal, setProductModal] = useState<{
    open: boolean;
    editing: Product | null;
  }>({ open: false, editing: null });
  const [productForm, setProductForm] = useState<ProductFormState>(emptyProductForm());
  const [productErrors, setProductErrors] = useState<Partial<ProductFormState>>({});

  // ------- Service modal state -------
  const [serviceModal, setServiceModal] = useState<{
    open: boolean;
    editing: Service | null;
  }>({ open: false, editing: null });
  const [serviceForm, setServiceForm] = useState<ServiceFormState>(emptyServiceForm());

  // -----------------------------------------------------------------------
  // Product handlers
  // -----------------------------------------------------------------------

  function openAddProduct() {
    setProductForm(emptyProductForm());
    setProductErrors({});
    setProductModal({ open: true, editing: null });
  }

  function openEditProduct(p: Product) {
    setProductForm(productToForm(p));
    setProductErrors({});
    setProductModal({ open: true, editing: p });
  }

  function validateProduct(form: ProductFormState): Partial<ProductFormState> {
    const errs: Partial<ProductFormState> = {};
    if (!form.name.trim()) errs.name = "Name is required";
    if (!form.unitPrice || isNaN(parseFloat(form.unitPrice)))
      errs.unitPrice = "Valid price required";
    return errs;
  }

  function handleSaveProduct() {
    const errs = validateProduct(productForm);
    if (Object.keys(errs).length > 0) {
      setProductErrors(errs);
      return;
    }
    const editing = productModal.editing;
    const input = formToProductInput(productForm, editing?.id, editing?.is_active ?? true);
    setProductModal({ open: false, editing: null });
    startTransition(async () => {
      const res = await upsertProductAction(input);
      if (res.ok) {
        toast(editing ? "Product updated" : "Product created", { variant: "success" });
        setProducts((prev) =>
          editing
            ? prev.map((p) => (p.id === res.data.id ? res.data : p))
            : [res.data, ...prev],
        );
      } else {
        toast(res.error, { variant: "error" });
      }
    });
  }

  function handleRetireProduct(p: Product) {
    startTransition(async () => {
      const res = await retireProductAction(p.id);
      if (res.ok) {
        toast(`"${p.name}" retired`, { variant: "warning" });
        setProducts((prev) =>
          prev.map((x) => (x.id === p.id ? { ...x, is_active: false } : x)),
        );
      } else {
        toast(res.error, { variant: "error" });
      }
    });
  }

  function handleReactivateProduct(p: Product) {
    const input = formToProductInput(productToForm(p), p.id, true);
    startTransition(async () => {
      const res = await reactivateProductAction(p.id, input);
      if (res.ok) {
        toast(`"${p.name}" reactivated`, { variant: "success" });
        setProducts((prev) =>
          prev.map((x) => (x.id === p.id ? res.data : x)),
        );
      } else {
        toast(res.error, { variant: "error" });
      }
    });
  }

  // -----------------------------------------------------------------------
  // Service handlers
  // -----------------------------------------------------------------------

  function openAddService() {
    setServiceForm(emptyServiceForm());
    setServiceModal({ open: true, editing: null });
  }

  function openEditService(s: Service) {
    setServiceForm(serviceToForm(s));
    setServiceModal({ open: true, editing: s });
  }

  function handleSaveService() {
    const editing = serviceModal.editing;
    const input = formToServiceInput(serviceForm, editing?.id, editing?.is_active ?? true);
    setServiceModal({ open: false, editing: null });
    startTransition(async () => {
      const res = await upsertServiceAction(input);
      if (res.ok) {
        toast(editing ? "Service updated" : "Service created", { variant: "success" });
        setServices((prev) =>
          editing
            ? prev.map((s) => (s.id === res.data.id ? res.data : s))
            : [res.data, ...prev],
        );
      } else {
        toast(res.error, { variant: "error" });
      }
    });
  }

  function handleRetireService(s: Service) {
    const input = formToServiceInput(serviceToForm(s), s.id, false);
    startTransition(async () => {
      const res = await retireServiceAction(s.id, input);
      if (res.ok) {
        toast(`"${s.name}" retired`, { variant: "warning" });
        setServices((prev) =>
          prev.map((x) => (x.id === s.id ? { ...x, is_active: false } : x)),
        );
      } else {
        toast(res.error, { variant: "error" });
      }
    });
  }

  function handleReactivateService(s: Service) {
    const input = formToServiceInput(serviceToForm(s), s.id, true);
    startTransition(async () => {
      const res = await reactivateServiceAction(s.id, input);
      if (res.ok) {
        toast(`"${s.name}" reactivated`, { variant: "success" });
        setServices((prev) =>
          prev.map((x) => (x.id === s.id ? res.data : x)),
        );
      } else {
        toast(res.error, { variant: "error" });
      }
    });
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-10">
      {/* ---- Products Table ---- */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Products ({products.length})
          </h2>
          <Button variant="primary" onClick={openAddProduct}>
            + Add product
          </Button>
        </div>
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-background text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">SKU</th>
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 text-right font-medium">List price</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-4 py-2 font-medium">{p.name}</td>
                  <td className="px-4 py-2 text-muted">{p.sku ?? "—"}</td>
                  <td className="px-4 py-2 text-muted">{p.category ?? "—"}</td>
                  <td className="px-4 py-2 text-right font-mono">
                    <span style={{ color: "#e4ff00", textShadow: "0 0 6px #e4ff0060" }}>
                      {eur(p.unit_price)}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <ActiveBadge active={!!p.is_active} />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditProduct(p)}
                        className="text-xs text-hmd-teal-600 hover:underline"
                      >
                        Edit
                      </button>
                      {p.is_active ? (
                        <button
                          onClick={() => handleRetireProduct(p)}
                          className="text-xs text-danger hover:underline"
                        >
                          Retire
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReactivateProduct(p)}
                          className="text-xs text-success hover:underline"
                        >
                          Reactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted text-xs">
                    No products yet. Add one above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---- Services Table ---- */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Services ({services.length})
          </h2>
          <Button variant="primary" onClick={openAddService}>
            + Add service
          </Button>
        </div>
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="bg-background text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Invoicing</th>
                <th className="px-4 py-2 text-right font-medium">Base price</th>
                <th className="px-4 py-2 text-right font-medium">Monthly rate</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-4 py-2 font-medium">{s.name}</td>
                  <td className="px-4 py-2 text-muted capitalize">
                    {(s.service_type ?? "—").replace("_", " ")}
                  </td>
                  <td className="px-4 py-2 text-muted capitalize">
                    {(s.invoicing_model ?? "—").replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">
                    <span style={{ color: "#e4ff00", textShadow: "0 0 6px #e4ff0060" }}>
                      {eur(s.base_price)}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-muted">
                    {eur(s.monthly_rate)}
                  </td>
                  <td className="px-4 py-2">
                    <ActiveBadge active={!!s.is_active} />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditService(s)}
                        className="text-xs text-hmd-teal-600 hover:underline"
                      >
                        Edit
                      </button>
                      {s.is_active ? (
                        <button
                          onClick={() => handleRetireService(s)}
                          className="text-xs text-danger hover:underline"
                        >
                          Retire
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReactivateService(s)}
                          className="text-xs text-success hover:underline"
                        >
                          Reactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {services.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted text-xs">
                    No services yet. Add one above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---- Product Modal ---- */}
      <Modal
        open={productModal.open}
        onClose={() => setProductModal({ open: false, editing: null })}
        title={productModal.editing ? "Edit Product" : "Add Product"}
      >
        <div className="space-y-4">
          <Input
            label="Name *"
            value={productForm.name}
            onChange={(e) => setProductForm((f) => ({ ...f, name: e.target.value }))}
            error={productErrors.name}
            placeholder="e.g. HMD Secure Phone XL"
          />
          <Input
            label="SKU"
            value={productForm.sku}
            onChange={(e) => setProductForm((f) => ({ ...f, sku: e.target.value }))}
            placeholder="e.g. HMS-XL-001"
          />
          <Input
            label="Category"
            value={productForm.category}
            onChange={(e) => setProductForm((f) => ({ ...f, category: e.target.value }))}
            placeholder="e.g. Hardware"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="List price (€) *"
              type="number"
              min="0"
              step="0.01"
              value={productForm.unitPrice}
              onChange={(e) => setProductForm((f) => ({ ...f, unitPrice: e.target.value }))}
              error={productErrors.unitPrice}
              placeholder="0.00"
            />
            <Input
              label="Currency"
              value={productForm.currency}
              onChange={(e) => setProductForm((f) => ({ ...f, currency: e.target.value }))}
              placeholder="EUR"
            />
          </div>
          <Textarea
            label="Description"
            value={productForm.description}
            onChange={(e) => setProductForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Optional product description…"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              onClick={() => setProductModal({ open: false, editing: null })}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveProduct}>
              {productModal.editing ? "Save changes" : "Create product"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ---- Service Modal ---- */}
      <Modal
        open={serviceModal.open}
        onClose={() => setServiceModal({ open: false, editing: null })}
        title={serviceModal.editing ? "Edit Service" : "Add Service"}
      >
        <div className="space-y-4">
          <Input
            label="Name *"
            value={serviceForm.name}
            onChange={(e) => setServiceForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Managed Security Operations"
          />
          <Textarea
            label="Description"
            value={serviceForm.description}
            onChange={(e) => setServiceForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Optional service description…"
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Service type"
              options={SERVICE_TYPE_OPTIONS}
              value={serviceForm.serviceType}
              onChange={(e) => setServiceForm((f) => ({ ...f, serviceType: e.target.value }))}
            />
            <Select
              label="Invoicing model"
              options={INVOICING_MODEL_OPTIONS}
              value={serviceForm.invoicingModel}
              onChange={(e) =>
                setServiceForm((f) => ({ ...f, invoicingModel: e.target.value }))
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Base price (€)"
              type="number"
              min="0"
              step="0.01"
              value={serviceForm.basePrice}
              onChange={(e) => setServiceForm((f) => ({ ...f, basePrice: e.target.value }))}
              placeholder="0.00"
            />
            <Input
              label="Currency"
              value={serviceForm.currency}
              onChange={(e) => setServiceForm((f) => ({ ...f, currency: e.target.value }))}
              placeholder="EUR"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Monthly rate (€)"
              type="number"
              min="0"
              step="0.01"
              value={serviceForm.monthlyRate}
              onChange={(e) => setServiceForm((f) => ({ ...f, monthlyRate: e.target.value }))}
              placeholder="0.00"
            />
            <Input
              label="Term (years)"
              type="number"
              min="1"
              step="1"
              value={serviceForm.termYears}
              onChange={(e) => setServiceForm((f) => ({ ...f, termYears: e.target.value }))}
              placeholder="e.g. 3"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              onClick={() => setServiceModal({ open: false, editing: null })}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveService}>
              {serviceModal.editing ? "Save changes" : "Create service"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
