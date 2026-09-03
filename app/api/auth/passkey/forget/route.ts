import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { FOYER_COOKIE, PASSKEY_COOKIE, cookieBase, readSession } from "@/lib/auth/household";
import { notifyAuthAlert } from "@/lib/auth/alerts";

export async function POST(request: Request) {
  const store = await cookies();
  if (!(await readSession(store.get(FOYER_COOKIE)?.value))) {
    return NextResponse.json({ error: "Session expirée" }, { status: 401 });
  }
  const hadPasskey = Boolean(store.get(PASSKEY_COOKIE)?.value);
  store.set(PASSKEY_COOKIE, "", { ...cookieBase(), maxAge: 0 });
  if (hadPasskey) await notifyAuthAlert("face_id_removed", request);
  return NextResponse.json({ ok: true });
}
