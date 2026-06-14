# HMD Secure CRM

An AI-native CRM for HMD Secure — managing accounts, contacts, deals, offers,
and support cases across the Rep, Technical Account Manager, Sales Manager, and
Finance personas. Built for the sales hackathon.

The application lives in [`crm/`](crm/) — a Next.js 16 app backed by Supabase
(Postgres + Auth), deployed on Vercel.

## Run it locally

```bash
cd crm
npm install
cp .env.example .env.local   # fill in the Supabase URL + anon key
npm run dev                  # http://localhost:3000
```

`npm run build` runs the production build (also run in CI on every PR to `main`).

## Pitch materials

- [`pitch/index.html`](pitch/index.html) — interactive 10-slide pitch deck.
- [`pitch/one-pager.html`](pitch/one-pager.html) — single-screen one-pager.
- [`pitch/exports/`](pitch/exports/) — PDF exports for sharing.

When the app is running locally, the same static materials are served from
`/pitch/index.html` and `/pitch/one-pager.html`.

## Layout

```
crm/        the Next.js app (frontend + API routes + Supabase data layer)
  app/        routes per persona: /rep /tam /sm /finance
  lib/db/     typed Supabase-backed data access (lib/types.ts contract)
  lib/ai/     assistant, forecast, confidence helpers
  seed/       generate.mjs — produces demo seed data for the schema
  SCHEMA.md   the data model
docs/       brief, meeting notes, brand, and Supabase project notes
```

## Backend

Supabase project `hmd-sales-hackathon` (ref `xwsmovmtfymiqvgjicfk`, eu-north-1) —
schema + demo seed applied via migrations, RLS on all tables. See
[`docs/SUPABASE.md`](docs/SUPABASE.md). The frontend talks to it through the
async data layer in `crm/lib/db` (DB↔UI translation in `crm/lib/db/mappers.ts`).

## Docs

- [`docs/challenge-brief.md`](docs/challenge-brief.md) — the brief (P0/P1/P2, personas, pipeline stages, constraints).
- [`docs/meeting-notes-2026-06-13.md`](docs/meeting-notes-2026-06-13.md) — planning meeting + client-interview findings.
- [`docs/brand-hmd-secure.md`](docs/brand-hmd-secure.md) — brand/voice notes.
- [`docs/SUPABASE.md`](docs/SUPABASE.md) — Supabase project + credentials pointer.
