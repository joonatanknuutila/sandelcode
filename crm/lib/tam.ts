// TAM (Technical Account Manager) domain layer — Aarni's lane.
//
// The shared contract (lib/types.ts) already defines `Case`. The TAM view needs
// three things that aren't in the base model yet: a service inventory per
// account, a unified service-history timeline, and case notes split into
// INTERNAL (HMD-only) vs WORKING (customer-facing) visibility. Rather than edit
// the shared types/mock owned by other lanes, this file augments them: it reads
// the existing `cases` and merges in TAM-specific records and helpers. When
// Arttu's real DB lands, only the getters below change — the TAM UI stays put.

import { cases as baseCases } from "./mock-data";
import { Case, CasePriority } from "./types";
import { relativeDays } from "./format";

// The TAM whose queue we render. (getCurrentUser() is hard-wired to a rep for
// the demo; the TAM view resolves its owner explicitly until SSO claims drive
// it.) Matches users[] in mock-data.
export const TAM_USER_ID = "u-tam-1";

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
  | "escalation";

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

// ---------------------------------------------------------------------------
// Supplementary mock data. Keyed to the accounts/cases already in mock-data so
// the two stay consistent. Extra cases (k-4..) give the queue realistic depth
// (an SLA breach, a customer-side wait, a resolved case) without touching the
// shared array.
// ---------------------------------------------------------------------------

const extraCases: Case[] = [
  {
    id: "k-4",
    accountId: "a-2",
    title: "Crash on secure-boot after 6.1 OS update (ICU ward)",
    serviceId: "s-hus-device",
    priority: "urgent",
    status: "escalated",
    assigneeId: TAM_USER_ID,
    createdAt: "2026-06-10",
    slaDueDate: "2026-06-12", // already past — breach
    escalatedToThirdParty: true,
  },
  {
    id: "k-5",
    accountId: "a-1",
    title: "Bulk certificate rotation for 3 commands",
    serviceId: "s-mdm",
    priority: "medium",
    status: "open",
    assigneeId: TAM_USER_ID,
    createdAt: "2026-06-12",
    slaDueDate: "2026-06-20",
  },
  {
    id: "k-6",
    accountId: "a-5",
    title: "French data-residency attestation for city portal",
    serviceId: "s-lyon-support",
    priority: "low",
    status: "resolved",
    assigneeId: TAM_USER_ID,
    createdAt: "2026-05-30",
    slaDueDate: "2026-06-09",
  },
];

const services: Service[] = [
  { id: "s-mdm", accountId: "a-1", name: "Secure MDM", category: "mdm", status: "degraded", since: "2026-03-01" },
  { id: "s-vpn", accountId: "a-2", name: "Always-on VPN profile", category: "network", status: "active", since: "2026-04-15" },
  { id: "s-hus-device", accountId: "a-2", name: "Skyline Secure fleet (ICU/ER)", category: "device", status: "degraded", since: "2026-05-01" },
  { id: "s-logistics", accountId: "a-4", name: "Ruggedised case supply", category: "logistics", status: "degraded", since: "2026-04-01" },
  { id: "s-lyon-support", accountId: "a-5", name: "Premier support (FR)", category: "support", status: "active", since: "2026-05-20" },
  { id: "s-bw-device", accountId: "a-1", name: "Skyline Secure fleet", category: "device", status: "active", since: "2026-03-10" },
];

