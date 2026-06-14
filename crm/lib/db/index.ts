// Typed data-access layer (Supabase-backed) — the ONE source of read data.
//
// Every function is async (it hits Postgres) and returns the UI types the
// components use (`lib/types.ts`) — the DB->UI translation happens in
// `./mappers`. Read from a Server Component: `await` the call. There is no mock
// layer; all views render against live Supabase data.
//
// Auth target: Supabase Auth for the demo; Azure Entra ID is the production
// target (swap the client in lib/supabase/* — query layer is unaffected).
import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  mapAccount,
  mapActivity,
  mapCase,
  mapCaseNote,
  mapContact,
  mapDeal,
  mapNotification,
  mapOffer,
  mapServiceEvent,
  mapTamService,
  mapUser,
  roleToDb,
} from "./mappers";
import {
  Account,
  AccountCard,
  Activity,
  AppNotification,
  Case,
  Channel,
  Contact,
  Deal,
  dealProbability,
  Offer,
  OfferStatus,
  User,
} from "@/lib/types";
import type { Tables } from "@/lib/types.db";
import type { CaseNote, Service, ServiceEvent } from "@/lib/tam";
import { relativeDays } from "@/lib/format";
import { STALE_DAYS } from "@/lib/scoring";

// --- users -----------------------------------------------------------------

/** The signed-in user's profile. Falls back to the first rep so the demo
 *  renders before a login page exists. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (authUser) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authUser.id)
      .maybeSingle();
    if (data) return mapUser(data);
  }

  // Demo fallback: first rep.
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "rep")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  return data ? mapUser(data) : null;
});

/** Current user for a role-scoped demo surface. Matching real auth wins; demo
 *  mode falls back to the first user with the requested role so server-rendered
 *  role pages match the client nav. */
export async function getCurrentUserForRole(role: User["role"]): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (authUser) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authUser.id)
      .maybeSingle();
    if (data) {
      const mapped = mapUser(data);
      if (mapped.role === role) return mapped;
    }
  }

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", roleToDb(role))
    .order("created_at")
    .limit(1)
    .maybeSingle();
  return data ? mapUser(data) : null;
}

export async function getUser(id: string): Promise<User | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ? mapUser(data) : null;
}

export const getUsers = cache(async (): Promise<User[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").order("full_name");
  return (data ?? []).map(mapUser);
});

// --- accounts & contacts ---------------------------------------------------

/** Build a accountId -> channel map from the deals belonging to those accounts. */
async function channelByAccount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  accountIds: string[],
): Promise<Map<string, Channel>> {
  const map = new Map<string, Channel>();
  if (accountIds.length === 0) return map;
  const { data } = await supabase
    .from("deals")
    .select("account_id, channel")
    .in("account_id", accountIds);
  for (const row of data ?? []) {
    if (!map.has(row.account_id)) map.set(row.account_id, row.channel);
  }
  return map;
}

export async function getAccountsForRep(repId: string): Promise<Account[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("accounts")
    .select("*")
    .eq("assigned_rep_id", repId)
    .order("name");
  const accounts = data ?? [];
  const channels = await channelByAccount(
    supabase,
    accounts.map((a) => a.id),
  );
  return accounts.map((a) => mapAccount(a, channels.get(a.id) ?? "direct"));
}

export async function getAccount(id: string): Promise<Account | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("accounts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const channels = await channelByAccount(supabase, [id]);
  return mapAccount(data, channels.get(id) ?? "direct");
}

/** Every account (Sales Manager / Finance lenses build id->account maps). */
export const getAccounts = cache(async (): Promise<Account[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("accounts").select("*").order("name");
  const accounts = data ?? [];
  const channels = await channelByAccount(
    supabase,
    accounts.map((a) => a.id),
  );
  return accounts.map((a) => mapAccount(a, channels.get(a.id) ?? "direct"));
});

/** Accounts a TAM is connected to — i.e. where they have at least one case
 *  (brief Block 2: "tam sees accounts where they have cases"). */
export async function getAccountsForTam(tamId: string): Promise<Account[]> {
  const cases = await getCasesForTam(tamId);
  const ids = new Set(cases.map((c) => c.accountId));
  if (ids.size === 0) return [];
  return (await getAccounts()).filter((a) => ids.has(a.id));
}

/** Summarise a set of accounts (deal counts, open cases, TCV, weighted) for the
 *  AccountList — shared by every role's list view. */
