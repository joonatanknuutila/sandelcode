import { withOverride } from "@/lib/ai/confidence";
import { getDeal } from "@/lib/db";

// GET /api/confidence?dealId=d-1[&override=85]
// Per-opportunity confidence + reasoning. Optional Finance override (Stage 5)
// returns the effective number that should feed gap-to-target.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const dealId = url.searchParams.get("dealId");
  if (!dealId) return Response.json({ error: "dealId is required" }, { status: 400 });

  const deal = await getDeal(dealId);
  if (!deal) return Response.json({ error: "Unknown deal" }, { status: 404 });

  const overrideRaw = url.searchParams.get("override");
  const override = overrideRaw == null ? undefined : Number(overrideRaw);

  return Response.json({ dealId, ...withOverride(deal, override) });
}
