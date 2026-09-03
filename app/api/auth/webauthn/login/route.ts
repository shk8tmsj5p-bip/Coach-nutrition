import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type AuthenticationResponseJSON,
} from "@simplewebauthn/server";
import {
  CHALLENGE_COOKIE,
  CHALLENGE_MS,
  FOYER_COOKIE,
  LOCK_COOKIE,
  PASSKEY_COOKIE,
  PASSKEY_MS,
  SESSION_MS,
  cookieBase,
  makeChallengeToken,
  makePasskeyToken,
  makeSessionToken,
  readChallenge,
  readPasskey,
  requestHost,
  requestOrigin,
} from "@/lib/auth/household";
import { b64urlToBytes } from "@/lib/auth/crypto-cookie";
import { loadFoyerLock } from "@/lib/auth/foyer-lock";
import { establishHouseholdSupabaseSession } from "@/lib/auth/supabase-session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const store = await cookies();
  const passkey = await readPasskey(store.get(PASSKEY_COOKIE)?.value);
  const foyer = await loadFoyerLock();
  if (!passkey || (passkey.e ?? 0) !== foyer.epoch) {
    return NextResponse.json({ error: "Face ID pas encore activé sur cet iPhone" }, { status: 404 });
  }
  const options = await generateAuthenticationOptions({
    rpID: requestHost(request),
    userVerification: "required",
    allowCredentials: [{ id: passkey.id, transports: passkey.transports as "internal"[] | undefined }],
  });
  store.set(CHALLENGE_COOKIE, await makeChallengeToken("login", options.challenge), {
    ...cookieBase(),
    maxAge: Math.ceil(CHALLENGE_MS / 1000),
  });
  return NextResponse.json(options);
}

export async function POST(request: Request) {
  const store = await cookies();
  const passkey = await readPasskey(store.get(PASSKEY_COOKIE)?.value);
  const challenge = await readChallenge(store.get(CHALLENGE_COOKIE)?.value);
  if (!passkey || !challenge || challenge.type !== "login") {
    return NextResponse.json({ error: "Face ID indisponible" }, { status: 400 });
  }
  const body = (await request.json().catch(() => null)) as AuthenticationResponseJSON | null;
  if (!body) {
    return NextResponse.json({ error: "Réponse Face ID manquante" }, { status: 400 });
  }
  const verification = await verifyAuthenticationResponse({
    response: body,
    expectedChallenge: challenge.challenge,
    expectedOrigin: requestOrigin(request),
    expectedRPID: requestHost(request),
    requireUserVerification: true,
    credential: {
      id: passkey.id,
      publicKey: b64urlToBytes(passkey.publicKey),
      counter: passkey.counter,
      transports: passkey.transports as "internal"[] | undefined,
    },
  });
  if (!verification.verified) {
    return NextResponse.json({ error: "Face ID refusé" }, { status: 401 });
  }
  const foyer = await loadFoyerLock();
  if ((passkey.e ?? 0) !== foyer.epoch) {
    return NextResponse.json({ error: "Face ID à réactiver avec le code foyer" }, { status: 401 });
  }
  store.set(CHALLENGE_COOKIE, "", { ...cookieBase(), maxAge: 0 });
  store.set(LOCK_COOKIE, "", { ...cookieBase(), maxAge: 0 });
  store.set(FOYER_COOKIE, await makeSessionToken(foyer.epoch), {
    ...cookieBase(),
    maxAge: Math.ceil(SESSION_MS / 1000),
  });
  store.set(
    PASSKEY_COOKIE,
    await makePasskeyToken({
      ...passkey,
      counter: verification.authenticationInfo.newCounter,
      e: foyer.epoch,
    }),
    { ...cookieBase(), maxAge: Math.ceil(PASSKEY_MS / 1000) },
  );
  await establishHouseholdSupabaseSession();
  return NextResponse.json({ ok: true });
}
