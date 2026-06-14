// TAM (Technical Account Manager) domain layer — pure logic + types.
//
// Data access lives in lib/db (Supabase-backed): getCase, getNotesForCase,
// getService, getServiceHistory, getAllCases/getCasesForTam. This module holds
// only the things that don't touch the database — the SLA model, triage order,
// age maths, request-tracking derivation and the deterministic AI case summary.
// Those functions are pure: the pages fetch rows via lib/db and pass them in.

import { Account, Case, CasePriority } from "./types";
import { relativeDays } from "./format";

// --- Services: what HMD runs for an account --------------------------------

export type ServiceCategory = "device" | "mdm" | "network" | "support" | "logistics";
export type ServiceStatus = "active" | "degraded" | "retired";

export interface Service {
  id: string;
  accountId: string;
  name: string;
  category: ServiceCategory;
  status: ServiceStatus;
  /** ISO date the service went live for this account. */
  since: string;
}

// --- Service history: one timeline of everything that happened --------------

export type ServiceEventKind =
  | "deployed"
  | "upgrade"
  | "maintenance"
  | "incident"
  | "config"
  | "case_opened"
  | "case_resolved"
  | "escalation"
  | "stage_change"
  | "offer_sent"
  | "call"
  | "email"
  | "meeting"
  | "note";

export interface ServiceEvent {
  id: string;
  accountId: string;
  serviceId?: string;
  caseId?: string;
  kind: ServiceEventKind;
  body: string;
  createdAt: string; // ISO
}

// --- Case notes: internal vs working (customer-facing) ----------------------

export type NoteVisibility = "internal" | "working";

export interface CaseNote {
  id: string;
  caseId: string;
  authorId: string;
  visibility: NoteVisibility;
  body: string;
  createdAt: string; // ISO
}

// --- SLA + prioritisation helpers ------------------------------------------

export type SlaState = "breach" | "soon" | "ok" | "none" | "met";

export interface SlaInfo {
  state: SlaState;
  /** Hours until due (negative if past). Undefined when no SLA applies. */
  hoursLeft?: number;
  label: string;
}

const SLA_SOON_HOURS = 24;

export function slaInfo(c: Case): SlaInfo {
  if (c.status === "resolved") return { state: "met", label: "Resolved" };
  if (!c.slaDueDate) return { state: "none", label: "No SLA" };
  // sla_due_date is a full ISO timestamp from the DB; tolerate a date-only value
  // (treat its deadline as 17:00Z that day).
  const dueIso = c.slaDueDate.includes("T") ? c.slaDueDate : `${c.slaDueDate}T17:00:00Z`;
  const hoursLeft = (new Date(dueIso).getTime() - Date.now()) / 3_600_000;
  if (hoursLeft < 0) return { state: "breach", hoursLeft, label: `${Math.abs(Math.round(hoursLeft))}h over SLA` };
  if (hoursLeft <= SLA_SOON_HOURS) return { state: "soon", hoursLeft, label: `${Math.round(hoursLeft)}h to SLA` };
  return { state: "ok", hoursLeft, label: `${Math.round(hoursLeft / 24)}d to SLA` };
}

export function caseAgeDays(c: Case): number {
  // created_at is a full ISO timestamp from the DB; tolerate a date-only value.
  const iso = c.createdAt.includes("T") ? c.createdAt : `${c.createdAt}T00:00:00Z`;
  return relativeDays(iso);
}

const PRIORITY_RANK: Record<CasePriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
const SLA_RANK: Record<SlaState, number> = { breach: 0, soon: 1, ok: 2, none: 3, met: 4 };

/**
 * The TAM triage order: SLA pressure first (breach → soon → ok), then priority,
 * then age (oldest first). This is what "cases by priority + age" means in
 * practice — a low-priority case 2h from breach still needs eyes before a fresh
 * high-priority one.
 */
export function triageSort(list: Case[]): Case[] {
  return [...list].sort((a, b) => {
    const sa = SLA_RANK[slaInfo(a).state] - SLA_RANK[slaInfo(b).state];
    if (sa !== 0) return sa;
    const pa = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (pa !== 0) return pa;
    return caseAgeDays(b) - caseAgeDays(a);
  });
}

// --- Request tracking: what is this case blocked on? -----------------------

export type WaitingOn = "hmd" | "customer" | "third_party" | "none";

export interface RequestStatus {
  waitingOn: WaitingOn;
  label: string;
}

/**
 * Derive "who owes the next move" from the case state + latest notes.
 * `notes` is the case's notes, newest-first (as getNotesForCase returns them).
 */
