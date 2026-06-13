# HANDOFF — HMD Secure CRM hackathon (read this first)

Single source of truth for the build + the orchestration around it. Written so work can
continue after a conversation compaction. Date: 2026-06-13 (deadline **Sun 15:00**, prize €1k).

---

## 1. What this repo is

Two things live here:
- **`crm/`** — the actual product: HMD Secure's **AI-native CRM** (Next.js 16, App Router, Tailwind, Supabase). This is what gets judged + deployed.
- **Everything else** — the **orchestrator**: a Notion→Claude pipeline that lets a 4-person (mostly non-dev) team build the CRM by writing plain-language prompts in Notion.

`sandelcode` is its own git repo (root `/Users/joonatanknuutila/sandelcode`). The home dir is *also* a git repo — ignore that; we work only in `sandelcode`.

---

## 2. Live links / key facts

| | |
|---|---|
| 🌐 Live site (prod) | https://web-teal-xi-17.vercel.app  (title "HMD Secure CRM") |
| 💻 GitHub | https://github.com/joonatanknuutila/sandelcode (private) |
| 🗄️ Supabase | project `xwsmovmtfymiqvgjicfk`, region `eu-north-1`, dashboard: https://supabase.com/dashboard/project/xwsmovmtfymiqvgjicfk |
| 🎥 Team Meet (screen-share) | https://meet.google.com/pdk-htxx-ehx |
| Vercel project | `web` under team `joonatanknuutila-4686s-projects`, **rootDirectory = `crm`** |
| GitHub collaborators (admin) | `Til0mi`, `nuuttiyt` |
| Brief / personas | Sales Rep · Technical Account Manager (TAM) · Sales Manager · Finance |

**Secrets** live only in `.env` (gitignored) and Vercel project env. Never print them on stream / commit them.

---

## 3. The team + lanes (who edits what — keeps merges conflict-free)

| Person | Lane | Folders they own (edit only these) | Branch |
|---|---|---|---|
| **Joonatan** | App shell + HMD brand + Sales Rep | `crm/app/rep`, `crm/app/layout.tsx`, `crm/app/page.tsx`, `crm/app/globals.css`, `crm/components` | `person/joonatan` |
| **Arttu** | Data layer + Supabase schema + auth | `crm/lib/db`, `crm/lib/supabase`, `crm/lib/types.ts`, `crm/middleware.ts`, Supabase schema | `person/arttu` |
| **Nuutti** | Sales Manager + Finance + offers/pricing | `crm/app/sm`, `crm/app/finance`, offers | `person/nuutti` |
| **Aarni** | TAM view + AI agents + seed data | `crm/app/tam`, `crm/lib/ai`, `crm/app/api`, `crm/seed` | `person/aarni` |

Design docs in `crm/`: `SCHEMA.md`, `FORECAST_AND_PRICING.md` (Nuutti), `ai/personas.md` (Aarni), `BRAND.md` (Joonatan).
Kickoff prompts (current, lane-accurate): `prompts/<name>.md`.

---

## 4. How the pipeline works

```
Person writes plain-language prompt in their Notion "🟢 Prompt inbox"
   │  watcher/poll.mjs polls every 2s (Notion API, token in .env)
   ▼
people/<name>/prompt/<ts>.md  +  tmux paste-injects into that person's pane
   ▼
Claude session (tmux 2x2 grid, session "hmd") builds it in worktrees/<name> on person/<name>
   ▼
session commits  →  autopush.sh pushes person/* to GitHub every 60s
   ▼
[merge person/* → main]  (currently MANUAL: PR + click, or integrator)
   ▼
Vercel auto-deploys main (root=crm) → live site
```

- **tmux**: session `hmd`, one window `grid`, 4 panes (joonatan/arttu/nuutti/aarni), labeled by worktree. Mouse mode ON. Poller targets panes **by worktree path** (not pane id), so it survives layout changes.
- **Notion IDs**: see §6.

---

## 5. Runbook (commands)