// Service-history events. Case-opened/resolved/escalation events are derived
// from the cases below at read time, so this list holds the operational events
// (deployments, upgrades, maintenance, incidents) only.
const serviceEvents: ServiceEvent[] = [
  { id: "se-1", accountId: "a-2", serviceId: "s-hus-device", kind: "deployed", body: "Pilot fleet of 200 Skyline Secure handsets imaged and shipped to ICU + ER.", createdAt: "2026-05-01T09:00:00Z" },
  { id: "se-2", accountId: "a-2", serviceId: "s-vpn", kind: "config", body: "Always-on VPN profile pushed; split-tunnel disabled per HUS infosec.", createdAt: "2026-05-12T11:00:00Z" },
  { id: "se-3", accountId: "a-2", serviceId: "s-hus-device", kind: "upgrade", body: "OS 6.1 security update rolled out fleet-wide.", createdAt: "2026-06-09T22:00:00Z" },
  { id: "se-4", accountId: "a-2", serviceId: "s-hus-device", kind: "incident", body: "Secure-boot crash reported on ~15 ICU devices post-6.1. Suspected S30 secure-element batch — same signature as Maersk ticket #4471.", createdAt: "2026-06-10T07:30:00Z" },
  { id: "se-5", accountId: "a-1", serviceId: "s-bw-device", kind: "deployed", body: "Command-1 rollout: 500 handsets enrolled.", createdAt: "2026-03-10T09:00:00Z" },
  { id: "se-6", accountId: "a-1", serviceId: "s-mdm", kind: "incident", body: "MDM enrollment failing on 40 units (Command-2). APNs token mismatch suspected.", createdAt: "2026-06-08T08:00:00Z" },
  { id: "se-7", accountId: "a-1", serviceId: "s-mdm", kind: "maintenance", body: "Scheduled cert-authority maintenance window agreed for the bulk rotation.", createdAt: "2026-06-12T15:00:00Z" },
  { id: "se-8", accountId: "a-4", serviceId: "s-logistics", kind: "incident", body: "Ruggedised case supplier flagged a 3-week delay on the Q3 batch.", createdAt: "2026-06-02T10:00:00Z" },
  { id: "se-9", accountId: "a-5", serviceId: "s-lyon-support", kind: "deployed", body: "Premier support contract activated; French-language desk assigned.", createdAt: "2026-05-20T09:00:00Z" },
];

const caseNotes: CaseNote[] = [
  // k-4 — the urgent breach, shows the internal/working split clearly
  { id: "cn-1", caseId: "k-4", authorId: TAM_USER_ID, visibility: "internal", body: "Reproduced on bench. Matches S30 secure-element batch defect from Maersk #4471 — fix was a firmware re-flash + secure-element re-provision. Pulling the affected serial range now.", createdAt: "2026-06-10T09:15:00Z" },
  { id: "cn-2", caseId: "k-4", authorId: TAM_USER_ID, visibility: "working", body: "We've identified the root cause and a tested fix from a prior case. Field engineer scheduled for tomorrow 08:00; affected ICU devices will be swapped to spares in the meantime so there is no ward disruption.", createdAt: "2026-06-10T10:30:00Z" },
  { id: "cn-3", caseId: "k-4", authorId: TAM_USER_ID, visibility: "internal", body: "Escalated to secure-element vendor (3rd party) for batch RMA. Awaiting their RMA number — blocking SLA. Vendor SLA is 48h.", createdAt: "2026-06-11T14:00:00Z" },
  // k-1 — MDM enrollment
  { id: "cn-4", caseId: "k-1", authorId: TAM_USER_ID, visibility: "internal", body: "APNs token rotated on the wrong tenant during March migration. Re-issuing for Command-2 tenant.", createdAt: "2026-06-08T12:00:00Z" },
  { id: "cn-5", caseId: "k-1", authorId: TAM_USER_ID, visibility: "working", body: "Cause isolated to a certificate scope issue on the affected 40 units. Re-enrollment push prepared; expect resolution within the SLA window.", createdAt: "2026-06-09T09:00:00Z" },
  // k-3 — supplier delay, customer waiting
  { id: "cn-6", caseId: "k-3", authorId: TAM_USER_ID, visibility: "internal", body: "Supplier (3rd party) confirms 3-week slip. Sourcing interim cases from secondary vendor — 20% cost hit, flagged to account owner.", createdAt: "2026-06-03T08:00:00Z" },
  { id: "cn-7", caseId: "k-3", authorId: TAM_USER_ID, visibility: "working", body: "We're sourcing interim ruggedised cases to keep your field rollout on schedule and will confirm revised delivery dates this week.", createdAt: "2026-06-03T16:00:00Z" },
  // k-5 — cert rotation, waiting on customer
  { id: "cn-8", caseId: "k-5", authorId: TAM_USER_ID, visibility: "working", body: "Ready to proceed with the bulk certificate rotation. Please confirm the maintenance window so we can schedule across all three commands.", createdAt: "2026-06-12T15:30:00Z" },
];

// ---------------------------------------------------------------------------
// Getters — the contract the TAM UI depends on.
// ---------------------------------------------------------------------------

/** Every case in the TAM's queue (base mock + TAM supplementary). */
export function getAllCases(): Case[] {
  return [...baseCases, ...extraCases];
}

export function getCase(id: string): Case | undefined {
  return getAllCases().find((c) => c.id === id);
}

export function getService(id: string): Service | undefined {
  return services.find((s) => s.id === id);
}

export function getServicesForAccount(accountId: string): Service[] {
  return services.filter((s) => s.accountId === accountId);
}

