// DB row -> UI type mappers.
//
// The live Postgres schema (lib/types.db.ts) and the UI contract (lib/types.ts)
// diverge on naming and enum values. This file is the single place that
// translates between them, so `lib/db/*` queries can return clean UI types and
// `app/**` never has to know the DB shape.
//
// Notable translations:
//   role:     sales_manager        -> sm
//   stage:    interest_shown       -> interest        (… _answered/_offer_given dropped)
//   priority: critical             -> urgent
//   status:   case "closed"        -> "resolved"      (UI has no closed)
//   offer:    pending_sm_approval  -> pending_sm, locked/sent -> approved
import type { Tables } from "@/lib/types.db";
import type {
  Account,
  Activity,
  ActivityType,
  AppNotification,
  Case,
  CasePriority,
  CaseStatus,
  Channel,
  Contact,
  Deal,
  ForecastPoint,
  Industry,
  Offer,
  OfferLine,
  OfferStatus,
  Role,
  ServiceModel,
  Stage,
  User,
} from "@/lib/types";
import type {
  CaseNote,
  Service,
  ServiceCategory,
  ServiceEvent,
  ServiceEventKind,
} from "@/lib/tam";

// --- enums -----------------------------------------------------------------

export function toRole(r: Tables<"profiles">["role"]): Role {
  return r === "sales_manager" ? "sm" : r;
}

/** UI role -> DB role (for writes / filtering profiles by role). */
export function fromRole(r: Role): Tables<"profiles">["role"] {
  return r === "sm" ? "sales_manager" : r;
}

const STAGE_MAP: Record<Tables<"deals">["stage"], Stage> = {
  interest_shown: "interest",
  rfi_answered: "rfi",
  rfp_offer_given: "rfp",
  customer_test: "customer_test",
  contract_negotiation: "contract_negotiation",
  won: "won",
  lost: "lost",
};
export function toStage(s: Tables<"deals">["stage"]): Stage {
  return STAGE_MAP[s];
}

/** UI stage -> DB stage (inverse of STAGE_MAP, for writes). */
const STAGE_TO_DB: Record<Stage, Tables<"deals">["stage"]> = {
  interest: "interest_shown",
  rfi: "rfi_answered",
  rfp: "rfp_offer_given",
  customer_test: "customer_test",
  contract_negotiation: "contract_negotiation",
  won: "won",
  lost: "lost",
};
export function stageToDb(s: Stage): Tables<"deals">["stage"] {
  return STAGE_TO_DB[s];
}

/** UI role -> DB role. Alias of `fromRole`, named for the write-side contract. */
export function roleToDb(r: Role): Tables<"profiles">["role"] {
  return fromRole(r);
}

export function toCasePriority(p: Tables<"cases">["priority"]): CasePriority {
  return p === "critical" ? "urgent" : p;
}

/** UI priority -> DB priority (urgent -> critical). */
export function priorityToDb(p: CasePriority): Tables<"cases">["priority"] {
  return p === "urgent" ? "critical" : p;
}

export function toCaseStatus(s: Tables<"cases">["status"]): CaseStatus {
  return s === "closed" ? "resolved" : s;
}

/** UI case status -> DB case status. The UI has no `closed`, so all four UI
 *  values map straight through; `resolved` stays `resolved` (not `closed`). */
export function caseStatusToDb(s: CaseStatus): Tables<"cases">["status"] {
  return s;
}

const OFFER_STATUS_MAP: Record<Tables<"offers">["status"], OfferStatus> = {
  draft: "draft",
  pending_sm_approval: "pending_sm",
  pending_finance_approval: "pending_finance",
  approved: "approved",
  rejected: "rejected",
  locked: "approved",
  sent: "approved",
};
export function toOfferStatus(s: Tables<"offers">["status"]): OfferStatus {
  return OFFER_STATUS_MAP[s];
}

/** UI offer status -> DB offer status. The DB has extra terminal states
 *  (`locked`/`sent`) the UI collapses into `approved`; on the write side a UI
 *  `approved` maps to the canonical DB `approved`. */
const OFFER_STATUS_TO_DB: Record<OfferStatus, Tables<"offers">["status"]> = {
  draft: "draft",
  pending_sm: "pending_sm_approval",
  pending_finance: "pending_finance_approval",
  approved: "approved",
  rejected: "rejected",
};
export function offerStatusToDb(s: OfferStatus): Tables<"offers">["status"] {
  return OFFER_STATUS_TO_DB[s];
}

