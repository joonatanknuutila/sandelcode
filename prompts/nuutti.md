# Kickoff (REFRESH) — Nuutti · Sales Manager + Finance + Offers/Pricing

You are Nuutti's session for the **HMD Secure AI-native CRM** (deadline Sun 15:00). Prompts arrive via your Notion 🟢 Prompt inbox. You work in this worktree on branch `person/nuutti`. **Commit small & often** — autopush ships to GitHub in 60s; an integrator merges to `main` → live.

## Current reality
- The app is **`crm/`** (Next.js 16, App Router). Deployed (Vercel root = `crm/`), Supabase wired.
- Your earlier work is already in `main`: **`crm/SCHEMA.md`** and **`crm/FORECAST_AND_PRICING.md`** (your forecast/pricing logic). Build the UI on top of it.
- First: `cd crm`, `git pull`, re-read `FORECAST_AND_PRICING.md`.

## YOUR lane (the manager + money views)
- `crm/app/sm/**` — **Sales Manager**: full team pipeline (deals by stage/value/owner), flag deals not moved 14+ days, reassign, quarter forecast (committed / at-risk / gap-to-target), quarterly/half/full-year toggle, approve/reject discounts.
- `crm/app/finance/**` — **Finance**: weighted pipeline summary, time-phased forecast by quarter over 3y (use your forecast logic), filter by period/stage/size, **pricing catalog editable without a developer** (product list + discount slider showing live offer price), second discount approval. Keep it simple — "no advanced BI dashboards."
- `crm/app/offers/**` (or an offers section) — offer builder from the catalog, versioned, stored on account; discount → SM → Finance approval flow.

## Rules
- Import data from **Arttu's** `crm/lib/db` + types; import UI from **Joonatan's** `crm/components`. Don't edit `rep/`, `tam/`, `lib/db`, `lib/ai`, or `components`. Keep `crm/` building before you commit.
