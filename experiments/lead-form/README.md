# Lead intake + waterfall enrichment — experiment

Standalone prototype Nuutti built outside the main `crm/` app.
Vanilla Node http + plain HTML, **no Next.js, no Supabase, no Azure** — to
prove the waterfall enrichment pipeline before integrating into `crm/`.

## What it does

Sales rep types lead info (firstname, lastname, email, company, industry,
country, product interest, message) → server fires a 5-step enrichment
pipeline and streams events back to the browser as Server-Sent Events:

1. Email → domain extract (offline)
2. Verify person works at the domain company (Gemini + Google Search)
3. Crawl company website news (Gemini + Google Search)
4. Google company intel: DORA / NIS2 / current MDM vendor / competitors
5. Google person intel: talks, interviews, background

Then a final pass synthesises a **pre-meeting brief** (headline, rapport
opener, 3 discovery questions, recommended product, decision chain, deal
sizing, flags).

## Modes

- **LIVE** (Gemini): set `GEMINI_API_KEY` in `.env` → every click runs real
  Google-grounded searches.
- **CACHED**: no API key → replays a pre-recorded enrichment stream for the
  one cached lead (Marc Hofmann / Nordea) with realistic timing.

## Run

```bash
cd experiments/lead-form
cp .env.example .env       # paste your Gemini key
npm start                  # http://localhost:3000
```

No `npm install` — uses only Node built-ins.

## Files

- `index.html` — form + live progress UI + brief renderer
- `server.js` — http server, routes, SSE endpoint, mode switching
- `enrich-live.js` — 5-step Gemini pipeline (live mode)
- `enrichment-streams.js` — cached event scripts (cached mode)
- `submissions.json` — saved leads (gitignored fields would be: none, all
  data is non-sensitive sales prospecting)
- `enriched/lead-*.json` — cached enrichment results per lead

## Where this needs to go for the real demo

Integrate into `crm/`:
- New `Lead` type in `crm/lib/types.ts`
- Form as React component using existing `components/ui.tsx`
- API route `crm/app/api/leads/[id]/enrich/route.ts` returning SSE
- Persist to Supabase (`leads` table)
- Swap Gemini → Azure OpenAI to match Aarni's standard

Branch this came from: `experiment/lead-form-enrichment`.
