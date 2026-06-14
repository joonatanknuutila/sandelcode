# Always-On AI Agent ("Agent Dock") — Design

**Date:** 2026-06-14
**Status:** Approved to execute (user: "just plan and execute, time crunch")

## Context

The CRM has a per-page, **read-only** assistant (`components/Assistant.tsx` → `/api/assistant` → `lib/ai/assistant.ts`) and a draft→approve→commit write gate for meetings (`lib/ai/meeting.ts`). The user wants a single **always-on** conversational agent, available on every page via a floating button, that:

1. Briefs the user on what's going on and what to do next (role-aware).
2. Offers a few one-tap "agentic" task suggestions.
3. **Acts inside the platform** — fills in details and writes to the CRM.
4. Asks the user for missing info when a task is ambiguous.
5. Supports new chats + persisted chat history.

**Decided with the user:**
- **Write model: auto-apply + Undo.** The agent executes writes immediately and shows what it did with an Undo control. This intentionally overrides the existing "no silent writes" house rule for this surface. Every executed action must therefore be **reversible**.
- **Action scope (all four):** notes & follow-ups, move deal stage, add/update contacts, open/update support cases.

## Architecture

Reuses the existing model provider, grounding logic, and mutation layer. No provider rewrite — agentic behavior rides on the **JSON action protocol** already used by `lib/ai/meeting.ts` (`complete(messages, { json: true })`).

```
AppShell (every page)
  └─ <AgentDock role pathCtx>           components/AgentDock.tsx (client)
        FAB (z-[60], bottom-right) → slide-over panel
        ├─ Brief + suggestion chips     GET  /api/agent/brief
        ├─ Message thread + Undo cards  POST /api/agent
        └─ New chat / history           GET/POST /api/agent/chats, GET/DELETE /api/agent/chats/[id]
                                        POST /api/agent/undo
```

### Data layer (Supabase)

Two new tables (created via Supabase migration; schema lives in Supabase, not repo SQL):

- **`ai_chats`**: `id uuid pk`, `user_id uuid`, `title text`, `created_at`, `updated_at`.
- **`ai_messages`**: `id uuid pk`, `chat_id uuid fk`, `role text ('user'|'assistant')`, `content text`, `actions jsonb` (executed actions + their inverse descriptors, for Undo), `created_at`.

RLS enabled on both (parity with existing advisors). Access goes through the **admin/service-role client** scoped by `user_id` in code — consistent with the rest of `lib/db/mutations.ts`. After migration, add the two table types to `lib/types.db.ts`.

New read/write file **`lib/db/chats.ts`**: `createChat`, `listChats(userId)`, `getChatWithMessages(id)`, `addMessage`, `renameChat`, `deleteChat`.

Reversal mutations added to **`lib/db/mutations.ts`**: `deleteActivity(id)`, `deleteContact(id)`, `deleteCase(id)`. Stage/case-status reverts reuse existing `updateDealStage` / `updateCaseStatus`.

### Agent core (`lib/ai/`)

**`lib/ai/agent.ts`** — the heart.
- **Tool registry** (allow-listed; args validated server-side before any write):
  | tool | mutation | inverse |
  |------|----------|---------|
  | `log_note` (note/follow-up) | `logActivity` | `deleteActivity(id)` |
  | `move_deal_stage` | `updateDealStage` | `updateDealStage(prevStage)` |
  | `add_contact` | `createContact` | `deleteContact(id)` |
  | `open_case` | `createCase` | `deleteCase(id)` |
  | `update_case_status` | `updateCaseStatus` | `updateCaseStatus(prevStatus)` |
- `runAgentTurn({ role, userId, message, history, pageContext })`:
  1. Build grounded facts via existing `buildContext` (lib/ai/assistant.ts) + brief data + `pageContext` (current account/deal/case from the URL).
  2. `complete([...], { json: true })` → strict JSON `{ reply, actions[], clarify[] }`.
  3. Validate each action against the registry + verify referenced IDs exist + cap at N actions/turn.
  4. **Execute** each valid action (auto-apply), capturing its **inverse** descriptor.
  5. Return `{ reply, executed: [{ label, inverse }], clarify }`.
  - **Fallback (no model key):** read-only grounded answer (reuse `ask()`); executes nothing.
