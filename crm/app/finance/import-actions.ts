"use server";

// CSV target import (Finance). One write path: each parsed row upserts a
// quarterly target via the existing setTarget mutation, then we revalidate so
// the gap-to-target band, gauge and grid pick the new numbers up immediately.
// Validation is repeated server-side — never trust the client's parse.

import { revalidatePath } from "next/cache";
import { setTarget } from "@/lib/db/mutations";

export interface TargetRow {
  period: string;
  amountEur: number;
}

export interface ImportResult {
  imported: number;
  failed: { period: string; error: string }[];
}

const PERIOD_RE = /^\d{4}-Q[1-4]$/;

/** Upsert a batch of quarterly targets parsed from CSV. */
export async function importTargetsAction(rows: TargetRow[]): Promise<ImportResult> {
  const failed: { period: string; error: string }[] = [];
  let imported = 0;

  for (const row of rows) {
    const period = (row.period ?? "").trim().toUpperCase();
    const amount = Number(row.amountEur);
    if (!PERIOD_RE.test(period)) {
      failed.push({ period: row.period?.trim() || "(blank)", error: "period must be YYYY-Qn" });
      continue;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      failed.push({ period, error: "amount must be a non-negative number" });
      continue;
    }
    try {
      await setTarget(period, Math.round(amount));
      imported += 1;
    } catch (e) {
      failed.push({ period, error: e instanceof Error ? e.message : "write failed" });
    }
  }

  if (imported > 0) revalidatePath("/finance");
  return { imported, failed };
}
