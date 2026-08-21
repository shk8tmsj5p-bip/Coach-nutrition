import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  CHALLENGE_COOKIE,
  FOYER_COOKIE,
  LOCK_COOKIE,
  cookieBase,
} from "@/lib/auth/household";
import { clearHouseholdSupabaseSession } from "@/lib/auth/supabase-session";

export async function POST() {
  const store = await cookies();
  const clear = { ...cookieBase(), maxAge: 0 };
  store.set(FOYER_COOKIE, "", clear);
  store.set(CHALLENGE_COOKIE, "", clear);
  store.set(LOCK_COOKIE, "", clear);
  await clearHouseholdSupabaseSession();
  return NextResponse.json({ ok: true });
}
