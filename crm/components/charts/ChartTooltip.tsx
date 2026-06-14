// Shared, presentational chart bits — a floating tooltip and a legend strip.
// No hooks, so these are safe to import from either server or client charts.
// Colours come in as resolved CSS values (theme tokens like "var(--danger)").

import type { CSSProperties, ReactNode } from "react";

/**
 * A floating tooltip. Place inside a `relative` container; `x`/`y` are CSS
 * lengths (px number or a "%" string) measured from that container's top-left.
 * Anchored bottom-centre by default so it sits just above the hovered point.
 */
export function ChartTip({
  x,
  y,
  children,
}: {
  x: number | string;
  y: number | string;
  children: ReactNode;
}) {
  const style: CSSProperties = { left: x, top: y };
  return (
    <div
      style={style}
      className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs leading-tight text-foreground shadow-lg"
    >
      {children}
    </div>
  );
}

export interface LegendItem {
  label: string;
  color: string;
  value?: string | number;
}

/** A wrapping row of colour-chip legend entries. */
export function ChartLegend({ items }: { items: LegendItem[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5 text-xs text-muted">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
            style={{ backgroundColor: it.color }}
          />
          {it.label}
          {it.value != null && (
            <span className="font-medium text-foreground">{it.value}</span>
          )}
        </span>
      ))}
    </div>
  );
}
