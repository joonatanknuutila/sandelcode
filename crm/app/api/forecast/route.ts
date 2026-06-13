import { forecastNarrative } from "@/lib/ai/forecast";

// GET /api/forecast — figures + plain-English narrative for the Finance view.
// Read-only. The Finance owner can render { text, figures } as a banner.
export async function GET() {
  const result = await forecastNarrative();
  return Response.json(result);
}
