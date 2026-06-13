// Typed data-MUTATION layer (Supabase-backed) — SERVER ONLY.
//
// The write-side companion to `lib/db/index.ts`. Every function runs through the
// service-role admin client (`lib/supabase/admin.ts`) so demo writes succeed
// while real auth is stubbed — see that file for the production (Entra ID) swap.
//
// Functions accept/return the UI types in `lib/types.ts` (+ `lib/tam.ts`); the
// UI<->DB translation goes through the inverse mappers in `./mappers`. Call these
// from Server Actions and pair them with `revalidatePath()`.
//
// `actor_id`/`author_id`/`created_by`/`set_by` default to the current demo user
// (getCurrentUser) when the caller doesn't pass one.
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/db";
import {
  caseStatusToDb,
  mapActivity,
  mapCase,
  mapCaseNote,
  mapDeal,
  mapNotification,
  mapOffer,
  offerStatusToDb,
  priorityToDb,
  stageToDb,
} from "./mappers";
import type {
  Activity,
  ActivityType,
  AppNotification,
  Case,
  CasePriority,
  CaseStatus,
  Channel,
  Deal,
  OfferLine,
  OfferStatus,
  Role,
  Stage,
} from "@/lib/types";
import type { CaseNote } from "@/lib/tam";
import type { Tables, TablesInsert } from "@/lib/types.db";

// --- shared helpers ---------------------------------------------------------

type Admin = ReturnType<typeof createAdminClient>;

/** Resolve the actor id: the explicit one, else the current demo user. */
async function actorId(explicit?: string): Promise<string | undefined> {
  if (explicit) return explicit;
  return (await getCurrentUser())?.id;
}

/** Fetch a deal + its forecast phases and map to the UI Deal. */
async function loadDeal(admin: Admin, dealId: string): Promise<Deal> {
  const { data, error } = await admin
    .from("deals")
    .select("*")
    .eq("id", dealId)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Deal not found");
  const { data: phases } = await admin
    .from("deal_forecast_phases")
    .select("*")
    .eq("deal_id", dealId);
  return mapDeal(data, phases ?? []);
}

/** Fetch an offer + its line items and map to the UI Offer. */
async function loadOffer(admin: Admin, offerId: string) {
  const { data, error } = await admin
    .from("offers")
    .select("*")
    .eq("id", offerId)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Offer not found");
  const { data: lines } = await admin
    .from("offer_line_items")
    .select("*")
    .eq("offer_id", offerId);
  return mapOffer(data, lines ?? []);
}

// --- deals ------------------------------------------------------------------

export interface CreateDealInput {
  accountId: string;
  title: string;
  ownerId?: string;
  channel?: Channel;
  stage?: Stage;
  expectedCloseDate?: string;
  deviceUnitPrice?: number;
  winProbability?: number; // 0..1 (UI) — persisted as 0..100
}

export async function createDeal(input: CreateDealInput): Promise<Deal> {
  const admin = createAdminClient();
  const owner = await actorId(input.ownerId);
  const row: TablesInsert<"deals"> = {
    account_id: input.accountId,
    title: input.title,
    owner_id: owner ?? null,
    channel: input.channel ?? "direct",
    stage: input.stage ? stageToDb(input.stage) : "interest_shown",
    expected_close_date: input.expectedCloseDate ?? null,
    device_unit_price: input.deviceUnitPrice ?? null,
    win_probability:
      input.winProbability != null
        ? Math.round(input.winProbability * 100)
        : null,
  };
  const { data, error } = await admin.from("deals").insert(row).select().single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create deal");
  return mapDeal(data, []);
}

export async function updateDealStage(
  dealId: string,
  stage: Stage,
): Promise<Deal> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("deals")
    .update({ stage: stageToDb(stage), last_activity_at: new Date().toISOString() })
    .eq("id", dealId);
  if (error) throw new Error(error.message);
  return loadDeal(admin, dealId);
}

