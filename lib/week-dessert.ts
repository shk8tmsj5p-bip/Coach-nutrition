import type { Json } from "@/lib/supabase/database.types";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { isoWeekday, mondayOf, todayISO } from "@/lib/dates";
import { macrosFromPlanned, platLinesFromPlanned } from "@/lib/serve-week-plan";
import { storage } from "@/lib/storage";
import { WEEKDAYS } from "@/lib/sport-routine";
import { equalizeSharedSauce } from "@/lib/ingredient-groups";
import { expandPreparedSauces } from "@/lib/homemade-sauces";
import { declinationFromIngredients } from "@/lib/recipe-macros";
import { dummyTodaySwapSlot, isEmptyMeal } from "@/lib/weekly-plan";
import type { MealCoachHousehold } from "@/lib/meal-coach";
import type { PlannedMeal, ProfileId, SlotTemplate, SlotTemplateKind, Weekday } from "@/lib/types";
import {
  dessertIngredientMacros,
  ensureDessertProductInMeal,
  isBulkLightDessertIng,
  parseDessertProduct,
  type DessertProduct,
  type DessertSlot,
} from "@/lib/dessert-product";

export const LUNCH_DESSERT_ID = "week-lunch-dessert";
export const DINNER_DESSERT_ID = "week-dinner-dessert";
export const DESSERT_BATCH_PREFIX = "dessert-batch:";
export const DEFAULT_DESSERT_DAYS: Weekday[] = [1, 2, 3, 4, 5];
export const DESSERT_THEME_PRESETS = ["Chocolat", "Fruits", "Tofu soyeux", "Tarte", "Clafoutis"] as const;
export const DESSERT_SOIR_PRESETS = ["Tofu soyeux", "Konjac", "Chocolat", "Fruits", "Vanille"] as const;

export type WeekLunchDessert = {
  weekdays: Weekday[];
  theme: string;
  meal: PlannedMeal;
  product?: DessertProduct | null;
  slot?: DessertSlot;
};

export type WeekDessert = WeekLunchDessert;

function storageKey(weekStart: string, slot: DessertSlot = "midi") {
  return slot === "soir" ? `week-dinner-dessert:${weekStart}` : `week-lunch-dessert:${weekStart}`;
}

function asWeekdays(value: unknown): Weekday[] {
  if (!Array.isArray(value)) return [...DEFAULT_DESSERT_DAYS];
  const days = value
    .map((item) => Number(item))
    .filter((item): item is Weekday => item >= 1 && item <= 7);
  const unique = [...new Set(days)].sort((a, b) => a - b);
  return unique.length ? unique : [...DEFAULT_DESSERT_DAYS];
}

export function dessertSlotOf(meal: PlannedMeal | null | undefined): DessertSlot {
  if (!meal) return "midi";
  if (meal.id === DINNER_DESSERT_ID || meal.day === "Dessert soir") return "soir";
  if (meal.batchId.startsWith(`${DESSERT_BATCH_PREFIX}soir:`)) return "soir";
  return "midi";
}

export function isWeekLunchDessert(meal: PlannedMeal | null | undefined) {
  if (!meal) return false;
  return (
    meal.id === LUNCH_DESSERT_ID ||
    meal.id === DINNER_DESSERT_ID ||
    meal.batchId.startsWith(DESSERT_BATCH_PREFIX)
  );
}

export function dessertWeekdaysOf(meal: PlannedMeal): Weekday[] {
  if (!meal.batchId.startsWith(DESSERT_BATCH_PREFIX)) return [...DEFAULT_DESSERT_DAYS];
  const rest = meal.batchId.slice(DESSERT_BATCH_PREFIX.length).replace(/^(midi|soir):/, "");
  return asWeekdays(rest.split(","));
}

export function formatDessertDays(weekdays: Weekday[]) {
  const labels = WEEKDAYS.filter((day) => weekdays.includes(day.id)).map((day) => day.label);
  if (!labels.length) return "Aucun jour";
  if (labels.length === 7) return "Toute la semaine";
  return labels.join(" · ");
}

