export type CatFeelMood = "ok" | "bof" | "creve";
export type FeelAxis = "hunger" | "energy" | "fatigue";

export const FEEL_MOODS: CatFeelMood[] = ["ok", "bof", "creve"];

export const CAT_FEEL_LABELS: Record<CatFeelMood, string> = {
  ok: "ok",
  bof: "bof",
  creve: "crevé",
};

export const FEEL_AXIS_HINTS: Record<FeelAxis, string> = {
  hunger: "appétit, envie de manger",
  energy: "pep, envie d’y aller",
  fatigue: "corps usé, besoin de récup",
};

export const FEEL_AXIS_LABELS: Record<FeelAxis, string> = {
  hunger: "Faim",
  energy: "Motivation",
  fatigue: "Fatigue",
};

export function parseFeelMood(value: unknown, axis: FeelAxis): CatFeelMood | null {
  if (value === "ok" || value === "bof" || value === "creve") return value;
  if (value === "crevé") return "creve";
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (axis === "energy") {
    if (n <= 2) return "creve";
    if (n >= 4) return "ok";
    return "bof";
  }
  if (n <= 2) return "ok";
  if (n >= 4) return "creve";
  return "bof";
}

export function parseFeelMoodRequired(value: unknown, axis: FeelAxis, fallback: CatFeelMood = "bof") {
  return parseFeelMood(value, axis) ?? fallback;
}

export function isCreve(mood: CatFeelMood | null | undefined) {
  return mood === "creve";
}

export function isStressedMoods(notes: {
  hunger?: CatFeelMood | null;
  energy?: CatFeelMood | null;
  fatigue?: CatFeelMood | null;
}) {
  return isCreve(notes.hunger) || isCreve(notes.energy) || isCreve(notes.fatigue);
}

export function formatMood(mood: CatFeelMood | null | undefined) {
  return mood ? CAT_FEEL_LABELS[mood] : "—";
}

export function formatFeelLine(scores: {
  hunger: CatFeelMood | null;
  energy: CatFeelMood | null;
  fatigue: CatFeelMood | null;
}) {
  return [
    `${FEEL_AXIS_LABELS.hunger} ${formatMood(scores.hunger)}`,
    `${FEEL_AXIS_LABELS.energy} ${formatMood(scores.energy)}`,
    `${FEEL_AXIS_LABELS.fatigue} ${formatMood(scores.fatigue)}`,
  ].join(" · ");
}

export function formatFeelPromptBits(scores: {
  hunger?: CatFeelMood | null;
  energy?: CatFeelMood | null;
  fatigue?: CatFeelMood | null;
}) {
  return `faim=${formatMood(scores.hunger)} motivation=${formatMood(scores.energy)} fatigue=${formatMood(scores.fatigue)}`;
}