export async function reassignDeal(
  dealId: string,
  newOwnerId: string,
): Promise<Deal> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("deals")
    .update({ owner_id: newOwnerId, last_activity_at: new Date().toISOString() })
    .eq("id", dealId);
  if (error) throw new Error(error.message);
  return loadDeal(admin, dealId);
}

// --- forecast phases --------------------------------------------------------

export interface ForecastPhaseInput {
  periodStart: string; // ISO date (YYYY-MM-DD)
  periodLabel: string; // 'YYYY-Qn'
  deviceUnits: number;
  deviceUnitPrice?: number;
  serviceRevenue?: number;
}

/** Replace a deal's forecast phases with the supplied set (delete-then-insert). */
export async function setForecastPhases(
  dealId: string,
  phases: ForecastPhaseInput[],
): Promise<void> {
  const admin = createAdminClient();
  const { error: delErr } = await admin
    .from("deal_forecast_phases")
    .delete()
    .eq("deal_id", dealId);
  if (delErr) throw new Error(delErr.message);
  if (phases.length === 0) return;
  const rows: TablesInsert<"deal_forecast_phases">[] = phases.map((p) => ({
    deal_id: dealId,
    period_start: p.periodStart,
    period_label: p.periodLabel,
    device_units: p.deviceUnits,
    device_unit_price: p.deviceUnitPrice ?? null,
    service_revenue: p.serviceRevenue ?? 0,
  }));
  const { error } = await admin.from("deal_forecast_phases").insert(rows);
  if (error) throw new Error(error.message);
}

// --- activity timeline ------------------------------------------------------

export interface LogActivityInput {
  accountId: string;
  eventType: ActivityType | string;
  title: string;
  body?: string;
  entityType?: Tables<"activity_timeline">["entity_type"];
  entityId?: string;
  actorId?: string;
  metadata?: Tables<"activity_timeline">["metadata"];
}

export async function logActivity(input: LogActivityInput): Promise<Activity> {
  const admin = createAdminClient();
  const actor = await actorId(input.actorId);
  const row: TablesInsert<"activity_timeline"> = {
    account_id: input.accountId,
    event_type: input.eventType,
    title: input.title,
    body: input.body ?? null,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    actor_id: actor ?? null,
    metadata: input.metadata ?? null,
  };
  const { data, error } = await admin
    .from("activity_timeline")
    .insert(row)
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to log activity");
  return mapActivity(data);
}

// --- cases ------------------------------------------------------------------

export interface CreateCaseInput {
  accountId: string;
  title: string;
  description?: string;
  serviceId?: string;
  contactId?: string;
  assigneeId?: string;
  priority?: CasePriority;
  status?: CaseStatus;
  slaDueDate?: string;
}

export async function createCase(input: CreateCaseInput): Promise<Case> {
  const admin = createAdminClient();
  const assignee = input.assigneeId ?? (await actorId());
  const row: TablesInsert<"cases"> = {
    account_id: input.accountId,
    title: input.title,
    description: input.description ?? null,
    service_id: input.serviceId ?? null,
    contact_id: input.contactId ?? null,
    assigned_tam_id: assignee ?? null,
    priority: input.priority ? priorityToDb(input.priority) : "medium",
    status: input.status ? caseStatusToDb(input.status) : "open",
    sla_due_date: input.slaDueDate ?? null,
  };
  const { data, error } = await admin.from("cases").insert(row).select().single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create case");
  return mapCase(data);
}

export async function updateCaseStatus(
  caseId: string,
  status: CaseStatus,
): Promise<Case> {
  const admin = createAdminClient();
  const update: {
    status: Tables<"cases">["status"];
    resolved_at?: string;
  } = { status: caseStatusToDb(status) };
  if (status === "resolved") update.resolved_at = new Date().toISOString();
  const { data, error } = await admin
    .from("cases")
    .update(update)
    .eq("id", caseId)
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to update case");
  return mapCase(data);
}

export async function escalateCase(
  caseId: string,
  thirdPartyReference?: string,
): Promise<Case> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("cases")
    .update({
      status: "escalated",
      is_escalated_to_third_party: true,
      third_party_reference: thirdPartyReference ?? null,
    })
    .eq("id", caseId)
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to escalate case");
  return mapCase(data);
}

