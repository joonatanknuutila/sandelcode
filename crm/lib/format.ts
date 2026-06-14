// Display helpers shared across views.

export function eur(value: number, compact = true): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  }).format(value);
}

export function num(value: number): string {
  return new Intl.NumberFormat("en-IE").format(value);
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function relativeDays(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

// The 3-year forecast is stored in RELATIVE years (0,1,2). For display we anchor
// year 0 to the current calendar year, so the horizon reads as actual years
// (e.g. 2026 Q1 … 2028 Q4) rather than Y1/Y2/Y3.
export function quarterLabel(year: 0 | 1 | 2, quarter: 1 | 2 | 3 | 4): string {
  return `${new Date().getFullYear() + year} Q${quarter}`;
}
