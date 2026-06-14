"use client";

// Finance CSV target import. Parses `period,amount` rows client-side, shows a
// preview (valid + rejected rows), then upserts the valid ones through the
// importTargetsAction server action. Read-only until the user clicks Import —
// no silent writes (the house rule the rest of the app follows).

import { useRef, useState, useTransition } from "react";
import { Button, Card, SectionTitle } from "@/components/ui";
import { eur } from "@/lib/format";
import {
  importTargetsAction,
  type ImportResult,
  type TargetRow,
} from "@/app/finance/import-actions";

const PERIOD_RE = /^\d{4}-Q[1-4]$/;

interface Parsed {
  valid: TargetRow[];
  invalid: { line: string; reason: string }[];
}

/** Tolerant CSV parse: skips a header row, rejoins stray comma-split thousands
 *  in the amount, validates the period + amount. */
function parseCsv(text: string): Parsed {
  const valid: TargetRow[] = [];
  const invalid: { line: string; reason: string }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const cols = line.split(",").map((c) => c.trim());
    if (/period/i.test(cols[0]) && /amount|target|eur/i.test(cols.slice(1).join(" "))) continue;
    const period = (cols[0] ?? "").toUpperCase();
    const amount = Number(cols.slice(1).join("").replace(/[^\d.]/g, ""));
    if (!PERIOD_RE.test(period)) {
      invalid.push({ line, reason: "period must be YYYY-Qn (e.g. 2026-Q1)" });
      continue;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      invalid.push({ line, reason: "amount must be a positive number" });
      continue;
    }
    valid.push({ period, amountEur: amount });
  }
  return { valid, invalid };
}

export function TargetImport() {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function ingest(next: string) {
    setText(next);
    setResult(null);
    setParsed(next.trim() ? parseCsv(next) : null);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    ingest(await file.text());
  }

  function onImport() {
    if (!parsed || parsed.valid.length === 0) return;
    startTransition(async () => {
      const res = await importTargetsAction(parsed.valid);
      setResult(res);
    });
  }

  function reset() {
    setText("");
    setParsed(null);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <Card className="p-4">
      <SectionTitle>Import targets (CSV)</SectionTitle>
      <p className="-mt-1 mb-3 text-xs text-muted">
        One row per quarter: <code className="text-foreground">period,amount</code> — e.g.{" "}
        <code className="text-foreground">2026-Q1,1500000</code>. Existing quarters are overwritten.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={onFile}
          className="block text-sm text-muted file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-md file:border-0 file:bg-hmd-teal file:px-3 file:py-2 file:text-sm file:font-medium file:text-hmd-teal-700"
        />
        <span className="text-xs text-muted">or paste below</span>
      </div>

      <textarea
        value={text}
        onChange={(e) => ingest(e.target.value)}
        rows={4}
        placeholder={"period,amount\n2026-Q1,1500000\n2026-Q2,1800000"}
        className="mt-3 w-full resize-y rounded-md border border-border bg-surface px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted outline-none focus:border-hmd-teal focus:ring-2 focus:ring-hmd-teal/30"
      />

      {parsed && (
        <div className="mt-3 rounded-md border border-border bg-background p-3 text-sm">
          <p className="text-foreground">
            <span className="font-semibold text-success">{parsed.valid.length}</span> valid
            {parsed.invalid.length > 0 && (
              <>
                {" · "}
                <span className="font-semibold text-danger">{parsed.invalid.length}</span> rejected
              </>
            )}
          </p>
          {parsed.valid.length > 0 && (
            <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted sm:grid-cols-3">
              {parsed.valid.slice(0, 12).map((r) => (
                <li key={r.period}>
                  <span className="text-foreground">{r.period}</span> {eur(r.amountEur)}
                </li>
              ))}
              {parsed.valid.length > 12 && <li>+{parsed.valid.length - 12} more…</li>}
            </ul>
          )}
          {parsed.invalid.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-danger">
              {parsed.invalid.slice(0, 5).map((r, i) => (
                <li key={i}>
                  <span className="font-mono">{r.line}</span> — {r.reason}
                </li>
              ))}
              {parsed.invalid.length > 5 && <li>+{parsed.invalid.length - 5} more rejected…</li>}
            </ul>
          )}
        </div>
      )}

      {result && (
        <p className="mt-3 text-sm">
          <span className="font-semibold text-success">Imported {result.imported}</span> target
          {result.imported === 1 ? "" : "s"}.
          {result.failed.length > 0 && (
            <span className="text-danger"> {result.failed.length} failed.</span>
          )}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <Button onClick={onImport} disabled={pending || !parsed || parsed.valid.length === 0}>
          {pending
            ? "Importing…"
            : parsed
              ? `Import ${parsed.valid.length} target${parsed.valid.length === 1 ? "" : "s"}`
              : "Import"}
        </Button>
        {(text || result) && (
          <Button variant="secondary" onClick={reset} disabled={pending}>
            Clear
          </Button>
        )}
      </div>
    </Card>
  );
}
