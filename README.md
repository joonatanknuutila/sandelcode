# Sandelcode — HMD CRM hackathon orchestrator

Notion → local Claude session orchestrator for our 4-person team. This repo is **tooling**, not the product. The HMD CRM app lives in `crm/` (→ GitHub → Vercel + Supabase) and is built by the sessions this drives. **All sessions work directly on `main` in this single checkout** — the per-person worktree/branch model was retired (2026-06-13).

## Docs

- [`docs/challenge-brief.md`](docs/challenge-brief.md) — the HMD CRM brief (P0/P1/P2, personas, pipeline stages, constraints).
- [`docs/meeting-notes-2026-06-13.md`](docs/meeting-notes-2026-06-13.md) — planning meeting + client-interview findings.
- [`docs/SUPABASE.md`](docs/SUPABASE.md) — **Supabase project for the CRM demo** (`hmd-sales-hackathon`, ref `xwsmovmtfymiqvgjicfk`, eu-north-1). Creds in `.env`; MCP points here.

## How it works

```
Notion "🟢 Prompt inbox" (per person)
        │  watcher/poll.mjs polls every pollSeconds (Notion API)
        ▼
people/<name>/prompt/<timestamp>.md      (the prompt, saved locally)
        │  injects into that person's tmux pane (matched by pane TITLE)
        ▼
claude session running in the repo root on `main`  (one shared checkout)
        │
        ▼  (out) new main commits + session narration -> one Notion "team feed"
```

Each of the 4 people (Joonatan, Nuutti, Aarni, Arttu) has:
- a Notion **📝 Planning** subpage — brainstorm + draft prompts
- a Notion **🟢 Prompt inbox** subpage — paste the final prompt here to fire the session
- a local `people/<name>/prompt/` inbox
- a named **tmux pane** (title = their name) where their Claude session runs, all on `main`
- a kickoff prompt in `prompts/<name>.md`

Because all 4 sessions share one working tree on `main`, the **lanes** (each person edits disjoint folders) are what keep them from stepping on each other. Outbound feeds (commits + narration) are consolidated to a single team feed page since they can't be attributed per-person on a shared branch.

## Setup (once)

1. **Notion integration token:** https://www.notion.so/profile/integrations → New integration (Internal) → copy the `ntn_…` token.
2. Share each **🟢 Prompt inbox** page with the integration: open page → ••• → **Connections** → connect it. (4 pages.)
3. `cp .env.example .env` and paste the token into `NOTION_TOKEN`.
4. Launch the 4 Claude panes (one tmux grid, all on `main`):
   ```bash
   ./start-sessions.sh   # then: tmux attach -t hmd
   ```
5. Start the watcher in another terminal:
   ```bash
   npm run watch        # = node --env-file=.env watcher/poll.mjs
   ```

## Daily use

- Person brainstorms in their Notion Planning page → drafts a prompt → pastes it into their Prompt inbox.
- The watcher writes it to `people/<name>/prompt/` and injects it into their tmux pane (Claude session on `main`).
- Watch `watcher/poll.log` for activity.

## Notes

- Delivery is **polling**, not raw webhooks — a local machine has no public URL. Cadence = `pollSeconds` in `watcher/config.json`.
- Sessions run **interactively** in tmux panes; the poller pastes each new Notion prompt into the matching pane (by title) and submits it, keeping context across prompts.
- Prompt files are gitignored (local/per-machine).
- All 4 sessions share one checkout on `main` — discipline is by **lane** (disjoint folders), not by branch isolation.
- Kickoff prompts in `prompts/` define each person's lane (work split: Arttu=backend/Supabase, Joonatan=frontend/brand/Rep, Nuutti=TAM/SM/Finance/offers, Aarni=AI agents/seed data).
