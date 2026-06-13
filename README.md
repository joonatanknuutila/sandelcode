# Sandelcode — HMD CRM hackathon orchestrator

Notion → local Claude session orchestrator for our 4-person team. This repo is **tooling**, not the product. The HMD CRM app lives in a separate repo (→ GitHub → Vercel + Supabase/Azure) built by the sessions this drives.

## How it works

```
Notion "🟢 Prompt inbox" (per person)
        │  watcher/poll.mjs polls every 30s (Notion API)
        ▼
people/<name>/prompt/<timestamp>.md      (the prompt, saved locally)
        │  spawns
        ▼
claude -p --continue "<prompt>"  inside  worktrees/<name>  (branch person/<name>)
```

Each of the 4 people (Joonatan, Nuutti, Aarni, Arttu) has:
- a Notion **📝 Planning** subpage — brainstorm + draft prompts
- a Notion **🟢 Prompt inbox** subpage — paste the final prompt here to fire the session
- a local `people/<name>/prompt/` inbox + `people/<name>/planning/` mirror
- an isolated git **worktree** where their headless Claude session runs
- a kickoff prompt in `prompts/<name>.md`

## Setup (once)

1. **Notion integration token:** https://www.notion.so/profile/integrations → New integration (Internal) → copy the `ntn_…` token.
2. Share each **🟢 Prompt inbox** page with the integration: open page → ••• → **Connections** → connect it. (4 pages.)
3. `cp .env.example .env` and paste the token into `NOTION_TOKEN`.
4. Make the first commit so worktrees can be created:
   ```bash
   git add -A && git commit -m "scaffold orchestrator"
   ```
5. Start the watcher:
   ```bash
   npm run watch        # = node --env-file=.env watcher/poll.mjs
   ```

## Daily use

- Person brainstorms in their Notion Planning page → drafts a prompt → pastes it into their Prompt inbox.
- Within 30s the watcher writes it to `people/<name>/prompt/` and runs their Claude session in `worktrees/<name>`.
- Watch `watcher/poll.log` for activity.

## Notes

- Delivery is **polling**, not raw webhooks — a local machine has no public URL. 30s cadence.
- Sessions run **headless** (`claude -p --continue`) so a script can feed them; `--continue` keeps each person's context across prompts.
- Prompt files and worktrees are gitignored (local/per-machine).
- Kickoff prompts in `prompts/` define each person's lane (work split: Arttu=backend/Azure, Joonatan=frontend/brand/Rep, Nuutti=TAM/SM/Finance/offers, Aarni=AI agents/seed data).
