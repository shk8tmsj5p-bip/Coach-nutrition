import { normalizeTitle } from "@/lib/recipe-diversity";
import { themeLabel, type FavoriteRecipe } from "@/lib/favorites";
import { isRejectedTitle, type RejectedRecipe } from "@/lib/rejected";
import { mergeDessertIntoMeal } from "@/lib/meal-templates";
import { slotTime } from "@/lib/meal-slot";
import { macrosFromPlanned, mergeWeekPlatIntoMeal, platLinesFromPlanned } from "@/lib/serve-week-plan";
import { isEmptyMeal } from "@/lib/weekly-plan";
import {
  dessertSlotOf,
  dessertTemplateForProfile,
  isWeekLunchDessert,
  type WeekLunchDessert,
} from "@/lib/week-dessert";
import type { DessertSlot } from "@/lib/dessert-product";
import type { MealEntry, MealType, PlannedMeal, ProfileId } from "@/lib/types";

export type HistoryKind = "plat" | "dessert";

export type MealHistoryItem = {
  id: string;
  kind: HistoryKind;
  title: string;
  theme: string;
  weekStart: string;
  meal: PlannedMeal;
  dessertSlot?: DessertSlot;
};

export function historyId(kind: HistoryKind, title: string) {
  return `${kind}:${normalizeTitle(title) || "sans-titre"}`;
}

export function upsertHistoryItem(map: Map<string, MealHistoryItem>, item: MealHistoryItem) {
  const id = historyId(item.kind, item.title);
  const prev = map.get(id);
  if (prev && prev.weekStart > item.weekStart) return;
  map.set(id, { ...item, id });
}

function snapshot(meal: PlannedMeal): PlannedMeal {
  return structuredClone(meal);
}

export function historyFromPlan(
  plan: PlannedMeal[],
  weekStart: string,
  weekTheme = "",
): MealHistoryItem[] {
  const out: MealHistoryItem[] = [];
  for (const meal of plan) {
    if (isEmptyMeal(meal) || !meal.ingredients.length) continue;
    const dessert = isWeekLunchDessert(meal);
    out.push({
      id: historyId(dessert ? "dessert" : "plat", meal.baseName),
      kind: dessert ? "dessert" : "plat",
      title: meal.baseName.trim() || "Sans titre",
      theme: themeLabel(meal.theme || weekTheme),
      weekStart,
      meal: snapshot(meal),
      dessertSlot: dessert ? dessertSlotOf(meal) : undefined,
    });
  }
  return out;
}

export function historyFromDessert(
  dessert: WeekLunchDessert | null | undefined,
  weekStart: string,
): MealHistoryItem | null {
  if (!dessert || isEmptyMeal(dessert.meal) || !dessert.meal.ingredients.length) return null;
  const slot = dessert.slot ?? "midi";
  return {
    id: historyId("dessert", dessert.meal.baseName),
    kind: "dessert",
    title: dessert.meal.baseName.trim() || "Dessert",
    theme: themeLabel(dessert.theme),
    weekStart,
    meal: snapshot(dessert.meal),
    dessertSlot: slot,
  };
}

export function historyFromFavorites(list: FavoriteRecipe[]): MealHistoryItem[] {
  return list
    .filter((item) => item.recipe.ingredients.length > 0)
    .map((item) => {
      const dessert = isWeekLunchDessert(item.recipe);
      return {
        id: historyId(dessert ? "dessert" : "plat", item.title),
        kind: (dessert ? "dessert" : "plat") as HistoryKind,
        title: item.title,
        theme: themeLabel(item.theme),
        weekStart: item.savedAt.slice(0, 10),
        meal: snapshot(item.recipe),
        dessertSlot: dessert ? dessertSlotOf(item.recipe) : undefined,
      };
    });
}

/** Plus jamais : une seule porte (onglet Ban). Pas dans l’historique. */
export function hideRejectedHistory(items: MealHistoryItem[], rejected: RejectedRecipe[]) {
  if (!rejected.length) return items;
  return items.filter((item) => !isRejectedTitle(rejected, item.title));
}

export function mergeMealHistory(groups: MealHistoryItem[][]): MealHistoryItem[] {
  const map = new Map<string, MealHistoryItem>();
  for (const group of groups) {
    for (const item of group) upsertHistoryItem(map, item);
  }
  return [...map.values()].sort((a, b) => {
    const byWeek = b.weekStart.localeCompare(a.weekStart);
    if (byWeek) return byWeek;
    return a.title.localeCompare(b.title, "fr");
  });
}

function haystack(item: MealHistoryItem) {
  const ings = item.meal.ingredients.map((ing) => ing.name).join(" ");
  return normalizeTitle(`${item.title} ${item.theme} ${item.meal.sharedBase ?? ""} ${ings}`);
}

export function searchMealHistory(list: MealHistoryItem[], query: string) {
  const needle = normalizeTitle(query);
  if (!needle) return list;
  return list.filter((item) => haystack(item).includes(needle));
}

function mealFieldsOf(meal: MealEntry | Omit<MealEntry, "id">): Omit<MealEntry, "id" | "profileId"> {
  return {
    name: meal.name,
    type: meal.type,
    time: meal.time,
    macros: meal.macros,
    source: meal.source,
    items: meal.items,
    notes: meal.notes,
    isSkipped: meal.isSkipped,
  };
}

function emptySlotName(type: MealType) {
  if (type === "dejeuner") return "Déjeuner";
  if (type === "diner") return "Dîner";
  if (type === "petit-dejeuner") return "Petit-déjeuner";
  return "Collation";
}

/** Recette d’historique → repas du jour (portions du profil). Plat midi/soir : dessert conservé. */
export function todayMealFromHistory(
  item: MealHistoryItem,
  profileId: ProfileId,
  type: MealType,
  existing: MealEntry | undefined,
): Omit<MealEntry, "id" | "profileId"> {
  const vacant = !existing || existing.isSkipped;
  const lunchOrDinner = type === "dejeuner" || type === "diner";

  if (item.kind === "dessert" && lunchOrDinner) {
    const slot: DessertSlot = type === "diner" ? "soir" : "midi";
    const dessert: WeekLunchDessert = {
      weekdays: [1, 2, 3, 4, 5, 6, 7],
      theme: item.theme === "Autre" ? "" : item.theme,
      meal: item.meal,
      product: null,
      slot,
    };
    const template = dessertTemplateForProfile(dessert, profileId, slot);
    const base: MealEntry = vacant
      ? {
          id: "history-dessert",
          profileId,
          name: emptySlotName(type),
          type,
          time: slotTime(type),
          macros: { calories: 0, protein: 0, carbs: 0, fat: 0 },
          source: "plan",
          items: [],
          isSkipped: false,
        }
      : existing;
    return mealFieldsOf(mergeDessertIntoMeal(base, template, { replace: true }));
  }

  const plat: Omit<MealEntry, "id"> = {
    name: item.meal.baseName.trim() || item.title,
    type,
    time: vacant ? slotTime(type) : existing.time || slotTime(type),
    macros: macrosFromPlanned(item.meal, profileId),
    profileId,
    source: "plan",
    items: platLinesFromPlanned(item.meal, profileId),
    notes: `meal-history:${item.weekStart}`,
    isSkipped: false,
  };

  if (lunchOrDinner && !vacant) {
    return mealFieldsOf(mergeWeekPlatIntoMeal(existing, plat));
  }
  return mealFieldsOf(plat);
}
