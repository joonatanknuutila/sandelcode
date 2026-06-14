// HBars — a list of labelled, stacked horizontal bars (the account hotspots).
// Bars share one scale (`max`) so lengths compare across rows. Pure CSS
// group-hover reveals a per-row breakdown tooltip, so this stays a server
// component — no client JS needed.

export interface HBarSegment {
  key: string;
  label: string;
  value: number;
  color: string;
}

export interface HBarRow {
  id: string;
  label: string;
  total: number;
  segments: HBarSegment[];
}

export function HBars({
  rows,
  max,
  emptyLabel = "No open cases — all accounts clear.",
}: {
  rows: HBarRow[];
  max: number;
  emptyLabel?: string;
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted">{emptyLabel}</p>;
  }
  const scale = (v: number) => (max > 0 ? (v / max) * 100 : 0);

  return (
    <div className="space-y-2.5">
      {rows.map((row) => (
        <div
          key={row.id}
          className="group grid grid-cols-[6.5rem_1fr_1.75rem] items-center gap-3 text-sm sm:grid-cols-[8rem_1fr_1.75rem]"
        >
          <span className="truncate text-muted" title={row.label}>
            {row.label}
          </span>

          <div className="relative h-5">
            <div className="flex h-full w-full overflow-hidden rounded bg-background">
              {row.segments.map((s) =>
                s.value > 0 ? (
                  <div
                    key={s.key}
                    className="h-full"
                    style={{ width: `${scale(s.value)}%`, backgroundColor: s.color }}
                  />
                ) : null,
              )}
            </div>

            {/* Hover breakdown — pure CSS, anchored above the bar. */}
            <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs leading-tight text-foreground shadow-lg group-hover:block">
              <div className="font-medium">{row.label}</div>
              <div className="mt-1 flex gap-2.5">
                {row.segments.map((s) => (
                  <span key={s.key} className="flex items-center gap-1">
                    <span
                      aria-hidden
                      className="inline-block h-2 w-2 rounded-sm"
                      style={{ backgroundColor: s.color }}
                    />
                    {s.value} {s.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <span className="text-right font-medium tabular-nums text-foreground">
            {row.total}
          </span>
        </div>
      ))}
    </div>
  );
}
