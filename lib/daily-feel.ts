import type { ProfileId } from "@/lib/types";
import type { Json } from "@/lib/supabase/database.types";
import { storage } from "@/lib/storage";
import { CAT_FEEL_LABELS, isStressedMoods, parseFeelMood, type CatFeelMood, type FeelAxis } from "@/lib/cat-feel";

export type DailyFeelScores = {
  hunger: CatFeelMood | null;
  energy: CatFeelMood | null;
  fatigue: CatFeelMood | null;
  validated: boolean;
};

export type DailyFeelEntry = DailyFeelScores & {
  date: string;
  profileId: ProfileId;
};

export function emptyFeel(): DailyFeelScores {
  return { hunger: null, energy: null, fatigue: null, validated: false };
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

function moodOf(value: unknown, axis: FeelAxis) {
  return parseFeelMood(value, axis);
}

export function parseFeelFromRow(row: {
  hunger?: number | string | null;
  energy?: number | string | null;
  payload?: Json | null;
}): DailyFeelScores {
  const payload = asObject(row.payload);
  const checkin = asObject(payload.checkin);
  return {
    hunger: moodOf(checkin.hunger, "hunger") ?? moodOf(row.hunger, "hunger"),
    energy: moodOf(checkin.energy, "energy") ?? moodOf(row.energy, "energy"),
    fatigue: moodOf(checkin.fatigue, "fatigue"),
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
  const scores: DailyFeelScores = {
    hunger: moodOf(raw.hunger, "hunger"),
    energy: moodOf(raw.energy, "energy"),
    fatigue: moodOf(raw.fatigue, "fatigue"),
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

export function isStressedNotes(notes: {
  hunger?: CatFeelMood | null;
  energy?: CatFeelMood | null;
  fatigue?: CatFeelMood | null;
}) {
  return isStressedMoods(notes);
}

/** Jours sans note ignorés. Un sticker crevé sur faim, motivation ou fatigue suffit. */
export function isStressedDaily(days: DailyFeelEntry[] | undefined) {
  for (const day of days ?? []) {
    if (isStressedMoods(day)) return true;
  }
  return false;
}

export function formatDailyFeelsForPrompt(days: DailyFeelEntry[] | undefined) {
  const lines = (days ?? [])
    .filter(hasFeelScore)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((day) => {
      const parts: string[] = [];
      if (day.hunger != null) parts.push(`faim=${CAT_FEEL_LABELS[day.hunger]}`);
      if (day.energy != null) parts.push(`motivation=${CAT_FEEL_LABELS[day.energy]}`);
      if (day.fatigue != null) parts.push(`fatigue=${CAT_FEEL_LABELS[day.fatigue]}`);
      return `- ${day.date} ${parts.join(" ")}`;
    });
  if (lines.length === 0) {
    return "Check-in quotidien : aucun jour noté (ignorer — ne pas inventer de sticker).";
  }
  return `Check-in quotidien (ok / bof / crevé, seulement les jours notés) :
${lines.join("\n")}`;
}
