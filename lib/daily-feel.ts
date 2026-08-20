import type { ProfileId } from "@/lib/types";
import type { Json } from "@/lib/supabase/database.types";
import { storage } from "@/lib/storage";

export type DailyFeelScores = {
  hunger: number | null;
  energy: number | null;
  fatigue: number | null;
  validated: boolean;
};

export type DailyFeelEntry = DailyFeelScores & {
  date: string;
  profileId: ProfileId;
};

export function emptyFeel(): DailyFeelScores {
  return { hunger: null, energy: null, fatigue: null, validated: false };
}

export function clampFeelScore(value: unknown): number | null {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 1 || n > 5) return null;
  return n;
}

export function hasFeelScore(scores: DailyFeelScores) {
  return scores.hunger != null || scores.energy != null || scores.fatigue != null;
}

export function hasCompleteFeel(scores: DailyFeelScores) {
  return scores.hunger != null && scores.energy != null && scores.fatigue != null;
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function parseFeelFromRow(row: {
  hunger?: number | null;
  energy?: number | null;
  payload?: Json | null;
}): DailyFeelScores {
  const payload = asObject(row.payload);
  const checkin = asObject(payload.checkin);
  return {
    hunger: clampFeelScore(checkin.hunger) ?? clampFeelScore(row.hunger),
    energy: clampFeelScore(checkin.energy) ?? clampFeelScore(row.energy),
    fatigue: clampFeelScore(checkin.fatigue),
    validated: checkin.validated === true,
  };
}

export function mergeFeelPayload(existing: Json | null | undefined, scores: DailyFeelScores): Json {
  const payload = asObject(existing);
  const checkin: Record<string, unknown> = {
    ...asObject(payload.checkin),
    ...(scores.hunger != null ? { hunger: scores.hunger } : {}),
    ...(scores.energy != null ? { energy: scores.energy } : {}),
    ...(scores.fatigue != null ? { fatigue: scores.fatigue } : {}),
  };
  if (scores.validated) checkin.validated = true;
  else delete checkin.validated;
  return { ...payload, checkin } as Json;
}

function localKey(profileId: ProfileId, date: string) {
  return `daily-feel:${profileId}:${date}`;
}

export function loadLocalFeel(profileId: ProfileId, date: string): DailyFeelScores | null {
  const raw = storage.getJSON<DailyFeelScores | null>(localKey(profileId, date), null);
  if (!raw) return null;
  const scores = {
    hunger: clampFeelScore(raw.hunger),
    energy: clampFeelScore(raw.energy),
    fatigue: clampFeelScore(raw.fatigue),
    validated: raw.validated === true,
  };
  return hasFeelScore(scores) ? scores : null;
}

export function saveLocalFeel(profileId: ProfileId, date: string, scores: DailyFeelScores) {
  storage.setJSON(localKey(profileId, date), scores);
}

export function clearLocalFeel(profileId: ProfileId, date: string) {
  storage.remove(localKey(profileId, date));
}

/** Retire faim / énergie / fatigue du payload checkin (garde le reste, ex. jeûne). */
export function stripFeelFromPayload(existing: Json | null | undefined): Json {
  const payload = asObject(existing);
  const checkin = { ...asObject(payload.checkin) };
  delete checkin.hunger;
  delete checkin.energy;
  delete checkin.fatigue;
  delete checkin.validated;
  return { ...payload, checkin } as Json;
}

export function mergeFeel(base: DailyFeelScores, overlay: DailyFeelScores | null): DailyFeelScores {
  if (!overlay) return base;
  return {
    hunger: overlay.hunger ?? base.hunger,
    energy: overlay.energy ?? base.energy,
    fatigue: overlay.fatigue ?? base.fatigue,
    validated: Boolean(overlay.validated) || Boolean(base.validated),
  };
}

export function isStressedNotes(notes: { hunger: number; energy: number; fatigue: number }) {
  return notes.hunger >= 4 || notes.fatigue >= 4 || notes.energy <= 2;
}

/** Jours sans note ignorés. Une note faim≥4 / fatigue≥4 / énergie≤2 suffit. */
export function isStressedDaily(days: DailyFeelEntry[] | undefined) {
  for (const day of days ?? []) {
    if (day.hunger != null && day.hunger >= 4) return true;
    if (day.fatigue != null && day.fatigue >= 4) return true;
    if (day.energy != null && day.energy <= 2) return true;
  }
  return false;
}

export function formatDailyFeelsForPrompt(days: DailyFeelEntry[] | undefined) {
  const lines = (days ?? [])
    .filter(hasFeelScore)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((day) => {
      const parts: string[] = [];
      if (day.hunger != null) parts.push(`faim=${day.hunger}/5`);
      if (day.energy != null) parts.push(`énergie=${day.energy}/5`);
      if (day.fatigue != null) parts.push(`fatigue=${day.fatigue}/5`);
      return `- ${day.date} ${parts.join(" ")}`;
    });
  if (lines.length === 0) {
    return "Check-in quotidien : aucun jour noté (ignorer — ne pas inventer de 3/5).";
  }
  return `Check-in quotidien (seulement les jours notés, les autres ignorés) :
${lines.join("\n")}`;
}
