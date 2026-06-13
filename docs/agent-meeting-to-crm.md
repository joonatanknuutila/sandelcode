# MASTER BUILD PROMPT — Meeting / Notes → CRM ("spar" capture)
**Product:** HMD Secure AI-native CRM · **Agent scope:** unstructured input → structured CRM data, human-gated
**Audience:** AI coding agent(s) building on the existing repo · **Use:** paste as the spec

## 0. How to use this prompt
You are completing **one agent** that already exists in skeleton form (`crm/lib/ai/meeting.ts`, `POST /api/meeting/draft` + `/api/meeting/commit`, UI `app/tam/MeetingCapture.tsx`). The DB, auth, data layer, AI provider, and design system are **shared — do not rebuild them, do not build a second pipeline.** Your job: make the spar→confirm→commit flow real (writes to actual tables) and mount it for the Rep as well as the TAM.

**Stack discipline (non-negotiable):** Next.js **16** — read `crm/AGENTS.md` and `node_modules/next/dist/docs/` first. `params` is a `Promise`; async Server Components; middleware is `proxy.ts`. Commit writes go through the **mutation layer** (`crm/lib/db/mutations.ts`); never import `@/lib/api` or `@/lib/mock-data` in shipped paths.

## 1. Shared foundation (reuse — don't rebuild)
- Existing draft/commit split: `/api/meeting/draft` **proposes** changes + 3–5 follow-up questions and **never mutates**; `/api/meeting/commit` is the **only writer** and **refuses unless `approved===true`** (422 otherwise). Keep this gate exactly.
- AI provider `crm/lib/ai/provider.ts`: `complete()`, Azure OpenAI default, **returns `null` on no-key/error → deterministic fallback**, `modelUsed:false` labels a fallback. All AI calls route through this one proxy (so the Azure swap stays trivial); use the fastest available model for the demo.
- Account timeline = `activity_timeline`; notes = `notes`. RLS on; `getCurrentUser()` resolves asker + role.
- Brand: HMD Secure — anthracite chrome, Inter, lime `#e4ff00` only as fill/accent with black text.

## 2. What it is
Anywhere a user records what happened, the **same input field** offers two ways forward:
- **Save** — a quick manual note, stored to the timeline as-is. Zero friction.
- **Spar & structure** — the AI reads the free text, asks a few targeted clarifying questions, and **only after the user reviews and confirms** writes the structured result.

The input can be anything textual: a typed recap, a **dictated** recap (speech→text), a pasted meeting transcript, or a pasted customer email. The AI processes **text** — it does not care about the source. **One mechanism, many inputs.**

## 3. The hard rule (the whole point)
The AI **NEVER writes to the database before the user confirms.** Always:
1. User dumps free text (or pastes a transcript/email).
2. AI reads it and proposes a structured result.
3. AI asks a few clarifying questions where unsure ("Did they ask about EAL5 certification? You mentioned price — what range?"). It **asks rather than inventing.**
4. User reviews, edits, confirms.
5. Only then is anything saved.
No blind transcript-to-database dump. This is the antidote to hallucination and the reason users trust it.

## 4. What the AI produces (on confirm)
For the user to review:
- A **timeline event** (clean, dated summary).
- A **stage change**, if the conversation warrants moving the deal (user confirms).
- The customer's **open questions**, split technical vs. commercial.
- A **suggested next step** — surfaced on the user's dashboard as "today's action", **not** a separate task object.
It does **not** invent data absent from the input. It summarizes, structures, asks.
**Catalog is context only:** it may surface "you mentioned ~1,200 units → matching catalog items" as a link/suggestion, but it must **never build or price an offer** (offer drafting is deliberately out of scope).

## 5. Roles (same mechanism, different emphasis)
- **Sales Rep — primary user.** Their #1 tool, the answer to their biggest pain (documentation). After any contact, spar a messy recap into a clean timeline entry + stage update + open questions. Lightest possible: talk/paste → review → confirm. Mount the shared capture on the rep account 360 / deal cockpit.
- **TAM.** Same mechanism for case updates: "3rd party promised a fix next week" → AI proposes a case status change + note → TAM confirms.
- **Manager / Finance.** Same mechanism, rarer (not in customer contact): manager spars an insight while supporting a rep; Finance spars a confidence-override justification.
Generalize the existing `MeetingCapture.tsx` into a shared component; don't fork it per role.

## 6. Sensitive-customer option + capture privacy (load-bearing)
- The **safe path is the rep narrating in their own words after the fact** (a recollection), **not a recording of the customer.** This is the institutional-memory value when recordings/attachments are forbidden.
- Provide a per-account way to **disable transcription/recording entirely** for sensitive (defense-sector) customers. The spar still works from typed or dictated text — only the transcript path is turned off. **Default off** for flagged accounts.
- **Speech→text & EU residency:** if dictation audio leaves the EU it's a residency breach. Prefer the browser Web Speech API (on-device) or an EU STT endpoint; **store only the resulting text, discard the audio.** Confirm the STT route.

## 7. What this is NOT
- Not an auto-updater that writes silently.
- Not a task manager (the "next step" lives on the dashboard, not a separate task system).
- Not source-specific (meeting notes, transcripts, emails all go through the same field — no separate email integration).
- Not an offer drafter.

## 8. Build notes
- The real work (ux-north-stars **T3**): make `commitMeeting` insert into real `activity_timeline` / `notes` via the mutation layer, **replacing the session-array stub** — while keeping the `approved===true` hard gate and the `MeetingCapture` UX unchanged.
- Keep it conversational and lightweight: speak/dictate, let the AI fill the structured fields, just check them.
- Seed at least one rich example (a messy meeting recap **and** a pasted customer email) so the spar → confirm → CRM moment is demonstrable end to end.

## 9. Acceptance criteria
A user pastes/types/dictates a messy recap → gets a proposed timeline event + (optional) stage change + open questions + next step, plus 3–5 clarifying questions → edits → confirms → **exactly the confirmed items** land on the account timeline and survive refresh; declining writes nothing; a flagged sensitive account has transcription off but spar-from-text still works; with no LLM key the deterministic fallback still structures a basic note (`modelUsed:false`).

## 10. Open questions (flag, don't guess)
- STT route for dictation (browser on-device vs EU endpoint) + audio-retention policy.
- Which accounts are **sensitive/defense** (transcription off by default) — a flag on `accounts`?
- Should a confirmed stage change also fire a notification to SM/Finance, or stay silent on the timeline?