export function requestStatus(c: Case, notes: CaseNote[] = []): RequestStatus {
  if (c.status === "resolved") return { waitingOn: "none", label: "Closed — no action" };
  if (c.escalatedToThirdParty) return { waitingOn: "third_party", label: "Waiting on 3rd-party vendor" };
  const latestWorking = notes.find((n) => n.visibility === "working");
  // A trailing question to the customer means the ball is in their court.
  if (latestWorking && /\?\s*$/.test(latestWorking.body.trim())) {
    return { waitingOn: "customer", label: "Waiting on customer reply" };
  }
  return { waitingOn: "hmd", label: "Action with HMD" };
}

// --- Case summary (the AI hint) --------------------------------------------
// Deterministic now — same contract the real model agent will use, so the UI
// doesn't change when Azure OpenAI lands (mirrors lib/ai.ts nextBestAction).
// Grounded: reads only this case's notes + the account's service history, both
// passed in by the caller (fetched via lib/db).

export interface CaseSummary {
  headline: string;
  bullets: string[];
  /** Suggested next step the TAM can act on. */
  suggestion: string;
}

export function summariseCase(
  c: Case,
  notes: CaseNote[],
  history: ServiceEvent[],
): CaseSummary {
  const sla = slaInfo(c);
  const req = requestStatus(c, notes);
  const internal = notes.filter((n) => n.visibility === "internal");
  const incidents = history.filter((e) => e.kind === "incident");

  const bullets: string[] = [];
  bullets.push(`${c.priority.toUpperCase()} · ${caseAgeDays(c)}d old · ${sla.label}.`);
  if (internal[0]) bullets.push(`Latest internal finding: ${internal[0].body}`);
  // Surface a likely-related prior incident (recurring/known-fix detection).
  const related = incidents.find((e) => e.caseId !== c.id && /#\d{3,}|batch/i.test(e.body));
  if (related) bullets.push(`Possibly related: ${related.body}`);
  bullets.push(`Request status: ${req.label}.`);

  const headline =
    sla.state === "breach"
      ? "Past SLA — needs action now"
      : sla.state === "soon"
        ? "SLA approaching — keep it moving"
        : c.escalatedToThirdParty
          ? "Blocked on a 3rd party"
          : "On track";

  const suggestion =
    req.waitingOn === "third_party"
      ? "Chase the vendor RMA and post a working-note update so the customer isn't in the dark."
      : req.waitingOn === "customer"
        ? "Customer owes a reply — a gentle nudge keeps the SLA clock fair."
        : sla.state === "breach" || sla.state === "soon"
          ? "Apply the known fix and draft the customer-facing resolution note."
          : "Confirm next checkpoint and keep the timeline current.";

  return { headline, bullets, suggestion };
}

export interface TamSummary {
  openCases: number;
  breaching: number;
  dueSoon: number;
  escalated: number;
}

/** Rollup of a case list (the TAM queue). Pure — caller fetches the cases. */
export function getTamSummary(cases: Case[]): TamSummary {
  const open = cases.filter((c) => c.status !== "resolved");
  return {
    openCases: open.length,
    breaching: open.filter((c) => slaInfo(c).state === "breach").length,
    dueSoon: open.filter((c) => slaInfo(c).state === "soon").length,
    escalated: open.filter((c) => c.escalatedToThirdParty).length,
  };
}

// ---------------------------------------------------------------------------
// Dashboard chart datasets — pure shapers over the case/account lists.
//
// Each returns a plain serialisable shape the (server) TamHealthOverview maps
// to colours and hands to the SVG chart components. No DB, no React — so they
// stay trivially testable and the page passes in already-fetched rows.
// ---------------------------------------------------------------------------

/** UTC calendar-day key (YYYY-MM-DD) for an ISO/date-only string. */
function dayKey(iso: string): string {
  const norm = iso.includes("T") ? iso : `${iso}T00:00:00Z`;
  return new Date(norm).toISOString().slice(0, 10);
}

// --- SLA health donut: open cases split by SLA pressure --------------------

export type SlaSegmentKey = "breach" | "soon" | "ok" | "none";

export interface SlaBreakdown {
  segments: { key: SlaSegmentKey; count: number }[];
  /** Total open cases (the donut's denominator). */
  total: number;
  /** Share of open cases that are not breaching/soon, 0–100. */
  onTrackPct: number;
}

const SLA_SEGMENT_ORDER: SlaSegmentKey[] = ["breach", "soon", "ok", "none"];

export function slaBreakdown(cases: Case[]): SlaBreakdown {
  const open = cases.filter((c) => c.status !== "resolved");
  const counts: Record<SlaSegmentKey, number> = { breach: 0, soon: 0, ok: 0, none: 0 };
  for (const c of open) {
    const s = slaInfo(c).state;
    // "met" only applies to resolved cases, which are filtered out above.
    if (s === "breach" || s === "soon" || s === "ok" || s === "none") counts[s] += 1;
  }
  const onTrack = counts.ok + counts.none;
  return {
    segments: SLA_SEGMENT_ORDER.map((key) => ({ key, count: counts[key] })),
    total: open.length,
    onTrackPct: open.length > 0 ? Math.round((onTrack / open.length) * 100) : 0,
  };
}

// --- Case flow: opened vs resolved per day over a trailing window ----------

export interface FlowPoint {
  /** YYYY-MM-DD (UTC). */
  date: string;
  opened: number;
  resolved: number;
}

export function caseFlow(cases: Case[], days = 21): FlowPoint[] {
  // Build the window of day-keys, oldest → newest, ending today (UTC).
  const today = new Date();
  const buckets = new Map<string, FlowPoint>();
  const order: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
    const key = d.toISOString().slice(0, 10);
    order.push(key);
    buckets.set(key, { date: key, opened: 0, resolved: 0 });
  }
  for (const c of cases) {
    const opened = buckets.get(dayKey(c.createdAt));
    if (opened) opened.opened += 1;
    if (c.resolvedAt) {
      const resolved = buckets.get(dayKey(c.resolvedAt));
      if (resolved) resolved.resolved += 1;
    }
  }
  return order.map((k) => buckets.get(k)!);
}

