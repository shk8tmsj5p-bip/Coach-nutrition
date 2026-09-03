import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import {
  CHALLENGE_COOKIE,
  CHALLENGE_MS,
  FOYER_COOKIE,
  PASSKEY_COOKIE,
  PASSKEY_MS,
  cookieBase,
  makeChallengeToken,
  makePasskeyToken,
  readChallenge,
  readPasskey,
  readSession,
  requestHost,
  requestOrigin,
} from "@/lib/auth/household";
import { bytesToB64url } from "@/lib/auth/crypto-cookie";
import { notifyAuthAlert } from "@/lib/auth/alerts";
import { foyerSessionCurrent, loadFoyerLock } from "@/lib/auth/foyer-lock";

export const runtime = "nodejs";

async function requireSession() {
  const store = await cookies();
  const session = await readSession(store.get(FOYER_COOKIE)?.value);
  return foyerSessionCurrent(session);
}

export async function GET(request: Request) {
  if (!(await requireSession())) {
    return NextResponse.json({ error: "Session expirée" }, { status: 401 });
  }
  const store = await cookies();
  const existing = await readPasskey(store.get(PASSKEY_COOKIE)?.value);
  const rpID = requestHost(request);
  const options = await generateRegistrationOptions({
    rpName: "Coach Nutrition",
    rpID,
    userName: "foyer",
    userDisplayName: "Foyer",
    userID: new TextEncoder().encode("foyer"),
    attestationType: "none",
    preferredAuthenticatorType: "localDevice",
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      residentKey: "preferred",
      userVerification: "required",
    },
    excludeCredentials: existing ? [{ id: existing.id }] : [],
  });
  store.set(CHALLENGE_COOKIE, await makeChallengeToken("register", options.challenge), {
    ...cookieBase(),
    maxAge: Math.ceil(CHALLENGE_MS / 1000),
  });
  return NextResponse.json(options);
}

export async function POST(request: Request) {
  if (!(await requireSession())) {
    return NextResponse.json({ error: "Session expirée" }, { status: 401 });
  }
  const store = await cookies();
  const challenge = await readChallenge(store.get(CHALLENGE_COOKIE)?.value);
  if (!challenge || challenge.type !== "register") {
    return NextResponse.json({ error: "Challenge Face ID expiré" }, { status: 400 });
  }
  const body = (await request.json().catch(() => null)) as RegistrationResponseJSON | null;
  if (!body) {
    return NextResponse.json({ error: "Réponse Face ID manquante" }, { status: 400 });
  }
  const verification = await verifyRegistrationResponse({
    response: body,
    expectedChallenge: challenge.challenge,
    expectedOrigin: requestOrigin(request),
    expectedRPID: requestHost(request),
    requireUserVerification: true,
  });
  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: "Face ID refusé" }, { status: 401 });
  }
  const { credential } = verification.registrationInfo;
  const publicKey =
    credential.publicKey instanceof Uint8Array
      ? credential.publicKey
      : new Uint8Array(credential.publicKey);
  const foyer = await loadFoyerLock();
  store.set(CHALLENGE_COOKIE, "", { ...cookieBase(), maxAge: 0 });
  store.set(
    PASSKEY_COOKIE,
    await makePasskeyToken({
      id: credential.id,
      publicKey: bytesToB64url(publicKey),
      counter: credential.counter,
      transports: credential.transports,
      e: foyer.epoch,
    }),
    { ...cookieBase(), maxAge: Math.ceil(PASSKEY_MS / 1000) },
  );
  await notifyAuthAlert("face_id_register", request);
  return NextResponse.json({ ok: true });
}