export async function reassignCase(
  caseId: string,
  newTamId: string,
): Promise<Case> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("cases")
    .update({ assigned_tam_id: newTamId })
    .eq("id", caseId)
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to reassign case");
  return mapCase(data);
}

// --- case notes -------------------------------------------------------------

export interface AddCaseNoteInput {
  caseId: string;
  content: string;
  isInternal?: boolean;
  authorId?: string;
}

export async function addCaseNote(input: AddCaseNoteInput): Promise<CaseNote> {
  const admin = createAdminClient();
  const author = await actorId(input.authorId);
  const row: TablesInsert<"notes"> = {
    entity_type: "case",
    entity_id: input.caseId,
    content: input.content,
    is_internal: input.isInternal ?? true,
    author_id: author ?? null,
  };
  const { data, error } = await admin.from("notes").insert(row).select().single();
  if (error || !data) throw new Error(error?.message ?? "Failed to add note");
  return mapCaseNote(data);
}

// --- offers -----------------------------------------------------------------

export interface CreateOfferInput {
  accountId: string;
  title: string;
  dealId?: string;
  version?: number;
  discountPct?: number;
  discountJustification?: string;
  createdBy?: string;
}

export async function createOffer(input: CreateOfferInput) {
  const admin = createAdminClient();
  const creator = await actorId(input.createdBy);
  const row: TablesInsert<"offers"> = {
    account_id: input.accountId,
    title: input.title,
    deal_id: input.dealId ?? null,
    version: input.version ?? 1,
    discount_pct: input.discountPct ?? 0,
    discount_justification: input.discountJustification ?? null,
    created_by: creator ?? null,
    status: "draft",
  };
  const { data, error } = await admin.from("offers").insert(row).select().single();
  if (error || !data) throw new Error(error?.message ?? "Failed to create offer");
  return mapOffer(data, []);
}

export interface OfferLineInput {
  itemType: "product" | "service";
  description: string;
  quantity: number;
  unitPrice: number;
  discountPct?: number;
  productId?: string;
  serviceId?: string;
  invoicingModel?: Tables<"offer_line_items">["invoicing_model"];
  termYears?: number;
}

/** Replace an offer's line items, then recompute & persist the offer totals. */
export async function setOfferLines(offerId: string, lines: OfferLineInput[]) {
  const admin = createAdminClient();
  const { error: delErr } = await admin
    .from("offer_line_items")
    .delete()
    .eq("offer_id", offerId);
  if (delErr) throw new Error(delErr.message);

  if (lines.length > 0) {
    const rows: TablesInsert<"offer_line_items">[] = lines.map((l) => ({
      offer_id: offerId,
      item_type: l.itemType,
      description: l.description,
      quantity: l.quantity,
      unit_price: l.unitPrice,
      discount_pct: l.discountPct ?? 0,
      product_id: l.productId ?? null,
      service_id: l.serviceId ?? null,
      invoicing_model: l.invoicingModel ?? null,
      term_years: l.termYears ?? null,
    }));
    const { error } = await admin.from("offer_line_items").insert(rows);
    if (error) throw new Error(error.message);
  }

  // Recompute totals from the supplied lines (list = qty×price; discounted
  // applies each line's own discount_pct).
  const totalList = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const totalDiscounted = lines.reduce(
    (s, l) => s + l.quantity * l.unitPrice * (1 - (l.discountPct ?? 0) / 100),
    0,
  );
  const { error: upErr } = await admin
    .from("offers")
    .update({
      total_list_value: totalList,
      total_discounted_value: totalDiscounted,
    })
    .eq("id", offerId);
  if (upErr) throw new Error(upErr.message);

  return loadOffer(admin, offerId);
}

export async function submitOffer(
  offerId: string,
  targetStatus: "pending_sm" | "pending_finance",
) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("offers")
    .update({ status: offerStatusToDb(targetStatus) })
    .eq("id", offerId);
  if (error) throw new Error(error.message);
  return loadOffer(admin, offerId);
}

