import { NextResponse, type NextRequest } from "next/server";

/** Accès ouvert (anon) en développement — pas de session cookies. */
export function middleware(request: NextRequest) {
  return NextResponse.next({ request });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
