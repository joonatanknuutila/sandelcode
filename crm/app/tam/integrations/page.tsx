import { Badge, Card, SectionTitle, StatTile } from "@/components/ui";
import {
  CATEGORY_ACCENT,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  INTEGRATIONS,
  Integration,
  IntegrationStatus,
  catalogStats,
  initials,
} from "@/lib/integrations/catalog";
import { ConnectButton } from "./ConnectButton";

// TAM Integrations catalog — the connectors that wrap data and alerting around
// the case queue, grouped by what they unlock. Server-rendered; the only client
// island is the per-card Connect button.

const STATUS_BADGE: Record<
  IntegrationStatus,
  { tone: "blue" | "amber" | "green"; label: string }
> = {
  available: { tone: "blue", label: "Available" },
  beta: { tone: "amber", label: "Beta" },
  connected: { tone: "green", label: "Connected" },
};

function ConnectorCard({ item }: { item: Integration }) {
  const accent = CATEGORY_ACCENT[item.category];
  const badge = STATUS_BADGE[item.status];
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-sm font-semibold"
          style={{ backgroundColor: `${accent}1f`, color: accent }}
        >
          {initials(item.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">{item.name}</p>
          <p className="text-xs text-muted">{CATEGORY_LABELS[item.category]}</p>
        </div>
        <Badge tone={badge.tone}>{badge.label}</Badge>
      </div>
      <p className="flex-1 text-sm text-muted">{item.blurb}</p>
      <ConnectButton name={item.name} status={item.status} />
    </Card>
  );
}

export default function IntegrationsPage() {
  const stats = catalogStats();

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="mt-1 text-sm text-muted">
          Connect ticketing, alerting, device telemetry and analytics around your
          case queue. Pick a connector to wire it into the SLA workflow.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Connectors" value={String(stats.total)} />
        <StatTile label="Categories" value={String(stats.categories)} />
        <StatTile label="In beta" value={String(stats.beta)} hint="early access" />
        <StatTile
          label="Connected"
          value="0"
          hint="none wired yet"
        />
      </div>

      {CATEGORY_ORDER.map((category) => {
        const items = INTEGRATIONS.filter((i) => i.category === category);
        if (items.length === 0) return null;
        return (
          <section key={category}>
            <SectionTitle>{CATEGORY_LABELS[category]}</SectionTitle>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <ConnectorCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