// --- Hotspots: open cases per account, split by SLA state ------------------

export interface AccountLoad {
  accountId: string;
  name: string;
  open: number;
  breach: number;
  soon: number;
  ok: number;
}

export function openByAccount(
  cases: Case[],
  accounts: Pick<Account, "id" | "name">[],
  limit = 6,
): AccountLoad[] {
  const nameById = new Map(accounts.map((a) => [a.id, a.name]));
  const byAccount = new Map<string, AccountLoad>();
  for (const c of cases) {
    if (c.status === "resolved") continue;
    let row = byAccount.get(c.accountId);
    if (!row) {
      row = {
        accountId: c.accountId,
        name: nameById.get(c.accountId) ?? "Unknown account",
        open: 0,
        breach: 0,
        soon: 0,
        ok: 0,
      };
      byAccount.set(c.accountId, row);
    }
    row.open += 1;
    const s = slaInfo(c).state;
    if (s === "breach") row.breach += 1;
    else if (s === "soon") row.soon += 1;
    else row.ok += 1; // ok + none both read as "healthy" here
  }
  return [...byAccount.values()]
    // Breaching accounts first, then by sheer volume — the TAM's eyes go there.
    .sort((a, b) => b.breach - a.breach || b.open - a.open)
    .slice(0, limit);
}

// --- Priority mix: the urgency profile of the open queue -------------------

export interface PrioritySlice {
  priority: CasePriority;
  count: number;
}

const PRIORITY_ORDER: CasePriority[] = ["urgent", "high", "medium", "low"];

export function priorityMix(cases: Case[]): PrioritySlice[] {
  const open = cases.filter((c) => c.status !== "resolved");
  return PRIORITY_ORDER.map((priority) => ({
    priority,
    count: open.filter((c) => c.priority === priority).length,
  }));
}

// --- Resolution time: how fast cases close ---------------------------------

export interface ResolutionStats {
  resolvedCount: number;
  /** Median days from open → resolved, or null when nothing has resolved. */
  medianDays: number | null;
}

export function resolutionStats(cases: Case[]): ResolutionStats {
  const spans = cases
    .filter((c) => c.status === "resolved" && c.resolvedAt)
    .map((c) => {
      const opened = new Date(c.createdAt.includes("T") ? c.createdAt : `${c.createdAt}T00:00:00Z`).getTime();
      const closed = new Date(c.resolvedAt!).getTime();
      return (closed - opened) / 86_400_000;
    })
    .filter((d) => Number.isFinite(d) && d >= 0)
    .sort((a, b) => a - b);

  if (spans.length === 0) return { resolvedCount: 0, medianDays: null };
  const mid = Math.floor(spans.length / 2);
  const median = spans.length % 2 === 0 ? (spans[mid - 1] + spans[mid]) / 2 : spans[mid];
  return { resolvedCount: spans.length, medianDays: Math.round(median * 10) / 10 };
}