export function dessertTagOf(slot: DessertSlot = "midi") {
  return slot === "soir" ? "Ds" : "D";
}

function macrosWithProduct(ingredients: PlannedMeal["ingredients"], profile: "alexis" | "elodie", product?: DessertProduct | null) {
  if (!product) return declinationFromIngredients(ingredients, profile);
  const rows = ingredients.filter((item) => item.role === "shared" || item.role === profile);
  let calories = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  for (const item of rows) {
    const grams = profile === "alexis" ? item.gramsAlexis : item.gramsElodie;
    if (grams <= 0) continue;
    const macros = dessertIngredientMacros(item.name, grams, product);
    calories += macros.calories;
    protein += macros.protein;
    carbs += macros.carbs;
    fat += macros.fat;
  }
  const proteinRow = rows.find((item) => item.role === profile);
  return {
    protein: proteinRow?.name ?? (profile === "alexis" ? "Protéine vegan" : "Protéine"),
    calories: Math.round(calories) || 0,
    proteinG: Math.round(protein) || 0,
    carbsG: Math.round(carbs) || 0,
    fatG: Math.round(fat) || 0,
  };
}

export function stampDessertMeal(
  meal: PlannedMeal,
  weekdays: Weekday[],
  theme: string,
  slot: DessertSlot = "midi",
  product?: DessertProduct | null,
): PlannedMeal {
  const days = asWeekdays(weekdays);
  const n = days.length;
  const withProduct = ensureDessertProductInMeal(expandPreparedSauces(meal), product);
  const when = slot === "soir" ? "soir" : "midi";
  return {
    ...withProduct,
    id: slot === "soir" ? DINNER_DESSERT_ID : LUNCH_DESSERT_ID,
    day: slot === "soir" ? "Dessert soir" : "Dessert midi",
    dayIndex: 0,
    mealType: slot === "soir" ? "diner" : "dejeuner",
    theme: theme.trim() || meal.theme || "Dessert",
    servingsPerPerson: 1,
    batchId: `${DESSERT_BATCH_PREFIX}${slot}:${days.join(",")}`,
    coverLabel: `${n} ${when}${n > 1 ? "s" : ""} · 1 part / pers.`,
    lowCalorie: slot === "soir",
    alexis: macrosWithProduct(withProduct.ingredients, "alexis", product),
    elodie: macrosWithProduct(withProduct.ingredients, "elodie", product),
  };
}

export function dummyDessertSlot(slot: DessertSlot = "midi"): PlannedMeal {
  const mealType = slot === "soir" ? "diner" : "dejeuner";
  return stampDessertMeal(dummyTodaySwapSlot(mealType), DEFAULT_DESSERT_DAYS, "Dessert", slot);
}

export function parseWeekLunchDessert(raw: unknown, slot: DessertSlot = "midi"): WeekLunchDessert | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const meal = rec.meal as PlannedMeal | undefined;
  if (!meal || !Array.isArray(meal.ingredients) || isEmptyMeal(meal)) return null;
  const weekdays = asWeekdays(rec.weekdays);
  const theme = typeof rec.theme === "string" ? rec.theme.trim() : "";
  const product = parseDessertProduct(rec.product) ?? null;
  const resolved = isDessertSlotHint(rec.slot) ? rec.slot : slot;
  return {
    weekdays,
    theme,
    product,
    slot: resolved,
    meal: stampDessertMeal(meal, weekdays, theme, resolved, product),
  };
}

function isDessertSlotHint(value: unknown): value is DessertSlot {
  return value === "midi" || value === "soir";
}

export function dessertAppliesToday(dessert: WeekLunchDessert | null, date = todayISO()) {
  if (!dessert) return false;
  return dessert.weekdays.includes(isoWeekday(date));
}

export function lunchDessertTemplateForDay(
  household: Record<ProfileId, SlotTemplate[]>,
  profileId: ProfileId,
  date: string,
  weekDessert: WeekLunchDessert | null,
  templateForSlot: (
    templates: SlotTemplate[],
    slot: SlotTemplateKind,
    weekday: Weekday,
  ) => SlotTemplate | null,
): SlotTemplate | null {
  if (dessertAppliesToday(weekDessert, date) && weekDessert) {
    return dessertTemplateForProfile(weekDessert, profileId, "midi");
  }
  return templateForSlot(household[profileId] ?? [], "dessert-midi", isoWeekday(date));
}

