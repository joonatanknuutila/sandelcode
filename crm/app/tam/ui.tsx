// TAM-specific presentational bits. Co-located with the view so the shared
// components/ folder (Joonatan's lane) stays untouched. Uses the same brand
// tokens as components/ui.tsx.

import { Case, CasePriority, CaseStatus } from "@/lib/types";
import { SlaInfo, SlaState } from "@/lib/tam";

const PRIORITY_TONE: Record<CasePriority, string> = {
  urgent: "bg-danger/10 text-danger ring-1 ring-danger/30",
  high: "bg-warning/10 text-warning ring-1 ring-warning/30",
  medium: "bg-slate-100 text-slate-700",
  low: "bg-slate-100 text-slate-500",
};

export function PriorityBadge({ priority }: { priority: CasePriority }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${PRIORITY_TONE[priority]}`}>
      {priority}
    </span>
  );
}

const STATUS_TONE: Record<CaseStatus, string> = {
  open: "bg-slate-100 text-slate-700",
  in_progress: "bg-sky-100 text-sky-700",
  escalated: "bg-amber-100 text-amber-800",
  resolved: "bg-green-100 text-green-700",
};

const STATUS_LABEL: Record<CaseStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  escalated: "Escalated",
  resolved: "Resolved",
};

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_TONE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

const SLA_TONE: Record<SlaState, string> = {
  breach: "bg-danger/10 text-danger ring-1 ring-danger/30",
  soon: "bg-warning/10 text-warning ring-1 ring-warning/30",
  ok: "bg-slate-100 text-slate-600",
  none: "bg-slate-100 text-slate-400",
  met: "bg-green-100 text-green-700",
};

export function SlaBadge({ sla }: { sla: SlaInfo }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${SLA_TONE[sla.state]}`}>
      {(sla.state === "breach" || sla.state === "soon") && (
        <span className={`h-1.5 w-1.5 rounded-full ${sla.state === "breach" ? "bg-danger" : "bg-warning"} ${sla.state === "soon" ? "animate-pulse" : ""}`} />
      )}
      {sla.label}
    </span>
  );
}

export function ThirdPartyFlag({ case: c }: { case: Case }) {
  if (!c.escalatedToThirdParty) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
      ↗ 3rd-party
    </span>
  );
}
