import { hashPassword, householdPassword, passwordsMatch } from "@/lib/auth/household";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

export type FoyerLock = {
  epoch: number;
  password_hash: string | null;
  urgence_used: string | null;
};

const EMPTY: FoyerLock = { epoch: 0, password_hash: null, urgence_used: null };

let cached: { at: number; lock: FoyerLock } | null = null;
const CACHE_MS = 4000;

export function parseFoyerLock(raw: unknown): FoyerLock {
  if (!raw || typeof raw !== "object") return { ...EMPTY };
  const row = raw as Record<string, unknown>;
  return {
    epoch: typeof row.epoch === "number" && Number.isFinite(row.epoch) ? Math.max(0, Math.floor(row.epoch)) : 0,
    password_hash: typeof row.password_hash === "string" && row.password_hash.length === 64 ? row.password_hash : null,
    urgence_used: typeof row.urgence_used === "string" ? row.urgence_used : null,
  };
}

export async function loadFoyerLock(): Promise<FoyerLock> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.lock;
  const lock = await readLockFromDb();
  cached = { at: Date.now(), lock };
  return lock;
}

export function forgetFoyerLockCache() {
  cached = null;
}

export async function foyerSessionCurrent(session: { e?: number } | null) {
  if (!session) return false;
  const lock = await loadFoyerLock();
  return (session.e ?? 0) === lock.epoch;
}

export async function foyerPasswordOk(submitted: string) {
  const lock = await loadFoyerLock();
  if (lock.password_hash) {
    const hex = await hashPasswordHex(submitted);
    return timingSame(hex, lock.password_hash);
  }
  return passwordsMatch(submitted, householdPassword());
}

export function passwordStrengthError(password: string) {
  const trimmed = password.trim();
  if (trimmed.length < 8) return "Au moins 8 caractères.";
  if (trimmed.length > 80) return "Trop long.";
  return null;
}

export async function replaceFoyerPassword(password: string) {
  const current = await loadFoyerLock();
  const next: FoyerLock = {
    epoch: current.epoch + 1,
    password_hash: await hashPasswordHex(password.trim()),
    urgence_used: current.urgence_used,
  };
  const error = await writeFoyerLock(next);
  return { lock: next, error };
}

export async function kickAllSessions() {
  const current = await loadFoyerLock();
  const next: FoyerLock = { ...current, epoch: current.epoch + 1 };
  const error = await writeFoyerLock(next);
  return { lock: next, error };
}

export async function markUrgenceUsed(tokenHash: string) {
  const current = await loadFoyerLock();
  const next: FoyerLock = { ...current, urgence_used: tokenHash };
  return writeFoyerLock(next);
}

export async function hashPasswordHex(value: string) {
  const bytes = await hashPassword(value);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function readLockFromDb(): Promise<FoyerLock> {
  const admin = createAdminSupabaseClient();
  if (!admin) return { ...EMPTY };
  const { data, error } = await admin.from("parametres").select("foyer_lock").eq("id", "foyer").maybeSingle();
  if (error || !data) return { ...EMPTY };
  return parseFoyerLock((data as { foyer_lock?: unknown }).foyer_lock);
}

async function writeFoyerLock(lock: FoyerLock) {
  const admin = createAdminSupabaseClient();
  if (!admin) return "Clé Supabase service manquante — impossible de verrouiller depuis le téléphone.";
  const { error } = await admin
    .from("parametres")
    .update({ foyer_lock: lock as unknown as Json })
    .eq("id", "foyer");
  if (error) return error.message.includes("foyer_lock")
    ? "Colonne foyer_lock absente : lance supabase/migrations/add_foyer_lock.sql dans Supabase."
    : error.message;
  forgetFoyerLockCache();
  return null;
}

function timingSame(left: string, right: string) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}
