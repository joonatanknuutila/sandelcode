// Server Supabase client (Server Components, Route Handlers, Server Actions).
// Reads/writes the session from Next's cookie store. In Next 16 `cookies()` is
// async, so this helper is async too: `const supabase = await createClient()`.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/types.db";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // In a pure Server Component, writing cookies throws. That's fine:
          // session refresh is handled in `proxy.ts` (middleware). We swallow
          // the error so read-only Server Components keep working.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            /* called from a Server Component — safe to ignore */
          }
        },
      },
    },
  );
}
