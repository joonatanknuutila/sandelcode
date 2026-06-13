// Typed data-access layer (Supabase-backed).
//
// This is the real replacement for the mock `lib/api.ts`. Every function is
// async (it hits Postgres) and returns the SAME UI types the components already
// use (`lib/types.ts`) — the DB->UI translation happens in `./mappers`.
//
// Adoption (Joonatan): swap `from "@/lib/api"` to `from "@/lib/db"`, make the
// calling Server Component `async`, and `await` the call. Signatures otherwise
// match the old api.ts names. See ./README.md.
//
// Auth target: Supabase Auth for the demo; Azure Entra ID is the production
// target (swap the client in lib/supabase/* — query layer is unaffected).
import "server-only";
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
} from "./mappers";
import {
  Account,
  Activity,
  AppNotification,
  Case,
  Channel,
  Contact,
  Deal,
  Offer,
  OfferStatus,
  STAGE_PROBABILITY,
  User,
} from "@/lib/types";
import type { Tables } from "@/lib/types.db";
import type { CaseNote, Service, ServiceEvent } from "@/lib/tam";

// --- users -----------------------------------------------------------------

/** The signed-in user's profile. Falls back to the first rep so the demo
 *  renders before a login page exists. */
export async function getCurrentUser(): Promise<User | null> {
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

export async function getUsers(): Promise<User[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").order("full_name");
  return (data ?? []).map(mapUser);
}

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
export async function getAccounts(): Promise<Account[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("accounts").select("*").order("name");
  const accounts = data ?? [];
  const channels = await channelByAccount(
    supabase,
    accounts.map((a) => a.id),
  );
  return accounts.map((a) => mapAccount(a, channels.get(a.id) ?? "direct"));
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
export async function getAllDeals(): Promise<Deal[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("deals")
    .select("*")
    .order("last_activity_at", { ascending: false });
  return assembleDeals(supabase, data ?? []);
}

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

export async function getServices(): Promise<Tables<"services">[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("services")
    .select("*")
    .eq("is_active", true)
    .order("name");
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

// --- derived analytics (pure; mirror lib/api.ts) ---------------------------

/** Weighted value of a deal = TCV x stage win-probability. */
export function weightedValue(deal: Deal): number {
  return Math.round(deal.tcv * STAGE_PROBABILITY[deal.stage]);
}

/** A deal is "stalled" if open and untouched for 14+ days. */
export function isStalled(deal: Deal): boolean {
  if (deal.stage === "won" || deal.stage === "lost") return false;
  const days = (Date.now() - new Date(deal.updatedAt).getTime()) / 86_400_000;
  return days >= 14;
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