export async function getAccountCards(
  accounts: Account[],
): Promise<AccountCard[]> {
  if (accounts.length === 0) return [];
  const supabase = await createClient();
  const ids = accounts.map((a) => a.id);
  // Two batched queries (+ one for phases inside assembleDeals) instead of ~3
  // per account — keeps the list at O(1) round-trips regardless of N.
  const [dealsRes, casesRes] = await Promise.all([
    supabase
      .from("deals")
      .select("*")
      .in("account_id", ids)
      .order("last_activity_at", { ascending: false }),
    supabase.from("cases").select("*").in("account_id", ids),
  ]);
  const deals = await assembleDeals(supabase, dealsRes.data ?? []);
  const cases = (casesRes.data ?? []).map(mapCase);

  const dealsByAccount = new Map<string, Deal[]>();
  for (const d of deals) {
    const arr = dealsByAccount.get(d.accountId) ?? [];
    arr.push(d);
    dealsByAccount.set(d.accountId, arr);
  }
  const casesByAccount = new Map<string, Case[]>();
  for (const c of cases) {
    const arr = casesByAccount.get(c.accountId) ?? [];
    arr.push(c);
    casesByAccount.set(c.accountId, arr);
  }

  return accounts.map((account) => {
    const accDeals = dealsByAccount.get(account.id) ?? [];
    const accCases = casesByAccount.get(account.id) ?? [];
    return {
      account,
      dealsCount: accDeals.length,
      openCases: accCases.filter((c) => c.status !== "resolved").length,
      tcv: accDeals.reduce((s, d) => s + d.tcv, 0),
      weighted: accDeals.reduce((s, d) => s + weightedValue(d), 0),
      stages: accDeals.slice(0, 3).map((d) => d.stage),
    };
  });
}

export interface AccountDetailData {
  account: Account;
  contacts: Contact[];
  deals: Deal[];
  cases: Case[];
  activities: Activity[];
  tam: User | null;
}

/** Everything the AccountDetail view needs, in one call (shared by all roles'
 *  account detail routes). */
export async function getAccountDetail(
  id: string,
): Promise<AccountDetailData | null> {
  const account = await getAccount(id);
  if (!account) return null;
  const [contacts, deals, cases, activities, tam] = await Promise.all([
    getContactsForAccount(id),
    getDealsForAccount(id),
    getCasesForAccount(id),
    getActivitiesForAccount(id),
    account.tamId ? getUser(account.tamId) : Promise.resolve(null),
  ]);
  return { account, contacts, deals, cases, activities, tam };
}

export async function getContactsForAccount(
  accountId: string,
): Promise<Contact[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contacts")
    .select("*")
    .eq("account_id", accountId)
    .order("is_primary", { ascending: false });
  return (data ?? []).map(mapContact);
}

// --- deals & forecast ------------------------------------------------------

/** Fetch forecast phases for a set of deals, grouped by deal_id. */
async function phasesByDeal(
  supabase: Awaited<ReturnType<typeof createClient>>,
  dealIds: string[],
): Promise<Map<string, Tables<"deal_forecast_phases">[]>> {
  const map = new Map<string, Tables<"deal_forecast_phases">[]>();
  if (dealIds.length === 0) return map;
  const { data } = await supabase
    .from("deal_forecast_phases")
    .select("*")
    .in("deal_id", dealIds);
  for (const row of data ?? []) {
    const arr = map.get(row.deal_id) ?? [];
    arr.push(row);
    map.set(row.deal_id, arr);
  }
  return map;
}

async function assembleDeals(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: Tables<"deals">[],
): Promise<Deal[]> {
  const phases = await phasesByDeal(
    supabase,
    rows.map((d) => d.id),
  );
  return rows.map((d) => mapDeal(d, phases.get(d.id) ?? []));
}

export async function getDealsForRep(repId: string): Promise<Deal[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("deals")
    .select("*")
    .eq("owner_id", repId)
    .order("last_activity_at", { ascending: false });
  return assembleDeals(supabase, data ?? []);
}

export async function getDealsForAccount(accountId: string): Promise<Deal[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("deals")
    .select("*")
    .eq("account_id", accountId)
    .order("last_activity_at", { ascending: false });
  return assembleDeals(supabase, data ?? []);
}

export async function getDeal(id: string): Promise<Deal | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("deals")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const phases = await phasesByDeal(supabase, [id]);
  return mapDeal(data, phases.get(id) ?? []);
}

/** Whole pipeline (Sales Manager / Finance views). */
export const getAllDeals = cache(async (): Promise<Deal[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("deals")
    .select("*")
    .order("last_activity_at", { ascending: false });
  return assembleDeals(supabase, data ?? []);
});

/** Open (non-terminal) deals across the whole team. */
export async function getOpenDeals(): Promise<Deal[]> {
  return (await getAllDeals()).filter(
    (d) => d.stage !== "won" && d.stage !== "lost",
  );
}

/** Won deals — committed, no longer probability-weighted. */
export async function getWonDeals(): Promise<Deal[]> {
  return (await getAllDeals()).filter((d) => d.stage === "won");
}

