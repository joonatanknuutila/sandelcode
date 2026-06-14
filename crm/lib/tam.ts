// TAM (Technical Account Manager) domain layer — pure logic + types.
//
// Data access lives in lib/db (Supabase-backed): getCase, getNotesForCase,
// getService, getServiceHistory, getAllCases/getCasesForTam. This module holds
// only the things that don't touch the database — the SLA model, triage order,
// age maths, request-tracking derivation and the deterministic AI case summary.
// Those functions are pure: the pages fetch rows via lib/db and pass them in.

import { Case, CasePriority } from "./types";
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
