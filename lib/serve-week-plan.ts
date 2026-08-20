import { isoWeekday, mondayOf, todayISO } from "@/lib/dates";
import { platLinesOf, withKeptDessert } from "@/lib/meal-templates";
import { declinationFromIngredients } from "@/lib/recipe-macros";
import type { Macros, MealEntry, PlannedMeal, ProfileId } from "@/lib/types";
import { gramsFor, isEmptyMeal } from "@/lib/weekly-plan";

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

const DEMO_PLAT_NAMES = [
  "bowl riz, tofu mariné",
  "bowl riz, poulet airfryer",
  "salade de lentilles, concombre, feta",
];

export function weekPlanSlotId(date: string, mealType: "dejeuner" | "diner") {
  const key = DAY_KEYS[isoWeekday(date) - 1];
  return `${key}-${mealType === "dejeuner" ? "lunch" : "dinner"}`;
}

export function weekPlanNote(weekStart: string, slotId: string) {
  return `week-plan:${weekStart}:${slotId}`;
}

export function isWeekPlanNote(notes: string | null | undefined, weekStart?: string) {
  if (!notes?.startsWith("week-plan:")) return false;
  if (!weekStart) return true;
  return notes.startsWith(`week-plan:${weekStart}:`);
}

export function plannedMealForDay(
  plan: PlannedMeal[],
  date: string,
  mealType: "dejeuner" | "diner",
): PlannedMeal | null {
  const slotId = weekPlanSlotId(date, mealType);
  const dayIndex = isoWeekday(date) - 1;
  const meal =
    plan.find((item) => item.id === slotId) ??
    plan.find((item) => item.dayIndex === dayIndex && item.mealType === mealType);
  if (!meal || isEmptyMeal(meal)) return null;
  return meal;
}

export function isDemoSeedPlat(name: string) {
  const n = name.trim().toLowerCase();
  return DEMO_PLAT_NAMES.some((demo) => n.includes(demo));
}

function isLoggedSource(source: MealEntry["source"] | undefined) {
  return source === "text" || source === "photo" || source === "barcode" || source === "log";
}

export function shouldAutoServePlat(meal: MealEntry | undefined) {
  if (!meal) return true;
  if (meal.isSkipped) return false;
  if (isWeekPlanNote(meal.notes)) return false;
  if (platLinesOf(meal.items).length === 0) return true;
  if (isLoggedSource(meal.source)) return false;
  return isDemoSeedPlat(meal.name);
}

export function platLinesFromPlanned(meal: PlannedMeal, profileId: ProfileId): string[] {
  return meal.ingredients
    .filter((ing) => ing.role === "shared" || ing.role === profileId)
    .map((ing) => {
      const grams = Math.round(gramsFor(ing, profileId));
      if (grams <= 0) return "";
      return `${ing.name} ${grams}g`;
    })
    .filter(Boolean);
}

export function macrosFromPlanned(meal: PlannedMeal, profileId: ProfileId): Macros {
  const decl = profileId === "alexis" ? meal.alexis : meal.elodie;
  if (decl.calories > 0) {
    return {
      calories: decl.calories,
      protein: decl.proteinG,
      carbs: decl.carbsG,
      fat: decl.fatG,
    };
  }
  const computed = declinationFromIngredients(meal.ingredients, profileId);
  return {
    calories: computed.calories,
    protein: computed.proteinG,
    carbs: computed.carbsG,
    fat: computed.fatG,
  };
}

export function todayPlatFromPlanned(
  meal: PlannedMeal,
  profileId: ProfileId,
  date = todayISO(),
): Omit<MealEntry, "id"> {
  const weekStart = mondayOf(date);
  return {
    name: meal.baseName,
    type: meal.mealType,
    time: meal.mealType === "diner" ? "20:15" : "12:35",
    macros: macrosFromPlanned(meal, profileId),
    profileId,
    source: "plan",
    items: platLinesFromPlanned(meal, profileId),
    notes: weekPlanNote(weekStart, meal.id || weekPlanSlotId(date, meal.mealType)),
    isSkipped: false,
  };
}

export function mergeWeekPlatIntoMeal(current: MealEntry, plat: Omit<MealEntry, "id">): MealEntry {
  const kept = withKeptDessert(current.items, plat.items ?? [], plat.macros);
  return {
    ...current,
    name: plat.name,
    time: current.time || plat.time,
    source: "plan",
    notes: plat.notes,
    isSkipped: false,
    items: kept.items,
    macros: kept.macros,
  };
}

export function isServingThisWeekPlat(
  meal: MealEntry | undefined,
  planned: PlannedMeal | null,
  weekStart: string,
) {
  if (!meal || !planned || meal.isSkipped) return false;
  if (isWeekPlanNote(meal.notes, weekStart)) return true;
  return meal.name.trim().toLowerCase() === planned.baseName.trim().toLowerCase();
}

export function fillMissingPlatsFromWeekPlan(
  meals: MealEntry[],
  plan: PlannedMeal[],
  profileIds: ProfileId[],
  date = todayISO(),
  opts: { force?: boolean } = {},
): MealEntry[] {
  const weekStart = mondayOf(date);
  const next = [...meals];
  for (const id of profileIds) {
    for (const type of ["dejeuner", "diner"] as const) {
      const planned = plannedMealForDay(plan, date, type);
      if (!planned) continue;
      const plat = todayPlatFromPlanned(planned, id, date);
      const index = next.findIndex((meal) => meal.profileId === id && meal.type === type);
      if (index < 0) {
        next.push({ ...plat, id: `week-${id}-${type}-${date}` });
        continue;
      }
      const current = next[index];
      if (current.isSkipped) continue;
      if (!opts.force && !shouldAutoServePlat(current)) continue;
      next[index] = mergeWeekPlatIntoMeal(current, plat);
    }
  }
  return next;
}