/** Lost deals — closed without a win (close-rate denominator). */
export async function getLostDeals(): Promise<Deal[]> {
  return (await getAllDeals()).filter((d) => d.stage === "lost");
}

// --- cases -----------------------------------------------------------------

export async function getCasesForAccount(accountId: string): Promise<Case[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cases")
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false });
  return (data ?? []).map(mapCase);
}

export async function getCasesForTam(tamId: string): Promise<Case[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cases")
    .select("*")
    .eq("assigned_tam_id", tamId)
    .order("created_at", { ascending: false });
  return (data ?? []).map(mapCase);
}

export async function getAllCases(): Promise<Case[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cases")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []).map(mapCase);
}

export async function getCase(id: string): Promise<Case | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cases")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ? mapCase(data) : null;
}

// --- case notes (TAM internal/working timeline) ----------------------------

/** A case's notes, newest-first. is_internal => internal vs working note. */
export async function getNotesForCase(caseId: string): Promise<CaseNote[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notes")
    .select("*")
    .eq("entity_type", "case")
    .eq("entity_id", caseId)
    .order("created_at", { ascending: false });
  return (data ?? []).map(mapCaseNote);
}

// --- activity timeline -----------------------------------------------------

export async function getActivitiesForAccount(
  accountId: string,
): Promise<Activity[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("activity_timeline")
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false });
  return (data ?? []).map(mapActivity);
}

export async function getActivitiesForDeal(dealId: string): Promise<Activity[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("activity_timeline")
    .select("*")
    .eq("entity_type", "deal")
    .eq("entity_id", dealId)
    .order("created_at", { ascending: false });
  return (data ?? []).map(mapActivity);
}

/** The account's whole history as one timeline (TAM case view), newest-first. */
export async function getServiceHistory(
  accountId: string,
): Promise<ServiceEvent[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("activity_timeline")
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false });
  return (data ?? []).map(mapServiceEvent);
}

/** A single case's own history, newest-first. This deliberately excludes deal
 *  and account events so the TAM case view never shows sales-stage movement or
 *  discount negotiation inside a technical case. */
export async function getCaseHistory(caseId: string): Promise<ServiceEvent[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("activity_timeline")
    .select("*")
    .eq("entity_type", "case")
    .eq("entity_id", caseId)
    .order("created_at", { ascending: false });
  return (data ?? []).map(mapServiceEvent);
}

// --- offers ----------------------------------------------------------------

export async function getOffersForDeal(dealId: string): Promise<Offer[]> {
  const supabase = await createClient();
  const { data: offers } = await supabase
    .from("offers")
    .select("*")
    .eq("deal_id", dealId)
    .order("version", { ascending: false });
  if (!offers || offers.length === 0) return [];

  const { data: items } = await supabase
    .from("offer_line_items")
    .select("*")
    .in(
      "offer_id",
      offers.map((o) => o.id),
    );
  const byOffer = new Map<string, Tables<"offer_line_items">[]>();
  for (const li of items ?? []) {
    const arr = byOffer.get(li.offer_id) ?? [];
    arr.push(li);
    byOffer.set(li.offer_id, arr);
  }
  return offers.map((o) => mapOffer(o, byOffer.get(o.id) ?? []));
}

export async function getOffersForAccount(accountId: string): Promise<Offer[]> {
  const supabase = await createClient();
  const { data: offers } = await supabase
    .from("offers")
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: false });
  if (!offers || offers.length === 0) return [];
  const { data: items } = await supabase
    .from("offer_line_items")
    .select("*")
    .in(
      "offer_id",
      offers.map((o) => o.id),
    );
  const byOffer = new Map<string, Tables<"offer_line_items">[]>();
  for (const li of items ?? []) {
    const arr = byOffer.get(li.offer_id) ?? [];
    arr.push(li);
    byOffer.set(li.offer_id, arr);
  }
  return offers.map((o) => mapOffer(o, byOffer.get(o.id) ?? []));
}

/** Every offer across all accounts, with line items (approval queues). */
export async function getAllOffers(): Promise<Offer[]> {
  const supabase = await createClient();
  const { data: offers } = await supabase
    .from("offers")
    .select("*")
    .order("created_at", { ascending: false });
  if (!offers || offers.length === 0) return [];
  const { data: items } = await supabase
    .from("offer_line_items")
    .select("*")
    .in(
      "offer_id",
      offers.map((o) => o.id),
    );
  const byOffer = new Map<string, Tables<"offer_line_items">[]>();
  for (const li of items ?? []) {
    const arr = byOffer.get(li.offer_id) ?? [];
    arr.push(li);
    byOffer.set(li.offer_id, arr);
  }
  return offers.map((o) => mapOffer(o, byOffer.get(o.id) ?? []));
}

