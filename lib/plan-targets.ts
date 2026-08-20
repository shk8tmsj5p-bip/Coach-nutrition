import { storage } from "@/lib/storage";
import type { MealCoachHousehold, PersonMealCoach } from "@/lib/meal-coach";

export type PlanTargetSlice = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  goal: string;
  weeklyRateKg: number;
  dessertLunchKcal: number;
  dessertDinnerKcal: number;
};

export type PlanTargetsSnapshot = {
  alexis: PlanTargetSlice;
  elodie: PlanTargetSlice;
};

function storageKey(weekStart: string) {
  return `plan-targets:${weekStart}`;
}

function sliceFrom(person: PersonMealCoach): PlanTargetSlice {
  return {
    calories: person.daily.calories,
    protein: person.daily.protein,
    carbs: person.daily.carbs,
    fat: person.daily.fat,
    goal: person.goal,
    weeklyRateKg: person.weeklyRateKg,
    dessertLunchKcal: person.dessertLunchKcal,
    dessertDinnerKcal: person.dessertDinnerKcal,
  };
}

export function snapshotFromCoach(coach: MealCoachHousehold): PlanTargetsSnapshot {
  return { alexis: sliceFrom(coach.alexis), elodie: sliceFrom(coach.elodie) };
}

function slicesEqual(a: PlanTargetSlice, b: PlanTargetSlice) {
  return (
    a.calories === b.calories &&
    a.protein === b.protein &&
    a.carbs === b.carbs &&
    a.fat === b.fat &&
    a.goal === b.goal &&
    a.weeklyRateKg === b.weeklyRateKg &&
    a.dessertLunchKcal === b.dessertLunchKcal &&
    a.dessertDinnerKcal === b.dessertDinnerKcal
  );
}

export function snapshotsEqual(a: PlanTargetsSnapshot, b: PlanTargetsSnapshot) {
  return slicesEqual(a.alexis, b.alexis) && slicesEqual(a.elodie, b.elodie);
}

export function loadPlanTargetsSnapshot(weekStart: string): PlanTargetsSnapshot | null {
  const raw = storage.getJSON<PlanTargetsSnapshot | null>(storageKey(weekStart), null);
  if (!raw?.alexis || !raw?.elodie) return null;
  return raw;
}

export function savePlanTargetsSnapshot(weekStart: string, snapshot: PlanTargetsSnapshot) {
  storage.setJSON(storageKey(weekStart), snapshot);
}

export function clearPlanTargetsSnapshot(weekStart: string) {
  storage.remove(storageKey(weekStart));
}

/** Semaine déjà générée sans empreinte : on ancre les cibles actuelles (pas de bandeau rétroactif). */
export function ensurePlanTargetsBaseline(
  weekStart: string,
  coach: MealCoachHousehold,
  hasMeals: boolean,
): PlanTargetsSnapshot | null {
  const existing = loadPlanTargetsSnapshot(weekStart);
  if (existing) return existing;
  if (!hasMeals) return null;
  const snapshot = snapshotFromCoach(coach);
  savePlanTargetsSnapshot(weekStart, snapshot);
  return snapshot;
}
