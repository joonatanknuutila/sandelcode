"use server";

import { revalidatePath } from "next/cache";
import {
  upsertProduct,
  UpsertProductInput,
  retireProduct,
  upsertService,
  UpsertServiceInput,
} from "@/lib/db/mutations";
import type { Tables } from "@/lib/types.db";

// ---------------------------------------------------------------------------
// Product actions
// ---------------------------------------------------------------------------

export async function upsertProductAction(
  input: UpsertProductInput,
): Promise<{ ok: true; data: Tables<"products"> } | { ok: false; error: string }> {
  try {
    const data = await upsertProduct(input);
    revalidatePath("/finance/catalog");
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function retireProductAction(
  productId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await retireProduct(productId);
    revalidatePath("/finance/catalog");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Re-activate a previously retired product. */
export async function reactivateProductAction(
  productId: string,
  current: UpsertProductInput,
): Promise<{ ok: true; data: Tables<"products"> } | { ok: false; error: string }> {
  try {
    const data = await upsertProduct({ ...current, id: productId, isActive: true });
    revalidatePath("/finance/catalog");
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ---------------------------------------------------------------------------
// Service actions
// ---------------------------------------------------------------------------

export async function upsertServiceAction(
  input: UpsertServiceInput,
): Promise<{ ok: true; data: Tables<"services"> } | { ok: false; error: string }> {
  try {
    const data = await upsertService(input);
    revalidatePath("/finance/catalog");
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Re-activate a previously retired service. */
export async function reactivateServiceAction(
  serviceId: string,
  current: UpsertServiceInput,
): Promise<{ ok: true; data: Tables<"services"> } | { ok: false; error: string }> {
  try {
    const data = await upsertService({ ...current, id: serviceId, isActive: true });
    revalidatePath("/finance/catalog");
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Retire a service (set is_active = false). */
export async function retireServiceAction(
  serviceId: string,
  current: UpsertServiceInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await upsertService({ ...current, id: serviceId, isActive: false });
    revalidatePath("/finance/catalog");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