- `undoAction(inverse)` — runs the reverse mutation. Idempotent-safe.

**`lib/ai/brief.ts`** — `buildBrief(role, userId)` → `{ headline, items[], suggestions: [{ label, prompt }] }`, built deterministically from existing reads: at-risk/stalled/overdue deals + weighted pipeline (rep/sm/finance) and `triageSort`/`slaInfo` cases (tam). Suggestions are pre-filled prompts that, when tapped, are sent as a normal turn.

### API routes (App Router, Next 16 conventions)

- `POST /api/agent` — `{ chatId?, role, message, pageContext? }` → creates chat if absent, persists user msg, runs turn, persists assistant msg (with executed actions), returns `{ chatId, reply, executed, clarify }`.
- `GET /api/agent/brief?role=` → brief + suggestions.
- `GET /api/agent/chats` (list, current user) · `POST /api/agent/chats` (new).
- `GET /api/agent/chats/[id]` (messages) · `DELETE /api/agent/chats/[id]`.
- `POST /api/agent/undo` — `{ chatId, messageId, actionIndex }` → looks up the stored inverse, reverses it, marks the action undone.

All routes resolve the actor via `getCurrentUser()`. Note Next 16: `params` is a Promise in `[id]` handlers (`const { id } = await params`).

### UI (`components/`)

- **`AgentDock.tsx`** (client, mounted once in `AppShell.tsx`): FAB at `fixed bottom-4 right-4 z-[60]` (above the nav drawer's z-50); opens a right-side slide-over (`max-w-md`, full-height on mobile). Reads `usePathname()` → `pageContext`. Holds panel open/closed + active chat state.
- **`AgentBrief.tsx`**: headline + items + suggestion chips (shown on a fresh/empty chat).
- **`AgentChat.tsx`**: message thread, clarify prompts (rendered as quick-reply chips), executed-action cards each with an **Undo** button, input box.
- **`AgentHistory.tsx`**: chat list (open/delete) + "New chat" button, in the panel header.

`AppShell.tsx` already knows `activeRole` + `user` and is a client component → render `<AgentDock role={activeRole} />` at the end of the root `<div>`.

## Guardrails (because writes are auto-applied)

- Server-side allow-list: only the 5 registered tools run; unknown tools ignored.
- Arg validation: referenced `accountId/dealId/caseId/contactId` must exist; `stage`/`status` must be valid enum values.
- Max actions per turn (default 3) to bound blast radius.
- Every executed action stores its inverse → Undo always available from the message.
- Each executed write also logs an `activity_timeline` audit entry (who/what/when via the agent).
- Model-offline fallback is read-only (never auto-writes from heuristics).

## Files

**New:** `lib/db/chats.ts`, `lib/ai/agent.ts`, `lib/ai/brief.ts`, `app/api/agent/route.ts`, `app/api/agent/brief/route.ts`, `app/api/agent/chats/route.ts`, `app/api/agent/chats/[id]/route.ts`, `app/api/agent/undo/route.ts`, `components/AgentDock.tsx`, `components/AgentBrief.tsx`, `components/AgentChat.tsx`, `components/AgentHistory.tsx`.
**Modified:** `lib/db/mutations.ts` (+3 reversal fns), `lib/types.db.ts` (+2 tables), `components/AppShell.tsx` (mount dock).
**DB:** Supabase migration `ai_agent_chat` (2 tables + RLS).

## Verification

1. `npx tsc --noEmit` (or `npm run build`) clean.
2. Supabase: confirm `ai_chats`/`ai_messages` exist; `get_advisors` clean for new tables.
3. `npm run dev`, then: open FAB on a rep page → brief renders; tap a suggestion → agent replies; ask "log a note on <deal> that the pilot is signed off" → note appears on the deal timeline → Undo removes it; "move <deal> to contract negotiation" → stage changes → Undo reverts.
4. New chat + reopen history → messages persist.
5. With `GEMINI_API_KEY` unset locally → assistant still answers read-only, executes nothing.
```
```
