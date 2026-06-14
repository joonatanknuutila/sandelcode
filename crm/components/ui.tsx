// Small presentational primitives shared across views. Kept dependency-free
// (no shadcn install needed) so the foundation stays light for the hackathon.

import { Stage, STAGE_LABELS, REP_STAGE_LABELS } from "@/lib/types";

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
export function Input({
  label,
  error,
  className = "",
  id,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  id?: string;
}) {
  const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium uppercase tracking-wide text-muted"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`min-h-11 rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none transition-colors focus:border-hmd-teal focus:ring-2 focus:ring-hmd-teal/30 disabled:opacity-50 ${error ? "border-danger" : ""} ${className}`}
        {...props}
      />
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Textarea
// ---------------------------------------------------------------------------
export function Textarea({
  label,
  error,
  className = "",
  id,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string;
  id?: string;
}) {
  const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium uppercase tracking-wide text-muted"
        >
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        rows={4}
        className={`resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none transition-colors focus:border-hmd-teal focus:ring-2 focus:ring-hmd-teal/30 disabled:opacity-50 ${error ? "border-danger" : ""} ${className}`}
        {...props}
      />
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Select
// ---------------------------------------------------------------------------
export function Select({
  label,
  error,
  options,
  placeholder,
  className = "",
  id,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  id?: string;
}) {
  const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium uppercase tracking-wide text-muted"
        >
          {label}
        </label>
      )}
      <select
        id={inputId}
        className={`min-h-11 cursor-pointer appearance-none rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-hmd-teal focus:ring-2 focus:ring-hmd-teal/30 disabled:opacity-50 ${error ? "border-danger" : ""} ${className}`}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slider
// ---------------------------------------------------------------------------
export function Slider({
  label,
  value,
  formatValue,
  className = "",
  id,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  value?: number | string;
  formatValue?: (v: number) => string;
  id?: string;
}) {
  const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);
  const numVal = typeof value === "string" ? parseFloat(value) : (value ?? 0);
  const display = formatValue ? formatValue(numVal) : String(numVal);
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <div className="flex items-center justify-between">
          <label
            htmlFor={inputId}
            className="text-sm font-medium uppercase tracking-wide text-muted"
          >
            {label}
          </label>
          <span className="rounded bg-hmd-teal px-1.5 py-0.5 text-xs font-semibold text-hmd-teal-700">
            {display}
          </span>
        </div>
      )}
      <input
        id={inputId}
        type="range"
        value={value}
        className={`h-2 w-full cursor-pointer appearance-none rounded-full bg-border accent-hmd-teal [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-hmd-teal [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-hmd-teal-700 ${className}`}
        {...props}
      />
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-border bg-surface ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
      {children}
    </h2>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone = "default",
  large = false,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "warning" | "success";
  /** Rep-facing: bigger label/value/hint for at-a-glance reading. */
  large?: boolean;
}) {
  const toneClass =
    tone === "warning"
      ? "text-warning"
      : tone === "success"
        ? "text-success"
        : "text-foreground";
  return (
    <Card className={large ? "p-5" : "p-4"}>
      <p className={`font-medium uppercase tracking-wide text-muted ${large ? "text-sm" : "text-xs"}`}>
        {label}
      </p>
      <p className={`mt-1 font-semibold ${large ? "text-3xl" : "text-2xl"} ${toneClass}`}>{value}</p>
      {hint && <p className={`mt-1 text-muted ${large ? "text-sm" : "text-xs"}`}>{hint}</p>}
    </Card>
  );
}

const STAGE_TONE: Record<Stage, string> = {
  interest: "border-border bg-background text-muted",
  rfi: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  rfp: "border-indigo-400/30 bg-indigo-400/10 text-indigo-200",
  customer_test: "border-violet-400/30 bg-violet-400/10 text-violet-200",
  contract_negotiation: "border-amber-400/35 bg-amber-400/10 text-amber-200",
  won: "border-green-400/35 bg-green-400/10 text-green-200",
  lost: "border-red-400/35 bg-red-400/10 text-red-200",
};

export function StageBadge({
  stage,
  plain = false,
}: {
  stage: Stage;
  /** Rep-facing: plain-language stage label + slightly larger text. */
  plain?: boolean;
}) {
  const labels = plain ? REP_STAGE_LABELS : STAGE_LABELS;
  return (
    <span
      className={`inline-block rounded-full border px-2.5 ${
        plain ? "py-1 text-sm" : "py-0.5 text-xs"
      } font-medium ${STAGE_TONE[stage]}`}
    >
      {labels[stage]}
    </span>
  );
}

export function Badge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "blue" | "amber" | "red" | "green";
}) {
  const tones = {
    default: "border-border bg-background text-muted",
    blue: "border-hmd-teal/30 bg-hmd-teal/10 text-foreground",
    amber: "border-amber-400/35 bg-amber-400/10 text-amber-200",
    red: "border-red-400/35 bg-red-400/10 text-red-200",
    green: "border-green-400/35 bg-green-400/10 text-green-200",
  };
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-sm font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
}) {
  const base =
    "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";
  const styles =
    variant === "primary"
      ? "bg-hmd-teal text-hmd-teal-700 hover:bg-hmd-teal/90"
      : "border border-border bg-surface text-foreground hover:bg-background";
  return (
    <button className={`${base} ${styles} ${className}`} {...props}>
      {children}
    </button>
  );
}
