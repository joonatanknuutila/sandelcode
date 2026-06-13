"use client";

// The 3-year time-phased forecast — HMD's core deal mechanic. Reps enter
// expected device units per quarter; device + service revenue and the 3-yr TCV
// recompute live. Low-friction inline editing (reps hate manual entry):
// type a number, totals update, no modal. Persisting is wired to lib/api once
// Arttu's mutation endpoint lands; for now edits are local state.

import { useMemo, useState } from "react";
import { ForecastPoint, ServiceModel } from "@/lib/types";
import { eur, num, quarterLabel } from "@/lib/format";

const SERVICE_LABEL: Record<ServiceModel, string> = {
  one_off: "One-off at delivery",
  fixed_term: "Fixed-term (1–5y)",
  monthly_recurring: "Monthly recurring / active device",
};

export function ForecastGrid({
  forecast,
  serviceModel,
  unitPrice = 720,
  serviceQuarterly = 36,
}: {
  forecast: ForecastPoint[];
  serviceModel: ServiceModel;
  unitPrice?: number;
  serviceQuarterly?: number;
}) {
  const [points, setPoints] = useState<ForecastPoint[]>(forecast);

  function updateDevices(idx: number, devices: number) {
    setPoints((prev) =>
      prev.map((p, i) =>
        i === idx
          ? {
              ...p,
              devices,
              deviceRevenue: devices * unitPrice,
              serviceRevenue: devices * serviceQuarterly,
            }
          : p,
      ),
    );
  }

  const totals = useMemo(() => {
    const device = points.reduce((s, p) => s + p.deviceRevenue, 0);
    const service = points.reduce((s, p) => s + p.serviceRevenue, 0);
    const devices = points.reduce((s, p) => s + p.devices, 0);
    // Near-term = first 4 quarters (next 12 months).
    const nearTerm = points
      .slice(0, 4)
      .reduce((s, p) => s + p.deviceRevenue + p.serviceRevenue, 0);
    return { device, service, devices, tcv: device + service, nearTerm };
  }, [points]);

  // Group by year for a compact 3-column layout.
  const years = [0, 1, 2] as const;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">
          Service model:{" "}
          <span className="font-medium text-foreground">
            {SERVICE_LABEL[serviceModel]}
          </span>{" "}
          · device + service revenue tracked separately
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-background text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Quarter</th>
              <th className="px-3 py-2 font-medium">Devices</th>
              <th className="px-3 py-2 text-right font-medium">Device €</th>
              <th className="px-3 py-2 text-right font-medium">Service €</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p, idx) => (
              <tr key={idx} className="border-t border-border">
                <td className="px-3 py-1.5 text-muted">
                  {quarterLabel(p.year, p.quarter)}
                </td>
                <td className="px-3 py-1.5">
                  <input
                    type="number"
                    min={0}
                    value={p.devices}
                    onChange={(e) =>
                      updateDevices(idx, Math.max(0, Number(e.target.value)))
                    }
                    className="w-24 rounded-md border border-border bg-background px-2 py-1 text-sm focus:border-hmd-teal-600 focus:outline-none focus:ring-1 focus:ring-hmd-teal-600"
                  />
                </td>
                <td className="px-3 py-1.5 text-right text-muted">
                  {eur(p.deviceRevenue)}
                </td>
                <td className="px-3 py-1.5 text-right text-muted">
                  {eur(p.serviceRevenue)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-background font-semibold">
              <td className="px-3 py-2">Total ({num(totals.devices)} units)</td>
              <td className="px-3 py-2" />
              <td className="px-3 py-2 text-right">{eur(totals.device)}</td>
              <td className="px-3 py-2 text-right">{eur(totals.service)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Mini per-year ramp bars for a quick visual sense of the rollout */}
      <div className="grid grid-cols-3 gap-3">
        {years.map((y) => {
          const yearDevices = points
            .filter((p) => p.year === y)
            .reduce((s, p) => s + p.devices, 0);
          const max = Math.max(
            1,
            ...years.map((yy) =>
              points
                .filter((p) => p.year === yy)
                .reduce((s, p) => s + p.devices, 0),
            ),
          );
          return (
            <div key={y} className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted">Year {y + 1}</p>
              <p className="text-sm font-semibold">{num(yearDevices)} units</p>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-background">
                <div
                  className="h-full rounded-full bg-hmd-teal"
                  style={{ width: `${(yearDevices / max) * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-hmd-charcoal p-4 text-white">
          <p className="text-xs text-white/60">3-year TCV</p>
          <p className="text-xl font-semibold">{eur(totals.tcv)}</p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs text-muted">Next 12 months</p>
          <p className="text-xl font-semibold">{eur(totals.nearTerm)}</p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs text-muted">Total devices</p>
          <p className="text-xl font-semibold">{num(totals.devices)}</p>
        </div>
      </div>
    </div>
  );
}