```bash
cd ~/sandelcode

# --- start the 4 visible sessions as a 2x2 grid (seeded with kickoff prompts) ---
./start-sessions.sh
tmux attach -t hmd          # Ctrl-b z = zoom a pane, arrows = switch, Ctrl-b d = detach

# --- the Notion → pane poller (MUST be running for the pipeline) ---
nohup node --env-file=.env watcher/poll.mjs > watcher/poll.out 2>&1 &   # start
tail -f watcher/poll.log                                                # watch
pkill -f watcher/poll.mjs                                               # stop
#  config: watcher/config.json (pollSeconds, person→notion-page-id→worktree map)

# --- keep GitHub continuously synced (push person/* every 60s) ---
nohup ./autopush.sh 60 > watcher/autopush.log 2>&1 &

# --- re-seed a session after editing prompts/<name>.md ---
#   send /clear to the pane, then load-buffer + paste-buffer the prompt file + Enter
#   (panes map by worktree: joonatan/arttu/nuutti/aarni)

# --- build / run the CRM locally ---
cd crm && npm install && npm run dev      # needs crm/.env.local (Supabase vars)
npm run build                              # CI also runs this on PRs
```

**Poller died before** because the hackathon wifi dropped (Notion `fetch failed`) and nothing
supervised the process. The code *survives* transient drops (errors caught per-person); the death
was the process being killed. If the pipeline goes dark, just restart the poller (command above).

---

## 6. Notion IDs

Root "Sales hackathon": `37ea330fb64980ab930ff9c5461524d9`
- 🧭 Project Hub (team start page): `37ea330fb64981639560dd3e8407cc5b`
- ❓ Questions for HMD: `37ea330fb6498122a2ebe59a88a41f2c`

| Person | 🟢 Prompt inbox (trigger) | 📝 Planning |
|---|---|---|
| Joonatan | `37ea330fb64981dd892ecc4bf5692218` | `37ea330fb64981f28debfd961b84ef96` |
| Nuutti | `37ea330fb64981a79a44c9f074e76523` | `37ea330fb649814f8d98f85c2059cff5` |
| Aarni | `37ea330fb6498120bff3c31ce63ebd42` | `37ea330fb64981d4886ced857df40da4` |
| Arttu | `37ea330fb6498100bd71f2c4b6aa4ae6` | `37ea330fb6498147a0a0fc3e9a03d637` |

Notion access: the integration token (in `.env` as `NOTION_TOKEN`) is shared on the root page, so it can read all children.

---

## 7. State + open items

**Done**
- `crm/` consolidated from the 3 branches (joonatan frontend + nuutti schema/seed + aarni AI) and adopted as THE app; old `web/` stub removed.
- Vercel repointed root `web/`→`crm/`, deploying on push to `main`.
- CI build check added (`.github/workflows/ci.yml`) — builds `crm/` on every PR to `main`.
- All 4 sessions reseeded with lane-accurate prompts.

**Open / decisions pending**
- **Auto-merge**: blocked on two GitHub limits — (a) branch protection / required checks is paywalled on free *private* repos; (b) an Actions-based workaround needs the repo's **Workflow permissions → "Read and write" + "Allow Actions to create/approve PRs"** toggle (Settings → Actions → General). If that toggle is flipped, add auto-open-PR + auto-merge-on-green workflows. Until then: **merge is manual** (PR + click; CI shows green/red).
- **Branch history**: ✅ FIXED (2026-06-13). `person/*` previously had *unrelated histories* (a session re-initialized; arttu/nuutti carried a second root `03e9238`), which forced the `git checkout person/X -- path` cherry-pick workaround on merges. All four branches were re-rooted onto main's tip (`reset --hard main` in each clean worktree → `push --force-with-lease`). Every branch now shares the single root `9c6e24a`, so **`git merge person/X` works normally** — no more cherry-picking. Recovery tags `backup/person-<name>-20260613-161726` preserve the old tips.
- **Merge model**: lanes (disjoint folders per person) keep merges conflict-free by construction; manual merge to main is intentional (no auto-merge needed this close to deadline). Branches were re-rooted (above) so standard merges work.
- **Supabase schema**: `crm/SCHEMA.md` exists; applying it as real tables + loading `crm/seed/` data into Supabase is Arttu's lane (in progress).
- **Azure**: brief mandates Azure (Entra ID, EU region) for the *final* product; we demo on Supabase and plan to migrate.

---

## 8. Gotchas

- `rtk` shell hook rewrites some commands (e.g. `npx`→`npm`) and garbles piped output — use `npm create`, full tmux path `/opt/homebrew/bin/tmux`, and avoid `| while` loops calling tmux.
- Inline HTTP in Bash is blocked by a context hook — use the context-mode `ctx_execute` tool or `gh`/the Notion MCP for API calls.
- `crm/AGENTS.md` warns Next.js 16 has breaking changes vs older knowledge — read `node_modules/next/dist/docs/` before deep Next work.
- Do not `cat .env` / run `vercel env` / `env` on the live stream.
