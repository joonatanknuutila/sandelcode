// GET /api/export/pipeline — the pipeline/forecast CSV (Finance: "Export
// pipeline data to Excel"). Deterministic, no AI; manager/Finance scope.
import { pipelineExport } from "@/lib/export/datasets";
import { csvResponse, stampDate, toCsv } from "@/lib/export/csv";

export async function GET() {
  const { columns, rows } = await pipelineExport();
  const csv = toCsv(columns, rows);
  return csvResponse(csv, `hmd-pipeline-${stampDate()}.csv`);
}