export function dinnerDessertTemplateForDay(
  household: Record<ProfileId, SlotTemplate[]>,
  profileId: ProfileId,
  date: string,
  weekDessert: WeekLunchDessert | null,
  templateForSlot: (
    templates: SlotTemplate[],
    slot: SlotTemplateKind,
    weekday: Weekday,
  ) => SlotTemplate | null,
): SlotTemplate | null {
  if (dessertAppliesToday(weekDessert, date) && weekDessert) {
    return dessertTemplateForProfile(weekDessert, profileId, "soir");
  }
  return templateForSlot(household[profileId] ?? [], "dessert-soir", isoWeekday(date));
}

export function dessertTemplateForProfile(
  dessert: WeekLunchDessert,
  profileId: ProfileId,
  slot: DessertSlot = dessert.slot ?? "midi",
): SlotTemplate {
  const id = slot === "soir" ? DINNER_DESSERT_ID : LUNCH_DESSERT_ID;
  return {
    id: `${id}-${profileId}`,
    slot: slot === "soir" ? "dessert-soir" : "dessert-midi",
    name: dessert.meal.baseName,
    items: platLinesFromPlanned(dessert.meal, profileId),
    macros: macrosFromPlanned(dessert.meal, profileId),
    weekdays: dessert.weekdays,
    time: slot === "soir" ? "20:30" : "13:15",
  };
}

export function dessertKcalTargets(coach: MealCoachHousehold, slot: DessertSlot = "midi") {
  if (slot === "soir") {
    return {
      alexis: clamp(coach.alexis.dessertDinnerKcal || 60, 35, 70),
      elodie: clamp(coach.elodie.dessertDinnerKcal || 60, 35, 70),
    };
  }
  return {
    alexis: Math.max(70, coach.alexis.dessertLunchKcal || 120),
    elodie: Math.max(70, coach.elodie.dessertLunchKcal || 120),
  };
}

export function scaleDessertToGoals(
  meal: PlannedMeal,
  coach: MealCoachHousehold | null | undefined,
  slot: DessertSlot = "midi",
  product?: DessertProduct | null,
): PlannedMeal {
  const withProduct = ensureDessertProductInMeal(meal, product);
  if (!coach) {
    return {
      ...withProduct,
      servingsPerPerson: 1,
      alexis: macrosWithProduct(withProduct.ingredients, "alexis", product),
      elodie: macrosWithProduct(withProduct.ingredients, "elodie", product),
    };
  }
  const targets = dessertKcalTargets(coach, slot);
  let ingredients = withProduct.ingredients.map((item) => ({ ...item }));
  for (const profile of ["alexis", "elodie"] as const) {
    const current = macrosWithProduct(ingredients, profile, product).calories;
    const target = targets[profile];
    if (current <= 0) continue;
    const ratio = target / current;
    if (Math.abs(1 - ratio) < 0.08) continue;
    ingredients = ingredients.map((item) => {
      const key = profile === "alexis" ? "gramsAlexis" : "gramsElodie";
      const grams = item[key] ?? 0;
      if (grams <= 0) return item;
      if (ratio > 1 && isBulkLightDessertIng(item.name, product)) return item;
      return { ...item, [key]: Math.max(0, Math.round(grams * ratio * 10) / 10) };
    });
  }
  const equalized = equalizeSharedSauce({ ...withProduct, ingredients });
  return {
    ...equalized,
    servingsPerPerson: 1,
    alexis: macrosWithProduct(equalized.ingredients, "alexis", product),
    elodie: macrosWithProduct(equalized.ingredients, "elodie", product),
  };
}

