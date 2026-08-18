import type { MealType, PrimaryGoal } from "@/lib/types";

export type MacroKind = "calories" | "protein" | "carbs" | "fat";
export type MacroTone = "good" | "bad" | "warn" | "neutral";

export const TONE_COLOR: Record<MacroTone, string> = {
  good: "#34C759",
  bad: "#FF3B30",
  warn: "#FF9F0A",
  neutral: "#8E8E93",
};

export const TONE_TEXT: Record<MacroTone, string> = {
  good: "text-emerald-600",
  bad: "text-red-500",
  warn: "text-amber-600",
  neutral: "text-health-muted",
};

/** Part indicative of daily kcal by slot (dîner low cal). */
export const SLOT_KCAL_SHARE: Record<MealType, number> = {
  "petit-dejeuner": 0.25,
  dejeuner: 0.35,
  diner: 0.25,
  collation: 0.15,
};

export function slotCalorieTarget(dailyCalories: number, type: MealType) {
  return Math.round(dailyCalories * SLOT_KCAL_SHARE[type]);
}

export function macroStatus(
  kind: MacroKind,
  current: number,
  target: number,
  goal: PrimaryGoal = "perte",
): { tone: MacroTone; color: string; label: string } {
  if (target <= 0) {
    return { tone: "neutral", color: TONE_COLOR.neutral, label: "" };
  }

  const ratio = current / target;
  const onTrack = Math.abs(ratio - 1) <= 0.05;

  if (kind === "protein") {
    if (ratio >= 0.95) {
      return {
        tone: "good",
        color: TONE_COLOR.good,
        label: ratio > 1.15 ? "Protéines +" : "Protéines OK",
      };
    }
    if (ratio < 0.8) {
      return { tone: "bad", color: TONE_COLOR.bad, label: "Protéines basses" };
    }
    return { tone: "warn", color: TONE_COLOR.warn, label: "À compléter" };
  }

  if (kind === "calories") {
    if (onTrack) {
      return { tone: "good", color: TONE_COLOR.good, label: "Objectif ±5%" };
    }
    if (goal === "prise") {
      if (ratio < 0.95) {
        return { tone: "bad", color: TONE_COLOR.bad, label: "Sous la cible" };
      }
      return { tone: "good", color: TONE_COLOR.good, label: "Au-dessus" };
    }
    if (goal === "maintien") {
      if (ratio > 1.05) {
        return { tone: "bad", color: TONE_COLOR.bad, label: "Dépassement" };
      }
      return { tone: "warn", color: TONE_COLOR.warn, label: "Sous la cible" };
    }
    if (ratio > 1.05) {
      return { tone: "bad", color: TONE_COLOR.bad, label: "Dépassement" };
    }
    return { tone: "good", color: TONE_COLOR.good, label: "Sous la cible" };
  }

  if (goal === "prise") {
    if (ratio < 0.85) {
      return { tone: "warn", color: TONE_COLOR.warn, label: "Sous la cible" };
    }
    if (ratio > 1.25) {
      return { tone: "warn", color: TONE_COLOR.warn, label: "Un peu haut" };
    }
    return { tone: "good", color: TONE_COLOR.good, label: "OK" };
  }

  if (ratio > 1.1) {
    return { tone: "bad", color: TONE_COLOR.bad, label: "Au-dessus" };
  }
  if (ratio < 0.7) {
    return { tone: "warn", color: TONE_COLOR.warn, label: "Marge" };
  }
  return { tone: "good", color: TONE_COLOR.good, label: "OK" };
}
