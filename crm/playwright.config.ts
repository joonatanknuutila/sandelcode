import { defineConfig, devices } from "@playwright/test";

// Acceptance / "what good looks like" eval suite (brief §07).
//
// Targets a RUNNING build — the deployed prod alias by default, or a local
// `next dev` via EVAL_BASE_URL=http://localhost:3000. The suite is designed to
// pass with NO AI keys (deterministic fallbacks); any AI-dependent assertion
// checks the honest modelUsed:false state instead of a fabricated one.
//
// Run:  npm run eval            (read-only / structural acceptance — non-destructive)
//       EVAL_MUTATE=1 npm run eval   (also drives the create/approve round-trips)

const BASE_URL =
  process.env.EVAL_BASE_URL ?? "https://web-teal-xi-17.vercel.app";

export default defineConfig({
  testDir: "./e2e",
  // Serial + patient: a cold serverless start can be slow on first hit.
  fullyParallel: false,
  workers: 1,
  retries: 2,
  timeout: 45_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    headless: true,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