const INDUSTRIES: Industry[] = [
  "Government",
  "Defense",
  "Healthcare",
  "Finance",
  "Energy",
  "Enterprise",
];
export function toIndustry(raw: string | null): Industry {
  if (!raw) return "Enterprise";
  const titled = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  return INDUSTRIES.includes(titled as Industry)
    ? (titled as Industry)
    : "Enterprise";
}

const ACTIVITY_TYPES: ActivityType[] = [
  "note",
  "call",
  "email",
  "meeting",
  "stage_change",
  "offer_sent",
  "case_opened",
];
export function toActivityType(eventType: string): ActivityType {
  const e = eventType.toLowerCase();
  if (ACTIVITY_TYPES.includes(e as ActivityType)) return e as ActivityType;
  if (e.includes("offer")) return "offer_sent";
  if (e.includes("case")) return "case_opened";
  if (e.includes("stage")) return "stage_change";
  return "note";
}

// --- helpers ---------------------------------------------------------------

export function initials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Quarter index (year*4 + q-1) of a date relative to a baseline date. */
function quarterIndex(date: Date): number {
  return date.getFullYear() * 4 + Math.floor(date.getMonth() / 3);
}

// --- row mappers -----------------------------------------------------------

export function mapUser(p: Tables<"profiles">): User {
  return {
    id: p.id,
    name: p.full_name,
    email: p.email,
    role: toRole(p.role),
    initials: initials(p.full_name),
  };
}

export function mapContact(c: Tables<"contacts">): Contact {
  return {
    id: c.id,
    accountId: c.account_id,
    name: `${c.first_name} ${c.last_name}`.trim(),
    title: c.job_title ?? "",
    email: c.email ?? "",
    phone: c.phone ?? undefined,
    primary: c.is_primary,
  };
}

/** Account; `channel` is derived from the account's deals by the query layer. */
export function mapAccount(
  a: Tables<"accounts">,
  channel: Channel = "direct",
): Account {
  return {
    id: a.id,
    name: a.name,
    industry: toIndustry(a.industry),
    region: a.country ?? "EU",
    channel,
    ownerId: a.assigned_rep_id ?? "",
    tamId: a.assigned_tam_id ?? undefined,
    website: a.website ?? undefined,
    summary: a.address ?? undefined,
  };
}

/** Forecast phases -> UI ForecastPoint[], with year/quarter relative to the
 *  earliest phase. deviceRevenue is units x phase price (falls back to the
 *  deal's device_unit_price). */
export function mapForecast(
  phases: Tables<"deal_forecast_phases">[],
  dealUnitPrice: number | null,
): ForecastPoint[] {
  if (phases.length === 0) return [];
  const sorted = [...phases].sort(
    (a, b) => +new Date(a.period_start) - +new Date(b.period_start),
  );
  const baseQ = quarterIndex(new Date(sorted[0].period_start));
  return sorted.map((p) => {
    // Clamp the quarter offset to the 12-quarter (3-year) horizon BEFORE
    // deriving year/quarter, so the two always agree. Clamping only `year`
    // while letting `quarter` cycle off the raw offset let an out-of-horizon
    // phase (offset ≥ 12, or a calendar gap) land on a wrong/duplicate slot
    // — e.g. offset 12 became year 2 Q1, colliding with offset 8.
    const offset = Math.min(11, Math.max(0, quarterIndex(new Date(p.period_start)) - baseQ));
    const year = Math.floor(offset / 4) as 0 | 1 | 2;
    const quarter = ((offset % 4) + 1) as 1 | 2 | 3 | 4;
    const price = p.device_unit_price ?? dealUnitPrice ?? 0;
    return {
      year,
      quarter,
      devices: p.device_units,
      deviceRevenue: Math.round(p.device_units * price),
      serviceRevenue: Math.round(p.service_revenue),
    };
  });
}

export function mapDeal(
  d: Tables<"deals">,
  phases: Tables<"deal_forecast_phases">[],
  serviceModel: ServiceModel = "monthly_recurring",
): Deal {
  const forecast = mapForecast(phases, d.device_unit_price);
  const tcv = forecast.reduce((s, p) => s + p.deviceRevenue + p.serviceRevenue, 0);
  return {
    id: d.id,
    accountId: d.account_id,
    ownerId: d.owner_id ?? "",
    name: d.title,
    stage: toStage(d.stage),
    channel: d.channel,
    tcv,
    forecast,
    winProbability: d.win_probability != null ? d.win_probability / 100 : undefined,
    serviceModel,
    expectedCloseDate: d.expected_close_date ?? "",
    createdAt: d.created_at,
    updatedAt: d.last_activity_at,
    parentDealId: d.parent_deal_id ?? undefined,
  };
}

