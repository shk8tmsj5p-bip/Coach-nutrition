import { addDaysISO, todayISO } from "@/lib/dates";
import { isFilledMeal } from "@/lib/meal-slot";
import type { MealEntry, ProfileId } from "@/lib/types";

const SLOTS: ProfileId[] = ["alexis", "elodie"];

type DatedMeal = MealEntry & { date?: string };

function lunchFilled(meals: DatedMeal[], date: string, profileId: ProfileId) {
  return meals.some(
    (meal) =>
      meal.date === date &&
      meal.profileId === profileId &&
      meal.type === "dejeuner" &&
      isFilledMeal(meal),
  );
}

function bothLunches(meals: DatedMeal[], date: string) {
  return SLOTS.every((id) => lunchFilled(meals, date, id));
}

/**
 * Jours consécutifs où Alexis ET Élodie ont un déjeuner réel (non sauté).
 * Si aujourd’hui n’est pas encore posé, on compte jusqu’à hier — pas de honte le matin.
 */
export function coupleLunchStreak(meals: DatedMeal[], today = todayISO()) {
  const yesterday = addDaysISO(today, -1);
  let cursor = bothLunches(meals, today) ? today : yesterday;
  if (!bothLunches(meals, cursor)) return 0;
  let count = 0;
  for (let i = 0; i < 60; i += 1) {
    if (!bothLunches(meals, cursor)) break;
    count += 1;
    cursor = addDaysISO(cursor, -1);
  }
  return count;
}
