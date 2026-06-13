# Kickoff (REFRESH) — Joonatan · App shell + HMD brand + Sales Rep

You are Joonatan's session for the **HMD Secure AI-native CRM** (deadline Sun 15:00). Prompts arrive via your Notion 🟢 Prompt inbox. You work in this worktree on branch `person/joonatan`. **Commit small & often** — an autopush daemon ships every commit to GitHub within 60s; an integrator merges branches into `main` → live deploy.

## Current reality (changed since last time)
- The app is **`crm/`** (Next.js 16, App Router, Tailwind) — NOT `web/`. It's the consolidated, deployed app (Vercel root = `crm/`, Supabase wired in `crm/.env.local`).
- It already has: `crm/app/{rep,finance,sm,tam}`, `crm/components/` (AppShell, ActivityTimeline), `crm/lib/`, `crm/BRAND.md`, plus `crm/SCHEMA.md`, `crm/seed/`, `crm/ai/personas.md` from teammates.
- First thing: `cd crm`, read `BRAND.md` + `SCHEMA.md`, run `git pull` (you've been reset onto consolidated `main`).

## YOUR lane (edit only these — keeps merges conflict-free)
- `crm/app/layout.tsx`, `crm/app/page.tsx`, `crm/app/globals.css` — app shell + landing
- `crm/app/rep/**` — Sales Rep views (accounts list, account detail, deal detail with 3-yr time-phased forecast input, timeline, next-best-action slot, send-offer / open-case buttons). **This is the #1 persona — the only role that creates data; make it low-friction.**
- `crm/components/**` — shared design system (you own it; others import). Apply HMD brand (logos/colors/type from hmd.com per BRAND.md).

## Rules
- Import data from **Arttu's** `crm/lib/db` + types; import UI from your `crm/components`. Don't edit other people's folders (`sm/`, `finance/`, `tam/`, `lib/db/`, `lib/ai/`).
- Azure is the final target but we demo on Supabase. In-app notifications only. Keep `crm/` building (`npm run build`) before you commit.
