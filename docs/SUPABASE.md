# Supabase — HMD Sales Hackathon

A dedicated Supabase project for the HMD AI-native CRM demo. Chosen for the demo phase
(easy auth + Postgres + EU residency); the brief mandates Azure for the *final* solution,
and the team plans to migrate (see `challenge-brief.md` §06 and `meeting-notes-2026-06-13.md`).

## Project

| | |
|---|---|
| **Name** | `hmd-sales-hackathon` |
| **Project ref** | `xwsmovmtfymiqvgjicfk` |
| **API URL** | https://xwsmovmtfymiqvgjicfk.supabase.co |
| **Region** | `eu-north-1` (Stockholm — EU residency, matches brief's EU-only constraint) |
| **Org** | `joonatanknuutila's Org` (`vxqcciukefwxmhxmqeuh`, free plan) |
| **Created** | 2026-06-13 |
| **Dashboard** | https://supabase.com/dashboard/project/xwsmovmtfymiqvgjicfk |

## Credentials

All secrets live in `sandelcode/.env` (gitignored — never committed):

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY        # server-only, never ship to the browser
SUPABASE_SECRET_KEY              # server-only
SUPABASE_DB_PASSWORD
SUPABASE_PROJECT_REF
```

## MCP

The Supabase MCP server (`~/.mcp.json`) is repointed to this project:
`https://mcp.supabase.com/mcp?project_ref=xwsmovmtfymiqvgjicfk`

> ⚠️ The MCP caches the project at connect time. After repointing, **reconnect**
> (`/mcp` → reconnect `supabase`, or restart Claude) and verify with
> `get_project_url` before running any migration — otherwise DDL can land on the
> wrong project.

## State

Fresh project — **no schema yet**. Next step is to design the CRM schema from
`challenge-brief.md` (accounts, contacts, deals, cases, offers, catalog, services,
roles, notes, time-phased forecast) and apply migrations via `apply_migration`.
