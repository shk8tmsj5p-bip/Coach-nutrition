import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  FOYER_COOKIE,
  LOCK_COOKIE,
  LOCK_MS,
  MAX_PASSWORD_TRIES,
  PASSKEY_COOKIE,
  SESSION_MS,
  cookieBase,
  householdPassword,
  lockStatus,
  makeLockToken,
  makeSessionToken,
  passwordsMatch,
  readLock,
  readPasskey,
  waitLabel,
} from "@/lib/auth/household";
import { notifyAuthAlert, recordPasswordFailure } from "@/lib/auth/alerts";
import { establishHouseholdSupabaseSession } from "@/lib/auth/supabase-session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { password?: string } | null;
  const password = body?.password ?? "";
  const store = await cookies();
  const lock = await readLock(store.get(LOCK_COOKIE)?.value);
  const now = Date.now();
  const status = lockStatus(lock, now);

  if (status.locked) {
    return NextResponse.json(
      { error: waitLabel(status.until), remaining: 0, lockedUntil: status.until },
      { status: 429 },
    );
  }

  const expected = householdPassword();
  if (!expected) {
    return NextResponse.json({ error: "Code foyer non configuré" }, { status: 500 });
  }

  const ok = await passwordsMatch(password, expected);
  if (!ok) {
    const nextN = lock.n + 1;
    const lockedOut = nextN >= MAX_PASSWORD_TRIES;
    const nextLock = lockedOut
      ? { n: MAX_PASSWORD_TRIES, until: now + LOCK_MS }
      : { n: nextN, until: 0 };
    store.set(LOCK_COOKIE, await makeLockToken(nextLock), {
      ...cookieBase(),
      maxAge: Math.ceil((LOCK_MS + 60_000) / 1000),
    });
    if (lockedOut) {
      await recordPasswordFailure(request, true);
      return NextResponse.json(
        { error: waitLabel(nextLock.until), remaining: 0, lockedUntil: nextLock.until },
        { status: 429 },
      );
    }
    await recordPasswordFailure(request, false);
    return NextResponse.json(
      {
        error: nextLock.n === 2 ? "Encore 1 essai" : `Encore ${MAX_PASSWORD_TRIES - nextLock.n} essais`,
        remaining: MAX_PASSWORD_TRIES - nextLock.n,
      },
      { status: 401 },
    );
  }

  store.set(LOCK_COOKIE, "", { ...cookieBase(), maxAge: 0 });
  store.set(FOYER_COOKIE, await makeSessionToken(), {
    ...cookieBase(),
    maxAge: Math.ceil(SESSION_MS / 1000),
  });
  await establishHouseholdSupabaseSession();
  const passkey = await readPasskey(store.get(PASSKEY_COOKIE)?.value);
  if (!passkey) await notifyAuthAlert("password_unlock_new_device", request);
  return NextResponse.json({ ok: true });
}