export function getNotesForCase(caseId: string): CaseNote[] {
  return caseNotes
    .filter((n) => n.caseId === caseId)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

/**
 * Full service history for an account as ONE timeline: operational events +
 * case opened/resolved/escalation milestones, newest first. This is the
 * "everything on one timeline" the TAM brief asks for — so a TAM CC'd on a
 * 3-day-old thread has the whole context in one place.
 */
export function getServiceHistory(accountId: string): ServiceEvent[] {
  const fromCases: ServiceEvent[] = getAllCases()
    .filter((c) => c.accountId === accountId)
    .flatMap((c) => {
      const evts: ServiceEvent[] = [
        { id: `ce-open-${c.id}`, accountId, serviceId: c.serviceId, caseId: c.id, kind: "case_opened", body: `Case opened: ${c.title}`, createdAt: `${c.createdAt}T00:00:00Z` },
      ];
      if (c.escalatedToThirdParty) {
        evts.push({ id: `ce-esc-${c.id}`, accountId, serviceId: c.serviceId, caseId: c.id, kind: "escalation", body: `Escalated to 3rd party: ${c.title}`, createdAt: `${c.createdAt}T01:00:00Z` });
      }
      if (c.status === "resolved") {
        evts.push({ id: `ce-res-${c.id}`, accountId, serviceId: c.serviceId, caseId: c.id, kind: "case_resolved", body: `Case resolved: ${c.title}`, createdAt: `${c.slaDueDate ?? c.createdAt}T12:00:00Z` });
      }
      return evts;
    });

  return [...serviceEvents.filter((e) => e.accountId === accountId), ...fromCases].sort(
    (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
  );
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
  const hoursLeft = (new Date(`${c.slaDueDate}T17:00:00Z`).getTime() - Date.now()) / 3_600_000;
  if (hoursLeft < 0) return { state: "breach", hoursLeft, label: `${Math.abs(Math.round(hoursLeft))}h over SLA` };
  if (hoursLeft <= SLA_SOON_HOURS) return { state: "soon", hoursLeft, label: `${Math.round(hoursLeft)}h to SLA` };
  return { state: "ok", hoursLeft, label: `${Math.round(hoursLeft / 24)}d to SLA` };
}

export function caseAgeDays(c: Case): number {
  return relativeDays(`${c.createdAt}T00:00:00Z`);
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

/** Derive "who owes the next move" from the case state + latest notes. */
export function requestStatus(c: Case): RequestStatus {
  if (c.status === "resolved") return { waitingOn: "none", label: "Closed — no action" };
  if (c.escalatedToThirdParty) return { waitingOn: "third_party", label: "Waiting on 3rd-party vendor" };
  const latestWorking = getNotesForCase(c.id).find((n) => n.visibility === "working");
  // A trailing question to the customer means the ball is in their court.
  if (latestWorking && /\?\s*$/.test(latestWorking.body.trim())) {
    return { waitingOn: "customer", label: "Waiting on customer reply" };
  }
  return { waitingOn: "hmd", label: "Action with HMD" };
}

// --- Case summary (the AI hint) --------------------------------------------
// Deterministic now — same contract the real model agent will use, so the UI
// doesn't change when Azure OpenAI lands (mirrors lib/ai.ts nextBestAction).
// Grounded: reads only this case's notes + the account's service history.

export interface CaseSummary {
  headline: string;
  bullets: string[];
  /** Suggested next step the TAM can act on. */
  suggestion: string;
}

export function summariseCase(c: Case): CaseSummary {
  const sla = slaInfo(c);
  const req = requestStatus(c);
  const internal = getNotesForCase(c.id).filter((n) => n.visibility === "internal");
  const history = getServiceHistory(c.accountId).filter((e) => e.kind === "incident");

  const bullets: string[] = [];
  bullets.push(`${c.priority.toUpperCase()} · ${caseAgeDays(c)}d old · ${sla.label}.`);
  if (internal[0]) bullets.push(`Latest internal finding: ${internal[0].body}`);
  // Surface a likely-related prior incident (recurring/known-fix detection).
  const related = history.find((e) => e.caseId !== c.id && /#\d{3,}|batch/i.test(e.body));
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

export function getTamSummary(): TamSummary {
  const open = getAllCases().filter((c) => c.status !== "resolved");
  return {
    openCases: open.length,
    breaching: open.filter((c) => slaInfo(c).state === "breach").length,
    dueSoon: open.filter((c) => slaInfo(c).state === "soon").length,
    escalated: open.filter((c) => c.escalatedToThirdParty).length,
  };
}
