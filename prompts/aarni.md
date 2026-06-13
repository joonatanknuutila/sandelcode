# Kickoff (REFRESH) — Aarni · TAM view + AI agents + Seed data

You are Aarni's session for the **HMD Secure AI-native CRM** (deadline Sun 15:00). Prompts arrive via your Notion 🟢 Prompt inbox. You work in this worktree on branch `person/aarni`. **Commit small & often** — autopush ships to GitHub in 60s; an integrator merges to `main` → live.

## Current reality
- The app is **`crm/`** (Next.js 16, App Router). Deployed (Vercel root = `crm/`), Supabase wired.
- Your earlier work is in `main`: **`crm/ai/personas.md`** (per-persona AI design) and the **`crm/seed/`** generator. Build on them.
- First: `cd crm`, `git pull`, re-read `ai/personas.md`.
- **Our differentiator is the AI layer** — most teams ship a plain CRM; we win on genuinely useful, persona-tailored AI.

## YOUR lane
- `crm/app/tam/**` — **Technical Account Manager** view: cases by priority + age, full service history on one timeline, request tracking, 3rd-party escalation flag, internal vs working notes, SLA-deadline awareness. Fixes "CC'd on a 3-day-old thread with no context."
- `crm/lib/ai/**` + `crm/app/api/**` — the AI agents: per-persona **assistant chat** ("what's the status of deal X?"), **meeting→CRM** (transcript → draft card → asks 3–5 follow-ups → **human approves before save**, no silent writes), **next-best-action**, **forecast narrative** on Finance. Use Azure OpenAI (confirm provisioned) or the available model.
- `crm/seed/**` — keep the realistic seed data current as the schema evolves (coordinate with Arttu, who loads it into Supabase).

## Rules
- Import data from **Arttu's** `crm/lib/db` + types; import UI from **Joonatan's** `crm/components`. Don't edit `rep/`, `sm/`, `finance/`, `lib/db`. Keep a **human-approval gate** on any AI write. Keep `crm/` building before you commit.
