// Auth + role-based routing.
//
// NOTE (Next.js 16): `middleware.ts` is deprecated and renamed to `proxy.ts`
// (function `middleware` -> `proxy`, nodejs runtime, no edge). This file is the
// rename of the "middleware" the kickoff refers to.
//
// What it does:
//   1. Refreshes the Supabase auth session cookie on every request.
//   2. Role-gates the role sections (/rep, /tam, /sm, /finance) so a signed-in
//      user can only enter their own area; cross-role hits redirect to the
//      user's home.
//
// Demo behaviour: until a /login page exists, UNAUTHENTICATED requests are let
// through (so the demo renders). Flip ENFORCE_LOGIN to true once login lands.
//
// Production target: Azure Entra ID (OIDC). Swap the Supabase session read in
// lib/supabase/middleware.ts for the Entra session; the role-gating below is
// unchanged.
import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const ENFORCE_LOGIN = false;

// DB role (user_role enum) -> home path. `sales_manager` maps to /sm.
const HOME: Record<string, string> = {
  rep: "/rep",
  tam: "/tam",
  sales_manager: "/sm",
  finance: "/finance",
};

// URL prefix -> the DB role allowed to use it.
const SECTION_ROLE: Record<string, string> = {
  "/rep": "rep",
  "/tam": "tam",
  "/sm": "sales_manager",
  "/finance": "finance",
};

function sectionFor(pathname: string): string | null {
  for (const prefix of Object.keys(SECTION_ROLE)) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) return prefix;
  }
  return null;
}

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;
  const section = sectionFor(pathname);

  if (!user) {
    if (ENFORCE_LOGIN && section) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    return response; // demo: allow through
  }

  // Signed in: keep them inside their own section.
  const role = (user.app_metadata?.role ??
    user.user_metadata?.role) as string | undefined;
  if (section && role && SECTION_ROLE[section] !== role) {
    const url = request.nextUrl.clone();
    url.pathname = HOME[role] ?? "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Run on everything except Next internals and static files.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
