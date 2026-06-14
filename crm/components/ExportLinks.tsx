// "Export CSV" affordance — plain download anchors, no client JS needed.
// Hits the deterministic /api/export/* route handlers (text/csv attachments).
// Excel opens the CSV natively; this is export only (the brief excludes import).

const KINDS = {
  pipeline: { href: "/api/export/pipeline", label: "Export pipeline CSV" },
  cases: { href: "/api/export/cases", label: "Export cases CSV" },
} as const;

export type ExportKind = keyof typeof KINDS;

export function ExportLinks({ kinds }: { kinds: ExportKind[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {kinds.map((kind) => {
        const { href, label } = KINDS[kind];
        return (
          <a
            key={kind}
            href={href}
            download
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-hmd-teal-600"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {label}
          </a>
        );
      })}
    </div>
  );
}
