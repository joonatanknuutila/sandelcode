// HMD Secure wordmark. The HMD site is image-based, so we render a clean
// typographic lockup in HMD blue + navy rather than hotlinking their assets.

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-8 w-8 place-items-center rounded-md bg-hmd-teal font-bold text-hmd-charcoal">
        H
      </span>
      <span className={`text-base font-semibold tracking-tight ${light ? "text-white" : "text-foreground"}`}>
        HMD <span className="font-normal opacity-70">Secure</span>
      </span>
    </div>
  );
}
