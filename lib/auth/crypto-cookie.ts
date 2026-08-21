const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toB64url(bytes: Uint8Array) {
  let bin = "";
  bytes.forEach((byte) => {
    bin += String.fromCharCode(byte);
  });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromB64url(value: string) {
  const pad = "=".repeat((4 - (value.length % 4)) % 4);
  const b64 = (value + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return toB64url(new Uint8Array(sig));
}

function same(left: string, right: string) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

export async function sealJson(secret: string, value: unknown) {
  const payload = toB64url(encoder.encode(JSON.stringify(value)));
  const sig = await hmac(secret, payload);
  return `${payload}.${sig}`;
}

export async function openJson<T>(secret: string, token: string | undefined | null): Promise<T | null> {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await hmac(secret, payload);
  if (!same(expected, sig)) return null;
  try {
    return JSON.parse(decoder.decode(fromB64url(payload))) as T;
  } catch {
    return null;
  }
}

export function bytesToB64url(bytes: Uint8Array) {
  return toB64url(bytes);
}

export function b64urlToBytes(value: string) {
  return fromB64url(value);
}
