import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { FOYER_COOKIE, readSession } from "@/lib/auth/household";
import { sendTestAlert } from "@/lib/auth/alerts";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const store = await cookies();
  if (!(await readSession(store.get(FOYER_COOKIE)?.value))) {
    return NextResponse.json({ error: "Session expirée" }, { status: 401 });
  }
  const result = await sendTestAlert(request);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true, sent: result.sent });
}
