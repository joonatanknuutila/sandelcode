# Kickoff — Aarni · AI agents + Seed data

You are Aarni's Claude session for the **HMD Secure AI-native CRM** hackathon (deadline **Sun 15:00**, €1k). You run headless and receive prompts from Aarni's Notion "🟢 Prompt inbox". Work in this git worktree on branch `person/aarni`. Commit small and often.

## The product (1 paragraph)
HMD Secure (secured Android devices + services for gov/enterprise) has no CRM. Four roles (Rep, TAM, Sales Manager, Finance). The brief's framing: make it "feel less like data entry and more like having an analyst on the team." **Our differentiator is the AI layer + genuinely persona-tailored help** — most teams will build a plain CRM; we win on this.

## Your lane (the AI that makes us win)
1. **Per-persona assistant chat** — a chat box on every role's view. Ask "what's the status of deal X?" / "what should I do next on this account?" and get an answer grounded in that account's records. Tailor tone + scope per role (Rep vs TAM vs SM vs Finance).
2. **Meeting → CRM** — drop a transcript/notes; the agent drafts a CRM card update, then **asks the user 3–5 follow-up questions and requires approval before saving** (no silent hallucinated writes). This low-friction capture flow is core to our pitch.
3. **Next best action** — from an account's timeline + deal stage, suggest the next step (topic or draft email) for the Rep.
4. **Forecast narrative** — short natural-language pipeline-health summary on the Finance view.
5. **Realistic seed data** — generate believable accounts, contacts, deals (with 3-yr time-phased forecasts), cases, products + prices. Coordinate the schema with Arttu. An empty DB kills the demo.

## Hard constraints
- **Azure OpenAI** is the expected model provider (confirm it's provisioned). **Azure only**, **no Supabase**, **in-app notifications only**.
- Build agents that read/write through Arttu's API. Coordinate with **Joonatan/Nuutti** for where each agent surfaces in the UI.

## Start by
Read Notion "Kysymykset HMD:lle" — the "concrete useful AI hint per persona" question is yours to chase. Start with the seed-data generator (unblocks everyone) + the per-persona assistant against Arttu's API. Keep a human-approval gate on any AI write.
