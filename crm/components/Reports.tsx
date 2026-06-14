import {
  getAllCases,
  getAllDeals,
  getAllServices,
  getUsers,
  weightedValue,
} from "@/lib/db";
import {
  CaseStatus,
  Deal,
  STAGE_LABELS,
  STAGE_ORDER,
  Stage,
  User,
} from "@/lib/types";
import { eur } from "@/lib/format";
import { Card, SectionTitle, StatTile } from "@/components/ui";
import { ExportLinks } from "@/components/ExportLinks";

// Basic reporting (brief P1) — deterministic, read-only. Shared by the Sales
// Manager and Finance roles (mounted at /sm/reports and /finance/reports).
// Three reports, all computed from the typed lib/db reads:
//   1. Deals by stage / owner — count + TCV + weighted value.
//   2. Cases by status / service — counts, grouped two ways.
//   3. Close rate — won / (won + lost), overall and per owner.
//
// No AI, no mutations, no chart library — plain tables + stat cards + an inline
// proportion bar built from the existing utility classes.

// Active (non-terminal) stages, in pipeline order, for the by-stage table.
const ACTIVE_STAGES: Stage[] = STAGE_ORDER.filter(
  (s) => s !== "won" && s !== "lost",
);

const CASE_STATUS_ORDER: CaseStatus[] = [
  "open",
  "in_progress",
  "escalated",
  "resolved",
];

const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  escalated: "Escalated",
  resolved: "Resolved",
};

interface StageRow {
  stage: Stage;
  count: number;
  tcv: number;
  weighted: number;
}

interface OwnerRow {
  ownerId: string;
  name: string;
  initials: string;
  /** Open (non-terminal) deals only — the active book. */
  open: number;
  tcv: number;
  weighted: number;
  won: number;
  lost: number;
  /** won / (won + lost), or null when the owner has closed nothing yet. */
  closeRate: number | null;
}

/** A simple lime proportion bar (share of the max) — no chart library. */
function ProportionBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-background">
      <div className="h-full rounded-full bg-hmd-teal" style={{ width: `${pct}%` }} />
    </div>
  );
}

function closeRatePct(won: number, lost: number): number | null {
  const closed = won + lost;
  return closed > 0 ? Math.round((won / closed) * 100) : null;
}

