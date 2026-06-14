"use server";

import { revalidatePath } from "next/cache";
import {
  addCaseNote,
  escalateCase,
  logActivity,
  createNotification,
  reassignCase,
  updateCaseStatus,
} from "@/lib/db/mutations";
import { getCase } from "@/lib/db";
import type { CaseStatus } from "@/lib/types";

// ---------------------------------------------------------------------------
// Add note
// ---------------------------------------------------------------------------

export async function addNoteAction(
  caseId: string,
  content: string,
  isInternal: boolean,
): Promise<void> {
  const c = await getCase(caseId);
  if (!c) throw new Error("Case not found");

  await addCaseNote({ caseId, content, isInternal });

  if (!isInternal) {
    await logActivity({
      accountId: c.accountId,
      eventType: "note",
      title: "TAM sales-facing update",
      body: `Case "${c.title}": ${content}`,
      entityType: "account",
      entityId: c.accountId,
    });
  }

  revalidatePath(`/tam/cases/${caseId}`);
  revalidatePath(`/tam/accounts/${c.accountId}`);
  revalidatePath(`/rep/accounts/${c.accountId}`);
  revalidatePath("/tam");
}

// ---------------------------------------------------------------------------
// Resolve case
// ---------------------------------------------------------------------------

export async function resolveCaseAction(
  caseId: string,
  resolution?: string,
): Promise<void> {
  const c = await getCase(caseId);
  if (!c) throw new Error("Case not found");

  await updateCaseStatus(caseId, "resolved");
  const cleanResolution = resolution?.trim();
  if (cleanResolution) {
    await addCaseNote({
      caseId,
      content: `Resolution recorded: ${cleanResolution}`,
      isInternal: false,
    });
  }
  await logActivity({
    accountId: c.accountId,
    eventType: "case_resolved",
    title: "Case resolved",
    body: cleanResolution
      ? `Case "${c.title}" resolved: ${cleanResolution}`
      : `Case "${c.title}" marked as resolved.`,
    entityType: "case",
    entityId: caseId,
  });
  await logActivity({
    accountId: c.accountId,
    eventType: "case_resolved",
    title: "Case resolved",
    body: cleanResolution
      ? `Case "${c.title}" resolved: ${cleanResolution}`
      : `Case "${c.title}" marked as resolved.`,
    entityType: "account",
    entityId: c.accountId,
  });

  revalidatePath(`/tam/cases/${caseId}`);
  revalidatePath(`/tam/accounts/${c.accountId}`);
  revalidatePath(`/rep/accounts/${c.accountId}`);
  revalidatePath("/tam");
}

// ---------------------------------------------------------------------------
// Set status (open / in progress) — the one-click status control. Resolve and
// escalate keep their own actions (they stamp resolved_at / raise the 3rd-party
// flag respectively). Every status move writes a timeline event so the case
// history reads cleanly ("marked in progress", "reopened").
// ---------------------------------------------------------------------------

const STATUS_VERB: Record<CaseStatus, string> = {
  open: "reopened",
  in_progress: "marked in progress",
  escalated: "escalated",
  resolved: "resolved",
};

export async function setCaseStatusAction(
  caseId: string,
  status: CaseStatus,
): Promise<void> {
  const c = await getCase(caseId);
  if (!c) throw new Error("Case not found");

  await updateCaseStatus(caseId, status);
  await logActivity({
    accountId: c.accountId,
    eventType: status === "resolved" ? "case_resolved" : "status_change",
    title: `Case ${STATUS_VERB[status]}`,
    body: `Case "${c.title}" ${STATUS_VERB[status]}.`,
    entityType: "case",
    entityId: caseId,
  });

  revalidatePath(`/tam/cases/${caseId}`);
  revalidatePath("/tam");
}

// ---------------------------------------------------------------------------
// Escalate case
// ---------------------------------------------------------------------------

export async function escalateCaseAction(
  caseId: string,
  input?: {
    party?: string;
    status?: "waiting" | "replied" | "resolved";
    reference?: string;
    detail?: string;
  },
): Promise<void> {
  const c = await getCase(caseId);
  if (!c) throw new Error("Case not found");

  const party = input?.party?.trim() || "3rd-party vendor";
  const status = input?.status ?? "waiting";
  const reference = input?.reference?.trim();
  const detail = input?.detail?.trim();

  await escalateCase(caseId, reference ? `${party} · ${reference}` : party);
  await logActivity({
    accountId: c.accountId,
    eventType: "escalation",
    title: "Case escalated to 3rd party",
    body:
      status === "resolved"
        ? `${party} replied and the external dependency is resolved${reference ? ` (${reference})` : ""}${detail ? ` — ${detail}` : ""}.`
        : status === "replied"
          ? `${party} replied${reference ? ` (${reference})` : ""}${detail ? ` — ${detail}` : ""}.`
          : `Waiting on ${party}${reference ? ` (${reference})` : ""}${detail ? ` — ${detail}` : ""}.`,
    entityType: "case",
    entityId: caseId,
    metadata: { party, status, reference: reference ?? null },
  });

  revalidatePath(`/tam/cases/${caseId}`);
  revalidatePath("/tam");
}

// ---------------------------------------------------------------------------
// Reassign case
// ---------------------------------------------------------------------------

export async function reassignCaseAction(
  caseId: string,
  newTamId: string,
  newTamName: string,
): Promise<void> {
  const c = await getCase(caseId);
  if (!c) throw new Error("Case not found");

  const oldTamId = c.assigneeId;
  await reassignCase(caseId, newTamId);

  // Notify old TAM (if any and different)
  if (oldTamId && oldTamId !== newTamId) {
    await createNotification({
      userId: oldTamId,
      title: "Case reassigned",
      body: `Case "${c.title}" has been reassigned to ${newTamName}.`,
      entityType: "case",
      entityId: caseId,
    });
  }

  // Notify new TAM
  await createNotification({
    userId: newTamId,
    title: "Case assigned to you",
    body: `Case "${c.title}" has been assigned to you.`,
    entityType: "case",
    entityId: caseId,
  });

  await logActivity({
    accountId: c.accountId,
    eventType: "note",
    title: "Case reassigned",
    body: `Case reassigned to ${newTamName}.`,
    entityType: "case",
    entityId: caseId,
  });

  revalidatePath(`/tam/cases/${caseId}`);
  revalidatePath("/tam");
}
