// Domain model for the HMD Secure CRM.
// The shared contract between the UI and the data layer. Components render
// against these types; `lib/db` (Supabase-backed) returns data shaped exactly
// like them via `lib/db/mappers`, so swapping the backing store never touches
// components.

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

// A summarised account row for the AccountList (any role's lens).
export interface AccountCard {
  account: Account;
  dealsCount: number;
  openCases: number;
  tcv: number;
  weighted: number;
  /** First few deal stages, for the badges on the card. */
  stages: Stage[];
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

// Plain-language stage labels for the rep-facing UI: same stages, no acronyms.
// Power roles (SM/Finance/TAM) keep STAGE_LABELS; only /rep/* opts into these.
export const REP_STAGE_LABELS: Record<Stage, string> = {
  interest: "Interested",
  rfi: "Answered questions",
  rfp: "Offer sent",
  customer_test: "Trying devices",
  contract_negotiation: "Agreeing terms",
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
  /** Customer-agreed device quantity. Undefined = no firm commitment yet — at
   *  early stages a deal needn't have one. Drives the "agreed to buy N" toggle. */
  committedQuantity?: number;
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
  /** ISO timestamp the case was resolved, if it has been. Drives throughput
   * and resolution-time metrics on the TAM dashboard. */
  resolvedAt?: string;
  escalatedToThirdParty?: boolean;
  thirdPartyReference?: string;
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
  itemType: "product" | "service";
  productId: string;
  serviceId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discountPct: number;
  invoicingModel?: "one_off" | "monthly_recurring" | "fixed_term";
  termYears?: number;
}

export interface Offer {
  id: string;
  accountId: string;
  dealId: string;
  title: string;
  version: number;
  status: OfferStatus;
  lines: OfferLine[];
  total: number;
  discountPct: number;
  /** Required when a discount is applied. */
  justification?: string;
  createdAt: string;
}

// --- Inbox (internal messaging, always context-attached) -------------------

// An internal message is NEVER standalone — it hangs off an account, deal or
// case (brief Block 4). Backed by the existing `notes` table (note_entity_type
// is exactly these three), so no new storage is needed.
export type ContextType = "account" | "deal" | "case";

export interface InboxMessage {
  id: string;
  contextType: ContextType;
  contextId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

// One conversation = one context (account/deal/case) plus everything said on it.
// A conversation may also carry a pending discount approval, which renders as a
// special message with approve/reject + a "SM → Finance → Locked" status bar.
export interface Conversation {
  contextType: ContextType;
  contextId: string;
  /** The account this conversation rolls up to (for filtering + the panel). */
  accountId: string;
  title: string;
  subtitle: string;
  lastMessageAt: string;
  lastSnippet: string;
  messageCount: number;
  participantIds: string[];
  pendingApproval?: {
    offerId: string;
    /** Which gate the offer is waiting on right now. */
    gate: "sm" | "finance";
    status: OfferStatus;
    discountPct: number;
    total: number;
    version: number;
    justification?: string;
    dealId: string;
  };
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
