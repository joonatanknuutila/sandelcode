# `lib/db` — the typed data layer

Supabase-backed, async, returns the **UI types** in `lib/types.ts`. This is the
**only** read layer — every view renders against live Supabase data. The old
mock `lib/api.ts` / `lib/mock-data.ts` have been removed.

## Usage

`lib/db` is **async** (it hits Postgres) and **Server-Component only** (the
module imports `server-only`). Read from an `async` Server Component and
`await` the call:

```ts
import { getAccount, getDealsForRep } from "@/lib/db";

export default async function RepDashboard() {
  const deals = await getDealsForRep(repId);
}
```

Writes go through `lib/db/mutations.ts` (called from Server Actions, paired with
`revalidatePath`). Tunable scoring/forecast/approval constants live in
`lib/scoring.ts` — never inline them here.

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
