// Integration catalog — the connectors a TAM org can light up around the case
// queue. Pure data + types; the /tam/integrations page renders it. Statuses are
// honest for this build: nothing is wired to a live third party yet, so entries
// are "available" (ready to build) or "beta" (in progress), never "connected".

export type IntegrationCategory =
  | "ticketing"
  | "alerting"
  | "comms"
  | "mdm"
  | "monitoring"
  | "calendar"
  | "csat"
  | "bi";

export type IntegrationStatus = "available" | "beta" | "connected";

export interface Integration {
  id: string;
  name: string;
  category: IntegrationCategory;
  /** One line: what connecting it unlocks for a TAM. */
  blurb: string;
  status: IntegrationStatus;
}

export const CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  ticketing: "Ticketing & ITSM",
  alerting: "Alerting & on-call",
  comms: "Customer comms",
  mdm: "Device & MDM telemetry",
  monitoring: "Monitoring & status",
  calendar: "Calendar",
  csat: "Customer satisfaction",
  bi: "BI & data warehouse",
};

/** Accent per category — drives the connector tile colour. */
export const CATEGORY_ACCENT: Record<IntegrationCategory, string> = {
  ticketing: "#e4ff00",
  alerting: "#f59e0b",
  comms: "#38bdf8",
  mdm: "#a78bfa",
  monitoring: "#34d399",
  calendar: "#f472b6",
  csat: "#fbbf24",
  bi: "#60a5fa",
};

/** Render order for the catalog sections. */
export const CATEGORY_ORDER: IntegrationCategory[] = [
  "ticketing",
  "alerting",
  "comms",
  "mdm",
  "monitoring",
  "calendar",
  "csat",
  "bi",
];

export const INTEGRATIONS: Integration[] = [
  // Ticketing / ITSM — two-way case + SLA sync.
  { id: "zendesk", name: "Zendesk", category: "ticketing", status: "available", blurb: "Sync tickets and SLA policies two-way so cases never live in two places." },
  { id: "jira-sm", name: "Jira Service Management", category: "ticketing", status: "available", blurb: "Push escalations to engineering queues and pull status back onto the case." },
  { id: "servicenow", name: "ServiceNow", category: "ticketing", status: "available", blurb: "Mirror incidents and change requests for enterprise accounts on ITSM." },
  { id: "freshdesk", name: "Freshdesk", category: "ticketing", status: "available", blurb: "Import inbound tickets and keep resolution notes in lockstep." },

  // Alerting / on-call.
  { id: "pagerduty", name: "PagerDuty", category: "alerting", status: "available", blurb: "Page the on-call TAM the moment a case crosses its SLA breach line." },
  { id: "opsgenie", name: "Opsgenie", category: "alerting", status: "available", blurb: "Route breach and escalation alerts through existing on-call schedules." },
  { id: "slack", name: "Slack", category: "alerting", status: "available", blurb: "Drop breach and due-soon alerts into the account's channel in real time." },
  { id: "ms-teams", name: "Microsoft Teams", category: "alerting", status: "available", blurb: "Post SLA alerts and case digests to the team's Teams channel." },

  // Outbound comms.
  { id: "resend", name: "Resend", category: "comms", status: "available", blurb: "Send branded customer-update emails straight from a working note." },
  { id: "sendgrid", name: "SendGrid", category: "comms", status: "available", blurb: "Deliver resolution and status emails at scale with delivery tracking." },
  { id: "twilio", name: "Twilio", category: "comms", status: "available", blurb: "Fire SMS alerts to the customer contact on urgent escalations." },

  // Device / MDM telemetry.
  { id: "intune", name: "Microsoft Intune", category: "mdm", status: "available", blurb: "Auto-open incidents from device-health and compliance signals." },
  { id: "workspace-one", name: "VMware Workspace ONE", category: "mdm", status: "available", blurb: "Feed enrolled-device status and alerts into the case timeline." },
  { id: "soti", name: "SOTI MobiControl", category: "mdm", status: "beta", blurb: "Pull rugged-device fleet telemetry to pre-empt field incidents." },

  // Monitoring / status.
  { id: "datadog", name: "Datadog", category: "monitoring", status: "available", blurb: "Attach service incidents to cases and watch error rates per account." },
  { id: "grafana", name: "Grafana", category: "monitoring", status: "beta", blurb: "Embed account-level dashboards and alert rules beside the queue." },
  { id: "statuspage", name: "Statuspage", category: "monitoring", status: "available", blurb: "Publish customer-facing SLA and uptime status automatically." },

  // Calendar.
  { id: "google-calendar", name: "Google Calendar", category: "calendar", status: "available", blurb: "Drop SLA deadlines and check-ins onto the TAM's calendar as reminders." },
  { id: "outlook-calendar", name: "Outlook Calendar", category: "calendar", status: "available", blurb: "Sync SLA due dates and review meetings into Outlook." },

  // CSAT.
  { id: "delighted", name: "Delighted", category: "csat", status: "available", blurb: "Trigger a CSAT survey on resolution and surface scores per account." },
  { id: "typeform", name: "Typeform", category: "csat", status: "available", blurb: "Send post-resolution feedback forms and route responses to the case." },

  // BI / warehouse.
  { id: "snowflake", name: "Snowflake", category: "bi", status: "available", blurb: "Stream case and SLA history to the warehouse for cross-team reporting." },
  { id: "bigquery", name: "BigQuery", category: "bi", status: "available", blurb: "Export the case dataset for blended product + support analytics." },
  { id: "metabase", name: "Metabase", category: "bi", status: "available", blurb: "Embed self-serve dashboards built on live case data." },
];

export interface CatalogStats {
  total: number;
  categories: number;
  beta: number;
}

export function catalogStats(items: Integration[] = INTEGRATIONS): CatalogStats {
  return {
    total: items.length,
    categories: new Set(items.map((i) => i.category)).size,
    beta: items.filter((i) => i.status === "beta").length,
  };
}

/** Two-letter initials for a connector tile, e.g. "Jira Service" → "JS". */
export function initials(name: string): string {
  const words = name.replace(/[^A-Za-z0-9 ]/g, "").trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
