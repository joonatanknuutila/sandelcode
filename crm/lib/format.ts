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

export function quarterLabel(year: 0 | 1 | 2, quarter: 1 | 2 | 3 | 4): string {
  return `Y${year + 1} Q${quarter}`;
}
