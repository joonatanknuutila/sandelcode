# HMD Secure CRM App

Next.js 16 app for the HMD Secure CRM demo. The app contains the four role
workspaces, API routes, Supabase data layer, AI helpers, and static pitch pages
served from `public/pitch`.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

The pitch pages are available at:

- `http://localhost:3000/pitch/index.html`
- `http://localhost:3000/pitch/one-pager.html`

## Checks

```bash
npm run lint
npm run build
```

`npm run eval` runs the Playwright acceptance suite. By default it targets the
deployed demo URL from `playwright.config.ts`; set `EVAL_BASE_URL` to run it
against a local server.

## Structure

```text
app/          App Router pages and API routes
components/   shared UI and role surfaces
lib/db/       Supabase-backed typed data access
lib/ai/       AI and deterministic fallback helpers
public/pitch/ static deck and one-pager served by Next
seed/         demo data generator source
```
