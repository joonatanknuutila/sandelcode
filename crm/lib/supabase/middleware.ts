// Session-refresh helper used by the root `proxy.ts` (Next 16's renamed
// middleware). Keeps the Supabase auth cookie fresh on every request and
// returns both the response (with updated cookies) and the current user so the
// proxy can do role-based routing without a second round-trip.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/types.db";
import type { User } from "@supabase/supabase-js";

export async function updateSession(
  request: NextRequest,
): Promise<{ response: NextResponse; user: User | null }> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: getUser() revalidates the token with the auth server; do not
  // trust getSession() in server code.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
