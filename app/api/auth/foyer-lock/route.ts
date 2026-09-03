import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  FOYER_COOKIE,
  PASSKEY_COOKIE,
  SESSION_MS,
  PASSKEY_MS,
  cookieBase,
  makePasskeyToken,
  makeSessionToken,
  readPasskey,
  readSession,
} from "@/lib/auth/household";
import { foyerSessionCurrent, kickAllSessions, passwordStrengthError, replaceFoyerPassword } from "@/lib/auth/foyer-lock";

export const runtime = "nodejs";

async function requireFoyer() {
  const store = await cookies();
  const session = await readSession(store.get(FOYER_COOKIE)?.value);
  return foyerSessionCurrent(session);
}

export async function POST(request: Request) {
  if (!(await requireFoyer())) {
    return NextResponse.json({ error: "Session expirée" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { password?: string; confirm?: string } | null;
  const password = body?.password ?? "";
  const confirm = body?.confirm ?? "";
  const weak = passwordStrengthError(password);
  if (weak) return NextResponse.json({ error: weak }, { status: 400 });
  if (password !== confirm) {
    return NextResponse.json({ error: "Les deux codes ne sont pas pareils." }, { status: 400 });
  }
  const { lock, error } = await replaceFoyerPassword(password);
  if (error) return NextResponse.json({ error }, { status: 503 });
  const store = await cookies();
  store.set(FOYER_COOKIE, await makeSessionToken(lock.epoch), {
    ...cookieBase(),
    maxAge: Math.ceil(SESSION_MS / 1000),
  });
  const passkey = await readPasskey(store.get(PASSKEY_COOKIE)?.value);
  if (passkey) {
    store.set(PASSKEY_COOKIE, await makePasskeyToken({ ...passkey, e: lock.epoch }), {
      ...cookieBase(),
      maxAge: Math.ceil(PASSKEY_MS / 1000),
    });
  }
  return NextResponse.json({ ok: true });
}

export async function PUT() {
  if (!(await requireFoyer())) {
    return NextResponse.json({ error: "Session expirée" }, { status: 401 });
  }
  const { lock, error } = await kickAllSessions();
  if (error) return NextResponse.json({ error }, { status: 503 });
  const store = await cookies();
  store.set(FOYER_COOKIE, await makeSessionToken(lock.epoch), {
    ...cookieBase(),
    maxAge: Math.ceil(SESSION_MS / 1000),
  });
  const passkey = await readPasskey(store.get(PASSKEY_COOKIE)?.value);
  if (passkey) {
    store.set(PASSKEY_COOKIE, await makePasskeyToken({ ...passkey, e: lock.epoch }), {
      ...cookieBase(),
      maxAge: Math.ceil(PASSKEY_MS / 1000),
    });
  }
  return NextResponse.json({ ok: true });
}
