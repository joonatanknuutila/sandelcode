// Typed data-access layer. This is the ONLY file that knows where data comes
// from. Today it returns in-memory mock data; when Arttu's Azure API is ready,
// swap these bodies for `fetch()` calls to his endpoints — the function
// signatures (the contract the UI depends on) stay identical.

import {
  accounts,
  activities,
  cases,
  contacts,
  CURRENT_USER_ID,
  deals,
  notifications,
  offers,
  users,
} from "./mock-data";
import {
  Account,
  Activity,
  AppNotification,
  Case,
  Contact,
  Deal,
  Offer,
  STAGE_PROBABILITY,
  User,
} from "./types";

export function getCurrentUser(): User {
  return users.find((u) => u.id === CURRENT_USER_ID)!;
}

export function getUser(id: string): User | undefined {
  return users.find((u) => u.id === id);
}

export function getAccountsForRep(repId: string): Account[] {
  return accounts.filter((a) => a.ownerId === repId);
}

export function getAccount(id: string): Account | undefined {
  return accounts.find((a) => a.id === id);
}

export function getContactsForAccount(accountId: string): Contact[] {
  return contacts.filter((c) => c.accountId === accountId);
}

export function getDealsForRep(repId: string): Deal[] {
  return deals.filter((d) => d.ownerId === repId);
}

export function getDealsForAccount(accountId: string): Deal[] {
  return deals.filter((d) => d.accountId === accountId);
}

export function getDeal(id: string): Deal | undefined {
  return deals.find((d) => d.id === id);
}

export function getCasesForAccount(accountId: string): Case[] {
  return cases.filter((k) => k.accountId === accountId);
}

export function getActivitiesForAccount(accountId: string): Activity[] {
  return [...activities]
    .filter((a) => a.accountId === accountId)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

export function getActivitiesForDeal(dealId: string): Activity[] {
  return [...activities]
    .filter((a) => a.dealId === dealId)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

export function getOffersForDeal(dealId: string): Offer[] {
  return offers.filter((o) => o.dealId === dealId);
}

export function getNotifications(userId: string): AppNotification[] {
  return notifications.filter((n) => n.userId === userId);
}

// --- Derived analytics -----------------------------------------------------

/** Weighted value of a deal = TCV × stage win-probability. */
export function weightedValue(deal: Deal): number {
  return Math.round(deal.tcv * STAGE_PROBABILITY[deal.stage]);
}

/** A deal is "stalled" if open and untouched for 14+ days (brief P1). */
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

export function getRepSummary(repId: string): RepSummary {
  const repDeals = getDealsForRep(repId).filter(
    (d) => d.stage !== "won" && d.stage !== "lost",
  );
  return {
    openDeals: repDeals.length,
    totalTcv: repDeals.reduce((s, d) => s + d.tcv, 0),
    weightedPipeline: repDeals.reduce((s, d) => s + weightedValue(d), 0),
    stalled: repDeals.filter(isStalled).length,
  };
}