/** Offers sitting at a given approval gate (e.g. pending_sm, pending_finance). */
export async function getOffersByStatus(
  status: OfferStatus,
): Promise<Offer[]> {
  return (await getAllOffers()).filter((o) => o.status === status);
}

// --- catalog ---------------------------------------------------------------

export async function getProducts(): Promise<Tables<"products">[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("unit_price", { ascending: false });
  return data ?? [];
}

/** All products including retired — for the catalog editor. */
export async function getAllProducts(): Promise<Tables<"products">[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select("*")
    .order("unit_price", { ascending: false });
  return data ?? [];
}

export async function getServices(): Promise<Tables<"services">[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("services")
    .select("*")
    .eq("is_active", true)
    .order("name");
  return data ?? [];
}

/** All services including retired — for the catalog editor. */
export async function getAllServices(): Promise<Tables<"services">[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("services").select("*").order("name");
  return data ?? [];
}

/** A single catalog service mapped to the TAM Service shape (case detail). */
export async function getService(id: string): Promise<Service | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("services")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ? mapTamService(data) : null;
}

// --- notifications ---------------------------------------------------------

export async function getNotifications(
  userId: string,
): Promise<AppNotification[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []).map(mapNotification);
}

// --- forecast targets & confidence overrides (S4) --------------------------

export interface ForecastTarget {
  period: string; // 'YYYY-Qn'
  amountEur: number;
}

/** Quarterly revenue targets (Finance gap-to-target), ordered by period. */
export async function getTargets(): Promise<ForecastTarget[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("forecast_targets")
    .select("*")
    .order("period");
  return (data ?? []).map((t) => ({
    period: t.period,
    amountEur: Number(t.amount_eur),
  }));
}

export interface ConfidenceOverride {
  value: number;
  reason: string | null;
  setBy: string | null;
  setAt: string;
}

/** All Finance confidence overrides, keyed by deal id. */
export async function getConfidenceOverrides(): Promise<
  Record<string, ConfidenceOverride>
> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("deal_confidence_overrides")
    .select("*");
  const out: Record<string, ConfidenceOverride> = {};
  for (const row of data ?? []) {
    out[row.deal_id] = {
      value: row.value,
      reason: row.reason,
      setBy: row.set_by,
      setAt: row.set_at,
    };
  }
  return out;
}

// --- derived analytics (pure) ----------------------------------------------

/** Weighted value of a deal = TCV x win-probability (deal's own, else stage). */
export function weightedValue(deal: Deal): number {
  return Math.round(deal.tcv * dealProbability(deal));
}

/** A deal is "stalled" if open and untouched for STALE_DAYS+ days. */
export function isStalled(deal: Deal): boolean {
  if (deal.stage === "won" || deal.stage === "lost") return false;
  return relativeDays(deal.updatedAt) >= STALE_DAYS;
}

/** Open deal past its expected close date — "overdue". The second half of the
 *  deal-risk signal (brief P1: "flags deals not updated STALE_DAYS+ days, past
 *  expected close"); isStalled covers idle, this covers slipped close dates. */
export function isOverdue(deal: Deal): boolean {
  if (deal.stage === "won" || deal.stage === "lost") return false;
  if (!deal.expectedCloseDate) return false;
  return new Date(deal.expectedCloseDate).getTime() < Date.now();
}

/** Either deal-risk condition: idle 14+ days OR past expected close. */
export function isAtRisk(deal: Deal): boolean {
  return isStalled(deal) || isOverdue(deal);
}

export interface RepSummary {
  openDeals: number;
  totalTcv: number;
  weightedPipeline: number;
  stalled: number;
}

export async function getRepSummary(repId: string): Promise<RepSummary> {
  const open = (await getDealsForRep(repId)).filter(
    (d) => d.stage !== "won" && d.stage !== "lost",
  );
  return {
    openDeals: open.length,
    totalTcv: open.reduce((s, d) => s + d.tcv, 0),
    weightedPipeline: open.reduce((s, d) => s + weightedValue(d), 0),
    stalled: open.filter(isStalled).length,
  };
}

/** Team-wide rollup of the open pipeline (Sales Manager dashboard). */
export async function getTeamSummary(): Promise<RepSummary> {
  const open = await getOpenDeals();
  return {
    openDeals: open.length,
    totalTcv: open.reduce((s, d) => s + d.tcv, 0),
    weightedPipeline: open.reduce((s, d) => s + weightedValue(d), 0),
    stalled: open.filter(isStalled).length,
  };
}

// --- inbox (internal messaging) --------------------------------------------
// Re-exported so callers keep importing everything from "@/lib/db".
export { getConversations, getInboxMessages } from "./inbox";
