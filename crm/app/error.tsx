"use client";

// App-level error boundary (§0.4) — catches unexpected render errors in any
// route segment and shows a calm, branded fallback instead of the raw red
// "An error occurred in the Server Components render" banner. Error boundaries
// must be Client Components.

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to the server logs for debugging without leaking to the user.
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-hmd-teal/15 text-2xl">
        ⚠️
      </div>
      <h2 className="text-2xl font-semibold tracking-tight">Something didn&apos;t load</h2>
      <p className="text-base text-muted">
        We hit a snag rendering this page. Nothing was lost — try again, and if it keeps
        happening let us know.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="inline-flex min-h-11 items-center rounded-md bg-hmd-teal px-5 py-2.5 text-base font-medium text-hmd-teal-700 hover:bg-hmd-teal/90"
      >
        Try again
      </button>
    </div>
  );
}
