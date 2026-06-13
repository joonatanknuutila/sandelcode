// Service-role Supabase client — SERVER ONLY. Bypasses RLS.
//
// The mutation layer (lib/db/mutations.ts) runs every write through this client
// so demo writes succeed while real auth is still stubbed (getCurrentUser falls
// back to the first rep; there is no signed-in session to scope RLS by yet).
//
// PRODUCTION SWAP: once Azure Entra ID auth lands, mutations should run under the
// signed-in user's RLS-scoped session (the `lib/supabase/server.ts` client),
// NOT the service-role key — so Postgres RLS enforces who can write what. The
// query layer (lib/db/index.ts) and the mappers are unaffected by that swap;
// only this file and the call sites' client choice change.
import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types.db";

/** Service-role client — bypasses RLS. Demo-only; see the production note above. */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