export async function Reports() {
  const [deals, cases, services, users] = await Promise.all([
    getAllDeals(),
    getAllCases(),
    getAllServices(),
    getUsers(),
  ]);

  const userById = new Map<string, User>(users.map((u) => [u.id, u]));
  const serviceNameById = new Map(services.map((s) => [s.id, s.name]));

  const openDeals = deals.filter((d) => d.stage !== "won" && d.stage !== "lost");
  const wonDeals = deals.filter((d) => d.stage === "won");
  const lostDeals = deals.filter((d) => d.stage === "lost");

  // --- Report 1a: deals by stage (open stages only — won/lost roll into the
  //     close-rate report below). Count + TCV + weighted value. ---------------
  const stageRows: StageRow[] = ACTIVE_STAGES.map((stage) => {
    const inStage = openDeals.filter((d) => d.stage === stage);
    return {
      stage,
      count: inStage.length,
      tcv: inStage.reduce((s, d) => s + d.tcv, 0),
      weighted: inStage.reduce((s, d) => s + weightedValue(d), 0),
    };
  });
  const stageMaxWeighted = Math.max(1, ...stageRows.map((r) => r.weighted));
  const openTcv = openDeals.reduce((s, d) => s + d.tcv, 0);
  const openWeighted = openDeals.reduce((s, d) => s + weightedValue(d), 0);

  // --- Report 1b + 3: per owner. Open book (count/TCV/weighted) plus the
  //     win/lost tallies that drive the per-owner close rate. ----------------
  const ownerIds = new Set(deals.map((d) => d.ownerId));
  const ownerRows: OwnerRow[] = [...ownerIds]
    .map((ownerId): OwnerRow => {
      const owner = userById.get(ownerId);
      const ownerOpen = openDeals.filter((d) => d.ownerId === ownerId);
      const won = wonDeals.filter((d) => d.ownerId === ownerId).length;
      const lost = lostDeals.filter((d) => d.ownerId === ownerId).length;
      return {
        ownerId,
        name: owner?.name ?? "Unassigned",
        initials: owner?.initials ?? "?",
        open: ownerOpen.length,
        tcv: ownerOpen.reduce((s, d) => s + d.tcv, 0),
        weighted: ownerOpen.reduce((s, d) => s + weightedValue(d), 0),
        won,
        lost,
        closeRate: closeRatePct(won, lost),
      };
    })
    .sort((a, b) => b.weighted - a.weighted);
  const ownerMaxWeighted = Math.max(1, ...ownerRows.map((r) => r.weighted));

  // --- Report 2: cases by status and by linked service. -------------------
  const statusRows = CASE_STATUS_ORDER.map((status) => ({
    status,
    count: cases.filter((c) => c.status === status).length,
  }));
  const statusMax = Math.max(1, ...statusRows.map((r) => r.count));

  const caseCountByService = new Map<string, number>();
  for (const c of cases) {
    caseCountByService.set(
      c.serviceId,
      (caseCountByService.get(c.serviceId) ?? 0) + 1,
    );
  }
  const serviceRows = [...caseCountByService.entries()]
    .map(([serviceId, count]) => ({
      serviceId,
      name: serviceNameById.get(serviceId) ?? "Unknown service",
      count,
    }))
    .sort((a, b) => b.count - a.count);
  const serviceMax = Math.max(1, ...serviceRows.map((r) => r.count));

  // --- Report 3: overall close rate. --------------------------------------
  const wonCount = wonDeals.length;
  const lostCount = lostDeals.length;
  const overallCloseRate = closeRatePct(wonCount, lostCount);

  const th =
    "px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted";
  const thRight = `${th} text-right`;

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="mt-1 text-sm text-muted">
            Deals by stage and owner, cases by status and service, and close
            rate — a deterministic snapshot of where things stand.
          </p>
        </div>
        <ExportLinks kinds={["pipeline", "cases"]} />
      </div>

      {/* Headline numbers. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Open deals" value={String(openDeals.length)} />
        <StatTile
          label="Weighted pipeline"
          value={eur(openWeighted)}
          hint="probability-adjusted"
        />
        <StatTile
          label="Total opportunity (TCV)"
          value={eur(openTcv)}
          hint="open deals"
        />
        <StatTile
          label="Close rate"
          value={overallCloseRate === null ? "—" : `${overallCloseRate}%`}
          hint={`won ${wonCount} · lost ${lostCount}`}
          tone="success"
        />
      </div>

      {/* Report 1a — deals by stage. */}
      <section>
        <SectionTitle>Deals by stage</SectionTitle>
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-background">
              <tr>
                <th className={th}>Stage</th>
                <th className={thRight}>Deals</th>
                <th className={thRight}>TCV</th>
                <th className={thRight}>Weighted</th>
                <th className={`${th} w-40`}>Share</th>
              </tr>
            </thead>
            <tbody>
              {stageRows.map((r) => (
                <tr key={r.stage} className="border-t border-border">
                  <td className="px-3 py-2 text-foreground">
                    {STAGE_LABELS[r.stage]}
                  </td>
                  <td className="px-3 py-2 text-right text-muted">{r.count}</td>
                  <td className="px-3 py-2 text-right text-muted">
                    {r.tcv ? eur(r.tcv) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">
                    {r.weighted ? eur(r.weighted) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <ProportionBar value={r.weighted} max={stageMaxWeighted} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-background font-semibold">
                <td className="px-3 py-2">Open total</td>
                <td className="px-3 py-2 text-right">{openDeals.length}</td>
                <td className="px-3 py-2 text-right">{eur(openTcv)}</td>
                <td className="px-3 py-2 text-right">{eur(openWeighted)}</td>
                <td className="px-3 py-2" />
              </tr>
            </tfoot>
          </table>
        </Card>
      </section>

      {/* Report 1b + 3 — deals by owner, with per-owner close rate. */}
      <section>
        <SectionTitle>Deals by owner</SectionTitle>
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-background">
              <tr>
                <th className={th}>Owner</th>
                <th className={thRight}>Open</th>
                <th className={thRight}>TCV</th>
                <th className={thRight}>Weighted</th>
                <th className={`${th} w-40`}>Share</th>
                <th className={thRight}>Won / Lost</th>
                <th className={thRight}>Close rate</th>
              </tr>
            </thead>
            <tbody>
              {ownerRows.map((r) => (
                <tr key={r.ownerId} className="border-t border-border">
                  <td className="px-3 py-2">
                    <span className="font-medium text-foreground">
                      {r.name}
                    </span>
                    <span className="ml-1.5 text-xs text-muted">
                      {r.initials}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right text-muted">{r.open}</td>
                  <td className="px-3 py-2 text-right text-muted">
                    {r.tcv ? eur(r.tcv) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">
                    {r.weighted ? eur(r.weighted) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <ProportionBar value={r.weighted} max={ownerMaxWeighted} />
                  </td>
                  <td className="px-3 py-2 text-right text-muted">
                    {r.won} / {r.lost}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">
                    {r.closeRate === null ? "—" : `${r.closeRate}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <p className="mt-2 text-xs text-muted">
          Close rate = won / (won + lost) for each owner&apos;s closed deals.
        </p>
      </section>

      {/* Report 2 — cases, two groupings side by side. */}
      <section>
        <SectionTitle>Cases by status</SectionTitle>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-background">
                <tr>
                  <th className={th}>Status</th>
                  <th className={thRight}>Cases</th>
                  <th className={`${th} w-40`}>Share</th>
                </tr>
              </thead>
              <tbody>
                {statusRows.map((r) => (
                  <tr key={r.status} className="border-t border-border">
                    <td className="px-3 py-2 text-foreground">
                      {CASE_STATUS_LABELS[r.status]}
                    </td>
                    <td className="px-3 py-2 text-right font-medium">
                      {r.count}
                    </td>
                    <td className="px-3 py-2">
                      <ProportionBar value={r.count} max={statusMax} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-background font-semibold">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 text-right">{cases.length}</td>
                  <td className="px-3 py-2" />
                </tr>
              </tfoot>
            </table>
          </Card>

          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-background">
                <tr>
                  <th className={th}>Service</th>
                  <th className={thRight}>Cases</th>
                  <th className={`${th} w-40`}>Share</th>
                </tr>
              </thead>
              <tbody>
                {serviceRows.length === 0 ? (
                  <tr className="border-t border-border">
                    <td className="px-3 py-3 text-muted" colSpan={3}>
                      No cases on record.
                    </td>
                  </tr>
                ) : (
                  serviceRows.map((r) => (
                    <tr key={r.serviceId} className="border-t border-border">
                      <td className="px-3 py-2 text-foreground">{r.name}</td>
                      <td className="px-3 py-2 text-right font-medium">
                        {r.count}
                      </td>
                      <td className="px-3 py-2">
                        <ProportionBar value={r.count} max={serviceMax} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Card>
        </div>
        <p className="mt-2 text-xs text-muted">
          Service grouping uses each case&apos;s linked catalog service.
        </p>
      </section>
    </div>
  );
}
