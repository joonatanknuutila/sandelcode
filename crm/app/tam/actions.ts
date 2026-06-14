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
  await addCaseNote({ caseId, content, isInternal });
  revalidatePath(`/tam/cases/${caseId}`);
  revalidatePath("/tam");
}

// ---------------------------------------------------------------------------
// Resolve case
// ---------------------------------------------------------------------------

export async function resolveCaseAction(caseId: string): Promise<void> {
  const c = await getCase(caseId);
  if (!c) throw new Error("Case not found");

  await updateCaseStatus(caseId, "resolved");
  await logActivity({
    accountId: c.accountId,
    eventType: "case_resolved",
    title: "Case resolved",
    body: `Case "${c.title}" marked as resolved.`,
    entityType: "case",
    entityId: caseId,
  });

  revalidatePath(`/tam/cases/${caseId}`);
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
    eventType: status === "resolved" ? "case_resolved" : "note",
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
  thirdPartyReference?: string,
): Promise<void> {
  const c = await getCase(caseId);
  if (!c) throw new Error("Case not found");

  await escalateCase(caseId, thirdPartyReference);
  await logActivity({
    accountId: c.accountId,
    eventType: "escalation",
    title: "Case escalated to 3rd party",
    body: thirdPartyReference
      ? `Escalated — reference: ${thirdPartyReference}`
      : `Case "${c.title}" escalated to a third-party vendor.`,
    entityType: "case",
    entityId: caseId,
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
