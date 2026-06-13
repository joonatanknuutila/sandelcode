# AI layer (Aarni's lane)

The differentiator: genuinely useful, persona-tailored AI. Every agent is
**grounded** (reads only the relevant account/queue facts), and **no agent
writes silently** — the only write path is gated behind explicit human approval.

See `personas.md` for the per-persona design.

## Provider — `lib/ai/provider.ts`
Single LLM entry point (`complete()`), Azure OpenAI by default (env in
`.env.example`). Returns `null` when unconfigured or on error, so **every caller
falls back to deterministic grounded logic** — the demo works with no key.
`modelUsed: false` in responses marks a fallback answer.

## Agents
| Agent | Code | API | Write? |
|-------|------|-----|--------|
| Per-persona assistant ("status of deal X?") | `lib/ai/assistant.ts` | `POST /api/assistant` `{role, question, accountId?}` | read-only |
| Meeting → CRM capture | `lib/ai/meeting.ts` | `POST /api/meeting/draft`, `POST /api/meeting/commit` | **gated** |
| Next-best-action | `lib/ai/index.ts` (`nextBestAction`) | — | read-only |
| Case summary (TAM) | `lib/tam.ts` (`summariseCase`) | — | read-only |
| Forecast narrative (Finance) | `lib/ai/forecast.ts` | `GET /api/forecast` | read-only |

## The human-approval gate
`/api/meeting/draft` proposes changes + 3–5 follow-up questions and **never
mutates state**. `/api/meeting/commit` is the only writer and **refuses unless
`approved === true`** (422 otherwise). UI: `app/tam/MeetingCapture.tsx`.

## To wire on other views (owners' call)
- Finance: render `GET /api/forecast` → `{ text, figures }` as a banner.
- Rep/SM: mount `app/tam/Assistant.tsx` with the matching `role`.