export function formatDessertBatchForPrompt(
  weekdays: Weekday[],
  coach: MealCoachHousehold,
  slot: DessertSlot = "midi",
) {
  const days = formatDessertDays(weekdays);
  const n = Math.max(1, weekdays.length);
  const targets = dessertKcalTargets(coach, slot);
  if (slot === "soir") {
    return `DESSERT SOIR BATCH · TRÈS LIGHT (cette semaine)
Jours : ${days} (${n} soirs × 2 personnes = ${n * 2} parts).
JSON = 1 PART / PERSONNE.
Cible 1 part : Alexis ~${targets.alexis} kcal · Élodie ~${targets.elodie} kcal (plafond 70 kcal, jamais 120).
Base : tofu soyeux et/ou konjac / shirataki. INTERDIT pâte brisée, beurre, crème, mascarpone, plus de 8 g de sucre / sirop par part.
Gourmand : vanille, cacao, agrume, cannelle, un peu de fruit.
Le dîner Gem Chef est GÉNÉRÉ À PART — ici UNIQUEMENT le dessert soir.`;
  }
  return `DESSERT MIDI BATCH (cette semaine)
Jours : ${days} (${n} midis × 2 personnes = ${n * 2} parts à cuisiner).
JSON = 1 PART / PERSONNE (pas le total fournée).
Cible 1 part : Alexis ~${targets.alexis} kcal · Élodie ~${targets.elodie} kcal.
Le plat Gem Chef du déjeuner est GÉNÉRÉ À PART — ici UNIQUEMENT le dessert.`;
}

export function loadLocalWeekLunchDessert(weekStart: string, slot: DessertSlot = "midi"): WeekLunchDessert | null {
  return parseWeekLunchDessert(storage.getJSON<unknown>(storageKey(weekStart, slot), null), slot);
}

function saveLocalWeekLunchDessert(weekStart: string, dessert: WeekLunchDessert | null, slot: DessertSlot = "midi") {
  if (!dessert) storage.remove(storageKey(weekStart, slot));
  else storage.setJSON(storageKey(weekStart, slot), dessert);
}

export async function loadWeekLunchDessert(weekStart: string, slot: DessertSlot = "midi"): Promise<WeekLunchDessert | null> {
  const local = loadLocalWeekLunchDessert(weekStart, slot);
  const supabase = createBrowserSupabaseClient();
  if (!supabase) return local;

  const { data, error } = await supabase
    .from("plans_semaine")
    .select("lunch_dessert, dinner_dessert")
    .eq("week_start", weekStart)
    .maybeSingle();
  if (error || !data) return local;
  const raw = slot === "soir" ? data.dinner_dessert : data.lunch_dessert;
  const remote = parseWeekLunchDessert(raw, slot);
  if (!remote) return local;
  saveLocalWeekLunchDessert(weekStart, remote, slot);
  return remote;
}

export async function persistWeekLunchDessert(
  weekStart: string,
  dessert: WeekLunchDessert | null,
  slot: DessertSlot = "midi",
): Promise<string | null> {
  const stamped = dessert
    ? {
        ...dessert,
        slot,
        meal: stampDessertMeal(dessert.meal, dessert.weekdays, dessert.theme, slot, dessert.product),
      }
    : null;
  saveLocalWeekLunchDessert(weekStart, stamped, slot);
  const supabase = createBrowserSupabaseClient();
  if (!supabase) return null;

  const payload = stamped as unknown as Json;
  const { data } = await supabase
    .from("plans_semaine")
    .select("week_start")
    .eq("week_start", weekStart)
    .maybeSingle();

  if (!data && !stamped) return null;

  const patch =
    slot === "soir" ? { dinner_dessert: payload } : { lunch_dessert: payload };
  const result = data
    ? await supabase.from("plans_semaine").update(patch).eq("week_start", weekStart)
    : await supabase.from("plans_semaine").insert({
        week_start: weekStart,
        meals: [],
        ...patch,
      });

  if (!result.error) return null;
  return result.error.message.includes(slot === "soir" ? "dinner_dessert" : "lunch_dessert")
    ? null
    : result.error.message;
}

export function dessertForDate(dessert: WeekLunchDessert | null, date = todayISO()) {
  if (!dessertAppliesToday(dessert, date)) return null;
  return dessert;
}

export function currentWeekDessertMonday(date = todayISO()) {
  return mondayOf(date);
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}
