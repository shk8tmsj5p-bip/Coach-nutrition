import { NextResponse, type NextRequest } from "next/server";
import { FOYER_COOKIE, cookieBase, isPublicPath, readSession } from "@/lib/auth/household";
import { loadFoyerLock } from "@/lib/auth/foyer-lock";
import { updateSession } from "@/lib/supabase/middleware";

function withCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie));
  return to;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const supabaseResponse = await updateSession(request);
  const session = await readSession(request.cookies.get(FOYER_COOKIE)?.value);
  let fresh = false;
  if (session) {
    try {
      const lock = await loadFoyerLock();
      fresh = (session.e ?? 0) === lock.epoch;
    } catch {
      fresh = true;
    }
  }

  if (pathname === "/unlock" && fresh) {
    return withCookies(supabaseResponse, NextResponse.redirect(new URL("/", request.url)));
  }
  if (isPublicPath(pathname)) return supabaseResponse;
  if (fresh) return supabaseResponse;

  const denied = pathname.startsWith("/api/")
    ? NextResponse.json({ error: "Session foyer requise" }, { status: 401 })
    : NextResponse.redirect(new URL("/unlock", request.url));
  if (session && !fresh) {
    denied.cookies.set(FOYER_COOKIE, "", { ...cookieBase(), maxAge: 0 });
  }
  return withCookies(supabaseResponse, denied);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
