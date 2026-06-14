// Microsoft Graph integration seam — email-to-case + Outlook calendar.
//
// These two features (inbound email → case, "book a follow-up" in Outlook) are
// part of the FINAL Azure solution. The demo runs on Supabase (eu-north-1),
// which has no Azure/Graph wired — so we DON'T fake the integration. Instead
// this seam mirrors lib/ai/provider.ts exactly: a single place that knows
// whether Graph is configured, and typed functions that return an honest
// "not configured on this platform" result until Azure creds land. When they
// do, only this file changes — the call sites and UI stay the same.
import "server-only";

/** True once Microsoft Graph app credentials are present (Azure deploy only).
 *  On the Supabase demo these are unset, so every Graph call defers honestly. */
export function isGraphConfigured(): boolean {
  return Boolean(
    process.env.MS_GRAPH_TENANT_ID &&
      process.env.MS_GRAPH_CLIENT_ID &&
      process.env.MS_GRAPH_CLIENT_SECRET,
  );
}

/** A platform note shown wherever a Graph feature is deferred. */
export const GRAPH_DEFER_REASON =
  "Available on the Azure/Microsoft Graph deployment — not wired on the Supabase demo platform.";

export type GraphResult<T> =
  | { configured: true; data: T }
  | { configured: false; reason: string };

export interface InboundEmail {
  from: string;
  subject: string;
  body: string;
  accountId?: string;
}

export interface CreatedCaseRef {
  caseId: string;
}

/**
 * Create a CRM case from an inbound Outlook email (Graph webhook path).
 * Deferred on the demo platform — the human-approved "paste an inbound email"
 * affordance reuses the existing meeting→CRM gate as the demo stand-in.
 */
export async function createCaseFromEmail(
  _email: InboundEmail,
): Promise<GraphResult<CreatedCaseRef>> {
  if (!isGraphConfigured()) {
    return { configured: false, reason: GRAPH_DEFER_REASON };
  }
  // Azure-final path (Graph mail webhook → case) lands here. Intentionally not
  // implemented on the demo platform; the seam keeps the call site stable.
  throw new Error("createCaseFromEmail: Graph path not implemented on this build");
}

export interface FollowUpRequest {
  caseId: string;
  subject: string;
  /** ISO datetime for the proposed follow-up. */
  when: string;
}

export interface BookedEventRef {
  eventId: string;
  webLink: string;
}

/**
 * Book a follow-up in the TAM's Outlook calendar (Graph /events). Deferred on
 * the demo platform; the UI shows a disabled "Book follow-up" with a tooltip.
 */
export async function bookFollowUp(
  _req: FollowUpRequest,
): Promise<GraphResult<BookedEventRef>> {
  if (!isGraphConfigured()) {
    return { configured: false, reason: GRAPH_DEFER_REASON };
  }
  throw new Error("bookFollowUp: Graph path not implemented on this build");
}