export interface RecordApprovalInput {
  offerId: string;
  role: Extract<Role, "sm" | "finance">;
  decision: "approved" | "rejected";
  comment?: string;
  approverId?: string;
}

/** Record an approval and advance the offer through its gates.
 *  rejected -> rejected; SM approve & discount>10% -> pending_finance; SM approve
 *  & discount<=10% -> approved; Finance approve -> approved + locked_at=now(). */
export async function recordApproval(input: RecordApprovalInput) {
  const admin = createAdminClient();
  const approver = await actorId(input.approverId);
  const approvalRole: Tables<"offer_approvals">["approval_role"] =
    input.role === "sm" ? "sales_manager" : "finance";

  const { error: insErr } = await admin.from("offer_approvals").insert({
    offer_id: input.offerId,
    approver_id: approver ?? null,
    approval_role: approvalRole,
    status: input.decision,
    comment: input.comment ?? null,
    resolved_at: new Date().toISOString(),
  });
  if (insErr) throw new Error(insErr.message);

  // Need the offer's discount to decide the next status.
  const { data: offer, error: offErr } = await admin
    .from("offers")
    .select("discount_pct")
    .eq("id", input.offerId)
    .single();
  if (offErr || !offer) throw new Error(offErr?.message ?? "Offer not found");

  const update: Partial<Tables<"offers">> = {};
  if (input.decision === "rejected") {
    update.status = "rejected";
  } else if (input.role === "sm") {
    update.status =
      Number(offer.discount_pct) > 10 ? "pending_finance_approval" : "approved";
  } else {
    update.status = "approved";
    update.locked_at = new Date().toISOString();
  }

  const { error: upErr } = await admin
    .from("offers")
    .update(update)
    .eq("id", input.offerId);
  if (upErr) throw new Error(upErr.message);

  return loadOffer(admin, input.offerId);
}

// --- confidence override (Finance) -----------------------------------------

export interface ConfidenceOverrideInput {
  dealId: string;
  value: number; // 0..100
  reason?: string;
  setBy?: string;
}

export async function saveConfidenceOverride(
  input: ConfidenceOverrideInput,
): Promise<void> {
  const admin = createAdminClient();
  const setBy = await actorId(input.setBy);
  const { error } = await admin.from("deal_confidence_overrides").upsert(
    {
      deal_id: input.dealId,
      value: input.value,
      reason: input.reason ?? null,
      set_by: setBy ?? null,
      set_at: new Date().toISOString(),
    },
    { onConflict: "deal_id" },
  );
  if (error) throw new Error(error.message);
}

// --- catalog ----------------------------------------------------------------

export interface UpsertProductInput {
  id?: string;
  name: string;
  description?: string;
  sku?: string;
  unitPrice: number;
  currency?: string;
  category?: string;
  isActive?: boolean;
}

export async function upsertProduct(
  input: UpsertProductInput,
): Promise<Tables<"products">> {
  const admin = createAdminClient();
  const row: TablesInsert<"products"> = {
    name: input.name,
    description: input.description ?? null,
    sku: input.sku ?? null,
    unit_price: input.unitPrice,
    category: input.category ?? null,
    is_active: input.isActive ?? true,
    ...(input.id ? { id: input.id } : {}),
    ...(input.currency ? { currency: input.currency } : {}),
  };
  const { data, error } = await admin
    .from("products")
    .upsert(row)
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to upsert product");
  return data;
}

export async function retireProduct(productId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("products")
    .update({ is_active: false })
    .eq("id", productId);
  if (error) throw new Error(error.message);
}

export interface UpsertServiceInput {
  id?: string;
  name: string;
  description?: string;
  serviceType?: Tables<"services">["service_type"];
  invoicingModel: Tables<"services">["invoicing_model"];
  basePrice?: number;
  currency?: string;
  termYears?: number;
  monthlyRate?: number;
  isActive?: boolean;
}

