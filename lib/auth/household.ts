import { openJson, sealJson } from "@/lib/auth/crypto-cookie";

export const FOYER_COOKIE = "cn_foyer";
export const LOCK_COOKIE = "cn_lock";
export const PASSKEY_COOKIE = "cn_wa";
export const CHALLENGE_COOKIE = "cn_wa_ch";

export const MAX_PASSWORD_TRIES = 3;
export const LOCK_MS = 15 * 60 * 1000;
export const SESSION_MS = 180 * 24 * 60 * 60 * 1000;
export const PASSKEY_MS = 400 * 24 * 60 * 60 * 1000;
export const CHALLENGE_MS = 5 * 60 * 1000;

export type FoyerSession = { t: number; e?: number };
export type LockState = { n: number; until: number };
export type StoredPasskey = {
  id: string;
  publicKey: string;
  counter: number;
  transports?: string[];
  e?: number;
};
export type WebAuthnChallenge = {
  type: "register" | "login";
  challenge: string;
  until: number;
};

export function householdSecret() {
  const explicit = process.env.HOUSEHOLD_SESSION_SECRET?.trim();
  if (explicit) return explicit;
  const password = process.env.HOUSEHOLD_PASSWORD?.trim() ?? "";
  return `coach-nutrition:${password}:foyer`;
}

export function householdPassword() {
  return process.env.HOUSEHOLD_PASSWORD ?? "";
}

export function householdEmail() {
  return process.env.HOUSEHOLD_EMAIL?.trim() || "foyer@coach-nutrition.app";
}

export function cookieBase() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

export async function hashPassword(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return new Uint8Array(bytes);
}

export async function passwordsMatch(submitted: string, expected: string) {
  if (!expected) return false;
  const left = await hashPassword(submitted);
  const right = await hashPassword(expected);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i];
  return diff === 0;
}

export async function readSession(token: string | undefined) {
  const secret = householdSecret();
  const session = await openJson<FoyerSession>(secret, token);
  if (!session?.t) return null;
  if (Date.now() - session.t > SESSION_MS) return null;
  return session;
}

export async function makeSessionToken(epoch: number) {
  return sealJson(householdSecret(), { t: Date.now(), e: epoch } satisfies FoyerSession);
}

export async function readLock(token: string | undefined): Promise<LockState> {
  const parsed = await openJson<LockState>(householdSecret(), token);
  if (!parsed) return { n: 0, until: 0 };
  return { n: Math.max(0, parsed.n || 0), until: parsed.until || 0 };
}

export function lockStatus(lock: LockState, now = Date.now()) {
  const locked = lock.until > now;
  const remaining = locked ? 0 : Math.max(0, MAX_PASSWORD_TRIES - lock.n);
  return { locked, remaining, until: lock.until };
}

export async function makeLockToken(lock: LockState) {
  return sealJson(householdSecret(), lock);
}

export async function readPasskey(token: string | undefined) {
  return openJson<StoredPasskey>(householdSecret(), token);
}

export async function makePasskeyToken(passkey: StoredPasskey) {
  return sealJson(householdSecret(), passkey);
}

export async function readChallenge(token: string | undefined) {
  const parsed = await openJson<WebAuthnChallenge>(householdSecret(), token);
  if (!parsed?.challenge || parsed.until < Date.now()) return null;
  return parsed;
}

export async function makeChallengeToken(type: WebAuthnChallenge["type"], challenge: string) {
  return sealJson(householdSecret(), {
    type,
    challenge,
    until: Date.now() + CHALLENGE_MS,
  } satisfies WebAuthnChallenge);
}

export function isPublicPath(pathname: string) {
  if (pathname === "/unlock") return true;
  if (pathname === "/urgence") return true;
  if (pathname.startsWith("/api/auth/")) return true;
  if (pathname === "/api/webhooks/health" || pathname.startsWith("/api/webhooks/health/")) return true;
  if (pathname === "/api/health-webhook") return true;
  if (
    pathname === "/manifest.json" ||
    pathname === "/icon.svg" ||
    pathname === "/icon-chat.png" ||
    pathname === "/icon-192.png" ||
    pathname === "/icon-512.png" ||
    pathname === "/apple-touch-icon.png"
  ) {
    return true;
  }
  return false;
}

export function requestHost(request: Request) {
  const forwarded = request.headers.get("x-forwarded-host");
  const host = forwarded || request.headers.get("host") || "localhost";
  return host.split(":")[0];
}

export function requestOrigin(request: Request) {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "localhost";
  const proto = request.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export function waitLabel(until: number) {
  const min = Math.max(1, Math.ceil((until - Date.now()) / 60000));
  return min <= 1 ? "Réessaie dans 1 min" : `Réessaie dans ${min} min`;
}
