# `lib/db` — the typed data layer

Supabase-backed, async, returns the **UI types** in `lib/types.ts`. This is the
real replacement for the mock `lib/api.ts`.

## For Joonatan (frontend adoption)

The mock `lib/api.ts` is **synchronous**; `lib/db` is **async** (it hits
Postgres). To switch a page over:

```diff
- import { getAccount, getDealsForRep } from "@/lib/api";
+ import { getAccount, getDealsForRep } from "@/lib/db";

- export default function RepDashboard() {
-   const deals = getDealsForRep(repId);
+ export default async function RepDashboard() {
+   const deals = await getDealsForRep(repId);
```

Server Components only (the layer imports `server-only`). Function names match
the old `api.ts`. Newly added: `getUsers`, `getAllDeals`, `getAllCases`,
`getCasesForTam`, `getOffersForAccount`, `getProducts`, `getServices`.

`api.ts` is left untouched so the build keeps working during migration.

## Auth / current user

`getCurrentUser()` reads the signed-in profile and **falls back to the first
rep** so the app renders before a login page exists. Role routing lives in
`/proxy.ts` (Next 16's renamed middleware).

## Clients

- `lib/supabase/client.ts` — browser (Client Components)
- `lib/supabase/server.ts` — `await createClient()` (Server Components/Actions)
- `lib/supabase/middleware.ts` — session refresh used by `proxy.ts`

## DB ↔ UI translation (gotchas)

The live schema and `lib/types.ts` diverge; `mappers.ts` bridges them:

| UI (`types.ts`)        | DB (`types.db.ts`)                       |
| ---------------------- | ---------------------------------------- |
| role `sm`              | `sales_manager`                          |
| stage `interest`/`rfi`/`rfp` | `interest_shown`/`rfi_answered`/`rfp_offer_given` |
| case priority `urgent` | `critical`                               |
| case status (no closed)| `closed` → `resolved`                    |
| offer `pending_sm`     | `pending_sm_approval` (`locked`/`sent` → `approved`) |
| `Deal.tcv`             | summed from `deal_forecast_phases`       |
| `Deal.forecast[]`      | `deal_forecast_phases` rows              |
| `Account.channel`      | derived from the account's deals         |

## Regenerating DB types

After any schema change: re-run the Supabase "generate typescript types" and
paste into `lib/types.db.ts`.

## Production target

Supabase Auth for the demo; **Azure Entra ID** for production — swap the client
in `lib/supabase/*`; the query layer and mappers are unaffected.