export async function upsertService(
  input: UpsertServiceInput,
): Promise<Tables<"services">> {
  const admin = createAdminClient();
  const row: TablesInsert<"services"> = {
    name: input.name,
    description: input.description ?? null,
    service_type: input.serviceType ?? "internal",
    invoicing_model: input.invoicingModel,
    base_price: input.basePrice ?? null,
    term_years: input.termYears ?? null,
    monthly_rate: input.monthlyRate ?? null,
    is_active: input.isActive ?? true,
    ...(input.id ? { id: input.id } : {}),
    ...(input.currency ? { currency: input.currency } : {}),
  };
  const { data, error } = await admin
    .from("services")
    .upsert(row)
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to upsert service");
  return data;
}

// --- notifications ----------------------------------------------------------

export interface CreateNotificationInput {
  userId: string;
  title: string;
  body?: string;
  entityType?: Tables<"notifications">["entity_type"];
  entityId?: string;
}

export async function createNotification(
  input: CreateNotificationInput,
): Promise<AppNotification> {
  const admin = createAdminClient();
  const row: TablesInsert<"notifications"> = {
    user_id: input.userId,
    title: input.title,
    body: input.body ?? null,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
  };
  const { data, error } = await admin
    .from("notifications")
    .insert(row)
    .select()
    .single();
  if (error || !data)
    throw new Error(error?.message ?? "Failed to create notification");
  return mapNotification(data);
}

export async function markNotificationRead(id: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// --- forecast targets (Finance) ---------------------------------------------

/** UPSERT a quarterly revenue target. Read side lives in lib/db/index.ts. */
export async function setTarget(
  period: string,
  amountEur: number,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("forecast_targets").upsert(
    {
      period,
      amount_eur: amountEur,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "period" },
  );
  if (error) throw new Error(error.message);
}

// --- meeting commit (the single write path for meeting capture) -------------
// Replaces the session-array stub in lib/ai/meeting.ts. Inserts EXACTLY the
// approved changes: notes become `notes` rows, everything else becomes an
// `activity_timeline` entry. The human-approval gate stays at the call site.

export interface MeetingChangeInput {
  type: "note" | "follow_up" | "contact" | "stage_move" | "case";
  label: string;
  detail: string;
}

export interface CommitMeetingInput {
  accountId: string;
  changes: MeetingChangeInput[];
  /** Optional deal to attach activity entries to. */
  dealId?: string;
  actorId?: string;
}

export interface CommitMeetingResult {
  activities: Activity[];
  notes: CaseNote[];
}

export async function commitMeeting(
  input: CommitMeetingInput,
): Promise<CommitMeetingResult> {
  const admin = createAdminClient();
  const actor = await actorId(input.actorId);
  const activities: Activity[] = [];
  const notes: CaseNote[] = [];

  for (const change of input.changes) {
    if (change.type === "note") {
      // A plain meeting note -> activity_timeline (account-level note event).
      const { data, error } = await admin
        .from("activity_timeline")
        .insert({
          account_id: input.accountId,
          event_type: "meeting",
          title: change.label,
          body: change.detail,
          entity_type: input.dealId ? "deal" : "account",
          entity_id: input.dealId ?? input.accountId,
          actor_id: actor ?? null,
        })
        .select()
        .single();
      if (error || !data) throw new Error(error?.message ?? "commit failed");
      activities.push(mapActivity(data));
    } else {
      // follow_up / contact / stage_move / case -> timeline entry capturing the
      // committed change (the human-approved record of what was agreed).
      const { data, error } = await admin
        .from("activity_timeline")
        .insert({
          account_id: input.accountId,
          event_type: change.type,
          title: change.label,
          body: change.detail,
          entity_type: input.dealId ? "deal" : "account",
          entity_id: input.dealId ?? input.accountId,
          actor_id: actor ?? null,
        })
        .select()
        .single();
      if (error || !data) throw new Error(error?.message ?? "commit failed");
      activities.push(mapActivity(data));
    }
  }

  return { activities, notes };
}
