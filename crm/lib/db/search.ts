// Cross-entity global search (brief P1: "Search & filter — across accounts,
// cases, deals"). READ-ONLY: no mutations, no writes.
//
// The current user's role decides BOTH which entities are searched and which
// scoped read returns them — scope is enforced here in the query layer (with
// the existing scoped reads), not left to RLS alone:
//   rep     -> own accounts + own deals
//   tam     -> their accounts (where they have cases) + their cases
//   sm      -> all deals / accounts / cases (team lens)
//   finance -> accounts + deals (aggregate lens; no cases)
//
// Matching is a case-insensitive substring on the user-visible name/title and
// on the id, mirroring how a person would scan a list. The mapped UI types
// (lib/types.ts) are the shapes searched, so this stays decoupled from the DB.
import "server-only";
import {
  getAccounts,
  getAccountsForRep,
  getAccountsForTam,
  getAllCases,
  getAllDeals,
  getCasesForTam,
  getCurrentUser,
  getDealsForRep,
} from "./index";
import type { Account, Case, Deal, Role } from "@/lib/types";

/** A single search hit, already resolved to its role-correct deep link. */
export interface SearchHit {
  id: string;
  /** Primary line shown in the result row. */
  title: string;
  /** Secondary context line (industry/region, stage, status). */
  subtitle: string;
  /** Deep link to the record's detail route. */
  href: string;
}

/** Results grouped by entity type, in the order they render. */
export interface SearchResults {
  accounts: SearchHit[];
  deals: SearchHit[];
  cases: SearchHit[];
}

// Cap per group so the palette stays scannable on a broad query.
const MAX_PER_GROUP = 8;

function matches(needle: string, ...haystacks: string[]): boolean {
  const q = needle.trim().toLowerCase();
  if (!q) return false;
  return haystacks.some((h) => h.toLowerCase().includes(q));
}

// --- deep-link routing -----------------------------------------------------
// Account detail exists for every role, so it is role-prefixed. Deal detail
// only lives under /rep and case detail only under /tam (the only routes that
// exist), so those are pinned — this matches the href logic in lib/db/mappers.
function accountHref(rolePrefix: string, id: string): string {
  return `/${rolePrefix}/accounts/${id}`;
}
function dealHref(id: string): string {
  return `/rep/deals/${id}`;
}
function caseHref(id: string): string {
  return `/tam/cases/${id}`;
}

/** UI role -> URL prefix used in the app's routes (sm stays "sm"). */
function prefixFor(role: Role): string {
  return role; // rep | tam | sm | finance all match their route segment
}

function accountHit(rolePrefix: string, a: Account): SearchHit {
  return {
    id: a.id,
    title: a.name,
    subtitle: `${a.industry} · ${a.region}`,
    href: accountHref(rolePrefix, a.id),
  };
}

function dealHit(d: Deal, accountName?: string): SearchHit {
  const stage = d.stage.replace(/_/g, " ");
  return {
    id: d.id,
    title: d.name,
    subtitle: accountName ? `${accountName} · ${stage}` : stage,
    href: dealHref(d.id),
  };
}

function caseHit(c: Case, accountName?: string): SearchHit {
  const status = c.status.replace(/_/g, " ");
  return {
    id: c.id,
    title: c.title,
    subtitle: accountName
      ? `${accountName} · ${c.priority} · ${status}`
      : `${c.priority} · ${status}`,
    href: caseHref(c.id),
  };
}

/**
 * Run a role-scoped search across accounts, deals and cases.
 *
 * Resolves the current user via the existing helper, picks the scoped reads for
 * that role, then substring-matches each set. Returns empty groups for a blank
 * query or when no user is signed in. Never throws to the caller — a failed
 * lookup degrades to empty results.
 */
export async function searchAll(query: string): Promise<SearchResults> {
  const empty: SearchResults = { accounts: [], deals: [], cases: [] };
  const q = query.trim();
  if (!q) return empty;

  const me = await getCurrentUser();
  if (!me) return empty;

  const prefix = prefixFor(me.role);

  // Resolve the role's scoped sets. Each branch only loads what that role is
  // allowed to see (and what it has a route for), so scope is enforced before
  // any matching happens.
  let accounts: Account[] = [];
  let deals: Deal[] = [];
  let cases: Case[] = [];

  switch (me.role) {
    case "rep": {
      [accounts, deals] = await Promise.all([
        getAccountsForRep(me.id),
        getDealsForRep(me.id),
      ]);
      break;
    }
    case "tam": {
      [accounts, cases] = await Promise.all([
        getAccountsForTam(me.id),
        getCasesForTam(me.id),
      ]);
      break;
    }
    case "sm": {
      [accounts, deals, cases] = await Promise.all([
        getAccounts(),
        getAllDeals(),
        getAllCases(),
      ]);
      break;
    }
    case "finance": {
      // Aggregate lens: accounts + deals, no cases.
      [accounts, deals] = await Promise.all([getAccounts(), getAllDeals()]);
      break;
    }
  }

  // Account-name lookup so deal/case rows can show which account they belong to.
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));

  const accountHits = accounts
    .filter((a) => matches(q, a.name, a.id, a.industry, a.region))
    .slice(0, MAX_PER_GROUP)
    .map((a) => accountHit(prefix, a));

  const dealHits = deals
    .filter((d) => matches(q, d.name, d.id))
    .slice(0, MAX_PER_GROUP)
    .map((d) => dealHit(d, accountName.get(d.accountId)));

  const caseHits = cases
    .filter((c) => matches(q, c.title, c.id))
    .slice(0, MAX_PER_GROUP)
    .map((c) => caseHit(c, accountName.get(c.accountId)));

  return { accounts: accountHits, deals: dealHits, cases: caseHits };
}
