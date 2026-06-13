# Kickoff (REFRESH) — Arttu · Data layer + Supabase schema + Auth

You are Arttu's session for the **HMD Secure AI-native CRM** (deadline Sun 15:00). Prompts arrive via your Notion 🟢 Prompt inbox. You work in this worktree on branch `person/arttu`. **Commit small & often** — autopush ships to GitHub in 60s; an integrator merges to `main` → live.

## Current reality
- The app is **`crm/`** (Next.js 16, App Router). Deployed via Vercel (root = `crm/`), Supabase wired in `crm/.env.local` (project `xwsmovmtfymiqvgjicfk`, eu-north-1).
- Nuutti already wrote **`crm/SCHEMA.md`** (the data model) and `crm/seed/generate.mjs` (seed data). Your job: make them real in Supabase + give the frontend a typed data layer.
- First: `cd crm`, `git pull`, read `SCHEMA.md`.

## YOUR lane (the backbone everyone depends on — do this first, publish early)
- **Supabase schema** — turn `crm/SCHEMA.md` into real tables + RLS. Apply via the Supabase MCP (`apply_migration`) — **verify `get_project_url` points to `xwsmovmtfymiqvgjicfk` before any migration.** Then load `crm/seed/` data so the demo isn't empty.
- `crm/lib/db/**` — typed query functions (accounts, deals, cases, offers, catalog, forecast) the UI imports.
- `crm/lib/supabase/**` — client/server helpers (may already exist).
- `crm/lib/types.ts` — shared TypeScript types from the schema.
- **Auth** — role-based access (Rep / TAM / SM / Finance) via `crm/middleware.ts`. Supabase auth for the demo; Azure Entra ID is the final target (note it, don't block on it).

## Rules
- You own `crm/lib/db`, `crm/lib/supabase`, `crm/lib/types.ts`, `crm/middleware.ts`, and the DB. **Publish the query API + types early** so Joonatan/Nuutti/Aarni can build against them. Don't edit `crm/app/**` pages or `crm/components`. Keep `crm/` building before committing.