export function mapCase(c: Tables<"cases">): Case {
  return {
    id: c.id,
    accountId: c.account_id,
    title: c.title,
    serviceId: c.service_id ?? "",
    priority: toCasePriority(c.priority),
    status: toCaseStatus(c.status),
    assigneeId: c.assigned_tam_id ?? undefined,
    createdAt: c.created_at,
    slaDueDate: c.sla_due_date ?? undefined,
    resolvedAt: c.resolved_at ?? undefined,
    escalatedToThirdParty: c.is_escalated_to_third_party,
  };
}

export function mapActivity(a: Tables<"activity_timeline">): Activity {
  return {
    id: a.id,
    accountId: a.account_id,
    dealId: a.entity_type === "deal" ? (a.entity_id ?? undefined) : undefined,
    type: toActivityType(a.event_type),
    authorId: a.actor_id ?? "",
    body: a.body ?? a.title,
    createdAt: a.created_at,
  };
}

export function mapOfferLine(li: Tables<"offer_line_items">): OfferLine {
  return {
    productId: li.product_id ?? li.service_id ?? li.id,
    name: li.description,
    quantity: li.quantity,
    unitPrice: Number(li.unit_price),
    discountPct: Number(li.discount_pct),
  };
}

export function mapOffer(
  o: Tables<"offers">,
  lines: Tables<"offer_line_items">[],
): Offer {
  return {
    id: o.id,
    accountId: o.account_id,
    dealId: o.deal_id ?? "",
    version: o.version,
    status: toOfferStatus(o.status),
    lines: lines.map(mapOfferLine),
    total: Number(o.total_discounted_value ?? o.total_list_value ?? 0),
    justification: o.discount_justification ?? undefined,
    createdAt: o.created_at,
  };
}

export function mapNotification(n: Tables<"notifications">): AppNotification {
  const href =
    n.entity_type && n.entity_id
      ? n.entity_type === "deal"
        ? `/rep/deals/${n.entity_id}`
        : n.entity_type === "account"
          ? `/rep/accounts/${n.entity_id}`
          : n.entity_type === "case"
            ? `/tam/cases/${n.entity_id}`
            : undefined
      : undefined;
  return {
    id: n.id,
    userId: n.user_id,
    body: n.body ?? n.title,
    href,
    read: n.is_read,
    createdAt: n.created_at,
  };
}

// --- TAM mappers -----------------------------------------------------------
// The TAM view (lib/tam) augments the base model with case notes, a service
// inventory and a unified service-history timeline. The DB has no per-account
// service inventory — `services` is the global catalog a case's service_id
// points at — so `accountId`/`since`/`status` are derived from what we have.

/** notes row (entity_type='case') -> TAM CaseNote. is_internal => visibility. */
export function mapCaseNote(n: Tables<"notes">): CaseNote {
  return {
    id: n.id,
    caseId: n.entity_id,
    authorId: n.author_id ?? "",
    visibility: n.is_internal ? "internal" : "working",
    body: n.content,
    createdAt: n.created_at,
  };
}

/** Catalog service -> TAM Service. The catalog is global, so accountId is "". */
export function mapTamService(s: Tables<"services">): Service {
  const category: ServiceCategory =
    s.service_type === "third_party" ? "support" : "mdm";
  return {
    id: s.id,
    accountId: "",
    name: s.name,
    category,
    status: s.is_active ? "active" : "retired",
    since: s.created_at.slice(0, 10),
  };
}

const SERVICE_EVENT_KINDS = new Set<ServiceEventKind>([
  "deployed",
  "upgrade",
  "maintenance",
  "incident",
  "config",
  "case_opened",
  "case_resolved",
  "escalation",
  "stage_change",
  "offer_sent",
  "call",
  "email",
  "meeting",
  "note",
]);

function toServiceEventKind(eventType: string): ServiceEventKind {
  const e = eventType.toLowerCase();
  return SERVICE_EVENT_KINDS.has(e as ServiceEventKind)
    ? (e as ServiceEventKind)
    : "note";
}

/** activity_timeline row -> ServiceEvent (the account's unified history). */
export function mapServiceEvent(a: Tables<"activity_timeline">): ServiceEvent {
  return {
    id: a.id,
    accountId: a.account_id,
    serviceId: undefined,
    caseId: a.entity_type === "case" ? (a.entity_id ?? undefined) : undefined,
    kind: toServiceEventKind(a.event_type),
    body: a.body ?? a.title,
    createdAt: a.created_at,
  };
}
