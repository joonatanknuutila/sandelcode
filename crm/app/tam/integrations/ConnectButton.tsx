"use client";

import { Button } from "@/components/ui";
import { toast } from "@/components/ui-client";
import type { IntegrationStatus } from "@/lib/integrations/catalog";

// ConnectButton — the per-connector CTA. No live OAuth yet, so it acknowledges
// intent via a toast and keeps the surface honest about what's wired.

export function ConnectButton({
  name,
  status,
}: {
  name: string;
  status: IntegrationStatus;
}) {
  const label = status === "beta" ? "Request beta access" : "Connect";

  function handleClick() {
    toast(
      status === "beta"
        ? `${name} — added to the beta waitlist.`
        : `${name} — connection flow coming soon.`,
      { variant: status === "beta" ? "warning" : "default" },
    );
  }

  return (
    <Button variant="secondary" className="w-full" onClick={handleClick}>
      {label}
    </Button>
  );
}
