// Domain model for the HMD Secure CRM.
// This is the shared contract between the frontend (Joonatan) and the backend
// (Arttu). The frontend renders against `lib/api.ts`, which currently returns
// mock data shaped exactly like these types. When Arttu's Azure API is ready,
// only `lib/api.ts` changes — components stay the same.

export type Role = "rep" | "tam" | "sm" | "finance";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** Initials for avatar fallback. */
  initials: string;
}

// --- Accounts & contacts ---------------------------------------------------

export type Industry =
  | "Government"
  | "Defense"
  | "Healthcare"
  | "Finance"
  | "Energy"
  | "Enterprise";

export type Channel = "direct" | "reseller";

export interface Account {
  id: string;
  name: string;
  industry: Industry;
  /** ISO country code / region label, e.g. "DACH", "Nordics". */
  region: string;
  channel: Channel;
  /** User id of the owning sales rep. */
  ownerId: string;
  /** User id of the assigned TAM, if any. */
  tamId?: string;
  website?: string;
  /** Short note shown on the account header. */
  summary?: string;
}

export interface Contact {
  id: string;
  accountId: string;
  name: string;
  title: string;
  email: string;
  phone?: string;
  /** Primary decision-maker on the account. */
  primary?: boolean;
}

// --- Deals & forecast ------------------------------------------------------

// HMD pipeline stages. Reseller deals skip "contract_negotiation".
export type Stage =
  | "interest"
  | "rfi"
  | "rfp"
  | "customer_test"
  | "contract_negotiation"
  | "won"
  | "lost";

export const STAGE_ORDER: Stage[] = [
  "interest",
  "rfi",
  "rfp",
  "customer_test",
  "contract_negotiation",
  "won",
  "lost",
];

export const STAGE_LABELS: Record<Stage, string> = {
  interest: "Interest shown",
  rfi: "RFI answered",
  rfp: "RFP / offer given",
  customer_test: "Customer test",
  contract_negotiation: "Contract negotiation",
  won: "Won",
  lost: "Lost",
};

// Default win probability per stage (the open question to HMD — placeholder
// until they confirm their own weighting). Used for the weighted forecast.
export const STAGE_PROBABILITY: Record<Stage, number> = {
  interest: 0.1,
  rfi: 0.25,
  rfp: 0.4,
  customer_test: 0.6,
  contract_negotiation: 0.8,
  won: 1,
  lost: 0,
};

/** The win probability to weight a deal by: the deal's own number when set,
 *  otherwise the stage default. Single source of truth for all weighting so the
 *  forecast, confidence and pipeline figures agree with the per-deal number. */
export function dealProbability(deal: Deal): number {
  return deal.winProbability ?? STAGE_PROBABILITY[deal.stage];
}

// A single quarter of the 3-year time-phased forecast.
export interface ForecastPoint {
  /** Year offset from deal start: 0, 1 or 2. */
  year: 0 | 1 | 2;
  /** Quarter within the year: 1-4. */
  quarter: 1 | 2 | 3 | 4;
  /** Expected device units rolled out in this quarter. */
  devices: number;
  /** Expected device revenue (€) in this quarter. */
  deviceRevenue: number;
  /** Expected service revenue (€) in this quarter, tracked separately. */
  serviceRevenue: number;
}

export type ServiceModel = "one_off" | "fixed_term" | "monthly_recurring";

export interface Deal {
  id: string;
  accountId: string;
  ownerId: string;
  name: string;
  stage: Stage;
  channel: Channel;
  /** Headline 3-year total contract value (€), derived from the forecast. */
  tcv: number;
  /** Per-quarter time-phased forecast over 3 years. */
  forecast: ForecastPoint[];
  /** Deal-specific win probability (0-1), when the rep has set one. Overrides
   *  the stage default for all weighting. Falls back to STAGE_PROBABILITY. */
  winProbability?: number;
  /** Service invoicing model in play on this deal. */
  serviceModel: ServiceModel;
  expectedCloseDate: string; // ISO date
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
  /** Original opportunity this follow-on order links back to. */
  parentDealId?: string;
}

// --- Cases (TAM territory, but reps open them from an account) --------------

export type CasePriority = "low" | "medium" | "high" | "urgent";
export type CaseStatus = "open" | "in_progress" | "escalated" | "resolved";

export interface Case {
  id: string;
  accountId: string;
  title: string;
  serviceId: string;
  priority: CasePriority;
  status: CaseStatus;
  assigneeId?: string;
  createdAt: string;
  slaDueDate?: string;
  escalatedToThirdParty?: boolean;
}

// --- Activity timeline -----------------------------------------------------

export type ActivityType =
  | "note"
  | "call"
  | "email"
  | "meeting"
  | "stage_change"
  | "offer_sent"
  | "case_opened";

export interface Activity {
  id: string;
  accountId: string;
  dealId?: string;
  type: ActivityType;
  /** User id who created the activity. */
  authorId: string;
  body: string;
  createdAt: string;
}

// --- Offers ----------------------------------------------------------------

export type OfferStatus =
  | "draft"
  | "pending_sm"
  | "pending_finance"
  | "approved"
  | "rejected";

export interface OfferLine {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discountPct: number;
}

export interface Offer {
  id: string;
  accountId: string;
  dealId: string;
  version: number;
  status: OfferStatus;
  lines: OfferLine[];
  total: number;
  /** Required when a discount is applied. */
  justification?: string;
  createdAt: string;
}

// --- Notifications (in-app only) -------------------------------------------

export interface AppNotification {
  id: string;
  userId: string;
  body: string;
  /** Deep link target within the app. */
  href?: string;
  read: boolean;
  createdAt: string;
}
