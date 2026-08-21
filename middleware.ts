import { NextResponse, type NextRequest } from "next/server";
import { FOYER_COOKIE, isPublicPath, readSession } from "@/lib/auth/household";
import { updateSession } from "@/lib/supabase/middleware";

function withCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie));
  return to;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const supabaseResponse = await updateSession(request);
  const session = await readSession(request.cookies.get(FOYER_COOKIE)?.value);

  if (pathname === "/unlock" && session) {
    return withCookies(supabaseResponse, NextResponse.redirect(new URL("/", request.url)));
  }
  if (isPublicPath(pathname)) return supabaseResponse;
  if (session) return supabaseResponse;

  if (pathname.startsWith("/api/")) {
    return withCookies(
      supabaseResponse,
      NextResponse.json({ error: "Session foyer requise" }, { status: 401 }),
    );
  }
  return withCookies(supabaseResponse, NextResponse.redirect(new URL("/unlock", request.url)));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
