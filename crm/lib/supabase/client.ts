// Browser Supabase client (Client Components). Uses the publishable anon key;
// RLS enforces what each signed-in user can see/do.
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types.db";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
