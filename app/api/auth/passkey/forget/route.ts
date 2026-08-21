import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  PASSKEY_COOKIE,
  cookieBase,
} from "@/lib/auth/household";

export async function POST() {
  const store = await cookies();
  store.set(PASSKEY_COOKIE, "", { ...cookieBase(), maxAge: 0 });
  return NextResponse.json({ ok: true });
}
