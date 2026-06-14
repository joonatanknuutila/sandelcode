// GET /api/export/cases — the cases CSV (id, account, service, priority,
// status, age, SLA state, escalated). Deterministic, no AI.
import { casesExport } from "@/lib/export/datasets";
import { csvResponse, stampDate, toCsv } from "@/lib/export/csv";

export async function GET() {
  const { columns, rows } = await casesExport();
  const csv = toCsv(columns, rows);
  return csvResponse(csv, `hmd-cases-${stampDate()}.csv`);
}
