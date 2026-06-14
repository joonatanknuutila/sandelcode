// CSV serialisation — pure, dependency-free, Excel-friendly.
//
// Excel opens .csv natively, so we don't pull in an xlsx dependency (keeps the
// bundle lean and the path server-only). Two details make Excel happy:
//   - a UTF-8 BOM so accented EU names (München, Møller) render correctly;
//   - CRLF line endings, which Excel prefers.
// Fields are quoted only when they need it (comma, quote, newline) and embedded
// quotes are doubled, per RFC 4180.

export type CsvValue = string | number | boolean | null | undefined;

// A string field beginning with one of these is interpreted as a formula by
// Excel / Google Sheets when the CSV is opened (CSV / formula injection,
// CWE-1236). Account names, deal titles and justifications are user-entered, so
// neutralise them. Numbers/booleans are our own computed values and pass
// through untouched, keeping numeric columns summable.
const FORMULA_LEAD = /^[=+\-@\t\r]/;

/** Quote a single field if it contains a delimiter, quote or newline, after
 *  neutralising any leading formula trigger on text fields. */
function escapeField(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value !== "string") return String(value);
  // Prefix a single quote so a leading =/+/-/@ is rendered as literal text.
  const s = FORMULA_LEAD.test(value) ? `'${value}` : value;
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Serialise rows to a CSV string with a header row. `columns` fixes the order
 * and the header labels; each row is a record keyed by the same column keys.
 */
export function toCsv<T extends Record<string, CsvValue>>(
  columns: { key: keyof T & string; label: string }[],
  rows: T[],
): string {
  const header = columns.map((c) => escapeField(c.label)).join(",");
  const body = rows.map((row) =>
    columns.map((c) => escapeField(row[c.key])).join(","),
  );
  // BOM + CRLF for Excel.
  return "﻿" + [header, ...body].join("\r\n") + "\r\n";
}

/** A text/csv Response with an attachment filename — the download contract. */
export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      // This is a point-in-time snapshot — never cache it.
      "Cache-Control": "no-store",
    },
  });
}

/** Today's date as YYYY-MM-DD, for stable, sortable export filenames. */
export function stampDate(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}
