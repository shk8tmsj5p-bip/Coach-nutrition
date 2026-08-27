import { addDaysISO, todayISO } from "@/lib/dates";
import { burnedKcalFromHealth } from "@/lib/health-energy";
import type { DatedMeal } from "@/lib/recent-foods";
import type { DailyMovement, Macros, MealEntry, Profile } from "@/lib/types";

export type DailyEnergyRow = {
  date: string;
  eaten: Macros;
  burned: number;
  live: boolean;
  net: number;
  hasMeals: boolean;
};

export function emptyMacros(): Macros {
  return { calories: 0, protein: 0, carbs: 0, fat: 0 };
}

export function sumDayMacros(meals: MealEntry[]): Macros {
  return meals
    .filter((meal) => !meal.isSkipped)
    .reduce(
      (acc, meal) => ({
        calories: acc.calories + meal.macros.calories,
        protein: acc.protein + meal.macros.protein,
        carbs: acc.carbs + meal.macros.carbs,
        fat: acc.fat + meal.macros.fat,
      }),
      emptyMacros(),
    );
}

export function eachIsoDay(from: string, to: string): string[] {
  if (!from || !to || from > to) return [];
  const days: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    days.push(cursor);
    if (cursor === to) break;
    cursor = addDaysISO(cursor, 1);
  }
  return days;
}

export function buildDailyEnergy(
  meals: DatedMeal[],
  healthDays: DailyMovement[],
  profile: Profile,
  today = todayISO(),
): DailyEnergyRow[] {
  const byDate = new Map<string, MealEntry[]>();
  for (const meal of meals) {
    if (meal.profileId !== profile.id) continue;
    const list = byDate.get(meal.date) ?? [];
    list.push(meal);
    byDate.set(meal.date, list);
  }
  const healthByDate = new Map(healthDays.map((day) => [day.date, day]));
  const dates = [...byDate.keys(), ...healthByDate.keys()].filter(Boolean).sort();
  const floor = addDaysISO(today, -13);
  const from = dates.length > 0 && dates[0] < floor ? dates[0] : floor;
  const to = today < from ? from : today;
  const anchors = { bmr: profile.bmr, tdee: profile.tdee };

  return eachIsoDay(from, to).map((date) => {
    const dayMeals = byDate.get(date) ?? [];
    const eaten = sumDayMacros(dayMeals);
    const movement = healthByDate.get(date);
    const { burned, live } = burnedKcalFromHealth(
      movement ?? { activeEnergyKcal: 0, restingEnergyKcal: 0 },
      anchors,
    );
    return {
      date,
      eaten,
      burned,
      live,
      net: Math.round(eaten.calories - burned),
      hasMeals: dayMeals.length > 0,
    };
  });
}

export function mealsOnDate(meals: DatedMeal[], profileId: Profile["id"], date: string) {
  return meals.filter((meal) => meal.profileId === profileId && meal.date === date);
}
