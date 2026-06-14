// Export datasets — the rows behind the two CSV exports Finance asked for.
//
// Deterministic and read-only: every figure is computed from the typed lib/db
// reads and the same pure helpers the on-screen views use (weightedValue,
// dealProbability, slaInfo, caseAgeDays), so an export always reconciles with
// what the manager/Finance sees. No AI anywhere on this path.
import "server-only";

import {
  getAccounts,
  getAllCases,
  getAllDeals,
  getAllServices,
  getUsers,
  weightedValue,
} from "@/lib/db";
import { STAGE_LABELS, dealProbability } from "@/lib/types";
import { quarterLabel } from "@/lib/format";
import { caseAgeDays, slaInfo } from "@/lib/tam";
import type { CsvValue } from "./csv";

export interface Dataset {
  columns: { key: string; label: string }[];
  rows: Record<string, CsvValue>[];
}

// The 12 quarter columns of the 3-year time-phased forecast. The `key` stays
// relative + stable (y1q1 … y3q4) so column ids never shift; the human label
// shows the actual calendar year (2026 Q1 … 2028 Q4).
const QUARTERS: { key: string; label: string; year: 0 | 1 | 2; quarter: 1 | 2 | 3 | 4 }[] =
  ([0, 1, 2] as const).flatMap((year) =>
    ([1, 2, 3, 4] as const).map((quarter) => ({
      key: `y${year + 1}q${quarter}`,
      label: `${quarterLabel(year, quarter)} (EUR)`,
      year,
      quarter,
    })),
  );

/** Pipeline / forecast export — one row per deal, with the per-quarter phased
 *  revenue spread across 12 columns. Manager/Finance scope (the whole book). */
export async function pipelineExport(): Promise<Dataset> {
  const [deals, accounts, users] = await Promise.all([
    getAllDeals(),
    getAccounts(),
    getUsers(),
  ]);
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const ownerById = new Map(users.map((u) => [u.id, u]));

  const columns = [
    { key: "deal", label: "Deal" },
    { key: "account", label: "Account" },
    { key: "owner", label: "Owner" },
    { key: "stage", label: "Stage" },
    { key: "channel", label: "Channel" },
    { key: "tcv", label: "TCV (EUR)" },
    { key: "weighted", label: "Weighted (EUR)" },
    { key: "winPct", label: "Win %" },
    { key: "expectedClose", label: "Expected close" },
    ...QUARTERS.map((q) => ({ key: q.key, label: q.label })),
  ];

  const rows = deals.map((d) => {
    const row: Record<string, CsvValue> = {
      deal: d.name,
      account: accountById.get(d.accountId)?.name ?? "Unknown account",
      owner: ownerById.get(d.ownerId)?.name ?? "Unassigned",
      stage: STAGE_LABELS[d.stage],
      channel: d.channel,
      tcv: Math.round(d.tcv),
      weighted: weightedValue(d),
      winPct: Math.round(dealProbability(d) * 100),
      expectedClose: d.expectedCloseDate?.slice(0, 10) ?? "",
    };
    for (const q of QUARTERS) {
      const p = d.forecast.find((f) => f.year === q.year && f.quarter === q.quarter);
      row[q.key] = p ? Math.round(p.deviceRevenue + p.serviceRevenue) : 0;
    }
    return row;
  });

  return { columns, rows };
}

/** Cases export — one row per case with the SLA state + age the TAM queue sorts
 *  on. Deterministic; mirrors the case row on screen. */
export async function casesExport(): Promise<Dataset> {
  const [cases, accounts, services] = await Promise.all([
    getAllCases(),
    getAccounts(),
    getAllServices(),
  ]);
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const serviceNameById = new Map(services.map((s) => [s.id, s.name]));

  const columns = [
    { key: "id", label: "Case ID" },
    { key: "title", label: "Title" },
    { key: "account", label: "Account" },
    { key: "service", label: "Service" },
    { key: "priority", label: "Priority" },
    { key: "status", label: "Status" },
    { key: "ageDays", label: "Age (days)" },
    { key: "sla", label: "SLA state" },
    { key: "escalated", label: "3rd-party escalated" },
  ];

  const rows = cases.map((c) => ({
    id: c.id,
    title: c.title,
    account: accountById.get(c.accountId)?.name ?? "Unknown account",
    service: serviceNameById.get(c.serviceId) ?? "—",
    priority: c.priority,
    status: c.status,
    ageDays: caseAgeDays(c),
    sla: slaInfo(c).state,
    escalated: c.escalatedToThirdParty ? "yes" : "no",
  }));

  return { columns, rows };
}
