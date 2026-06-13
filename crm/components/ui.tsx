// Small presentational primitives shared across views. Kept dependency-free
// (no shadcn install needed) so the foundation stays light for the hackathon.

import { Stage, STAGE_LABELS } from "@/lib/types";

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
          className="text-xs font-medium uppercase tracking-wide text-muted"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none transition-colors focus:border-hmd-teal focus:ring-2 focus:ring-hmd-teal/40 disabled:opacity-50 ${error ? "border-danger" : ""} ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-danger">{error}</p>}
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
          className="text-xs font-medium uppercase tracking-wide text-muted"
        >
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        rows={4}
        className={`rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted outline-none transition-colors focus:border-hmd-teal focus:ring-2 focus:ring-hmd-teal/40 disabled:opacity-50 resize-y ${error ? "border-danger" : ""} ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-danger">{error}</p>}
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
          className="text-xs font-medium uppercase tracking-wide text-muted"
        >
          {label}
        </label>
      )}
      <select
        id={inputId}
        className={`rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-hmd-teal focus:ring-2 focus:ring-hmd-teal/40 disabled:opacity-50 appearance-none cursor-pointer ${error ? "border-danger" : ""} ${className}`}
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
      {error && <p className="text-xs text-danger">{error}</p>}
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
            className="text-xs font-medium uppercase tracking-wide text-muted"
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
      className={`rounded-xl border border-border bg-surface ${className}`}
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
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "warning" | "success";
}) {
  const toneClass =
    tone === "warning"
      ? "text-warning"
      : tone === "success"
        ? "text-success"
        : "text-foreground";
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </Card>
  );
}

const STAGE_TONE: Record<Stage, string> = {
  interest: "bg-slate-100 text-slate-700",
  rfi: "bg-sky-100 text-sky-700",
  rfp: "bg-indigo-100 text-indigo-700",
  customer_test: "bg-violet-100 text-violet-700",
  contract_negotiation: "bg-amber-100 text-amber-800",
  won: "bg-green-100 text-green-700",
  lost: "bg-red-100 text-red-700",
};

export function StageBadge({ stage }: { stage: Stage }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STAGE_TONE[stage]}`}
    >
      {STAGE_LABELS[stage]}
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
    default: "bg-slate-100 text-slate-700",
    blue: "bg-hmd-teal-600/10 text-hmd-teal-700",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-700",
    green: "bg-green-100 text-green-700",
  };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Button({
  children,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
}) {
  const base =
    "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors";
  const styles =
    variant === "primary"
      ? "bg-hmd-teal-600 text-white hover:bg-hmd-teal-700"
      : "border border-border bg-surface text-foreground hover:bg-background";
  return (
    <button className={`${base} ${styles}`} {...props}>
      {children}
    </button>
  );
}
