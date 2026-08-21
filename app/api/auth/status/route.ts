import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { PASSKEY_COOKIE, readPasskey } from "@/lib/auth/household";

export async function GET() {
  const store = await cookies();
  const passkey = await readPasskey(store.get(PASSKEY_COOKIE)?.value);
  return NextResponse.json({ faceId: Boolean(passkey) });
}
