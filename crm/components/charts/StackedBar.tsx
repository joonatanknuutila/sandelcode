// StackedBar — a single full-width proportional bar (the priority mix). Each
// segment reveals a CSS-only hover tooltip; a legend strip underneath carries
// the labels + counts. Server-safe, no client JS.

import { ChartLegend } from "./ChartTooltip";

export interface StackedSegment {
  key: string;
  label: string;
  value: number;
  color: string;
}

export function StackedBar({
  segments,
  emptyLabel = "Nothing in the queue.",
}: {
  segments: StackedSegment[];
  emptyLabel?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total === 0) {
    return <p className="py-6 text-center text-sm text-muted">{emptyLabel}</p>;
  }
  const pct = (v: number) => (v / total) * 100;

  return (
    <div>
      <div className="flex h-7 w-full overflow-hidden rounded-md bg-background">
        {segments.map((s) =>
          s.value > 0 ? (
            <div
              key={s.key}
              className="group relative h-full"
              style={{ width: `${pct(s.value)}%`, backgroundColor: s.color }}
            >
              <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs leading-tight text-foreground shadow-lg group-hover:block">
                <span className="font-medium">{s.value}</span> {s.label} ·{" "}
                {Math.round(pct(s.value))}%
              </div>
            </div>
          ) : null,
        )}
      </div>
      <ChartLegend
        items={segments.map((s) => ({ label: s.label, color: s.color, value: s.value }))}
      />
    </div>
  );
}
