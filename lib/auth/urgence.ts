import { householdSecret } from "@/lib/auth/household";
import { openJson, sealJson } from "@/lib/auth/crypto-cookie";

export const URGENCE_MS = 48 * 60 * 60 * 1000;

export type UrgencePayload = {
  typ: "urgence";
  kind: string;
  t: number;
  exp: number;
};

const ACTION_KINDS = [
  "password_lockout",
  "password_fail_burst",
  "password_unlock_new_device",
  "face_id_register",
];

export function urgenceKind(kind: string) {
  return ACTION_KINDS.includes(kind);
}

export async function makeUrgenceToken(kind: string) {
  const t = Date.now();
  return sealJson(householdSecret(), {
    typ: "urgence",
    kind,
    t,
    exp: t + URGENCE_MS,
  } satisfies UrgencePayload);
}

export async function readUrgenceToken(token: string | undefined) {
  const parsed = await openJson<UrgencePayload>(householdSecret(), token);
  if (!parsed || parsed.typ !== "urgence") return null;
  if (parsed.exp < Date.now()) return null;
  return parsed;
}
