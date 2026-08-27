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

export const LUNCH_DESSERT_ID = "week-lunch-dessert";
export const DESSERT_BATCH_PREFIX = "dessert-batch:";
export const DEFAULT_DESSERT_DAYS: Weekday[] = [1, 2, 3, 4, 5];
export const DESSERT_THEME_PRESETS = ["Chocolat", "Fruits", "Tofu soyeux", "Tarte", "Clafoutis"] as const;

export type WeekLunchDessert = {
  weekdays: Weekday[];
  theme: string;
  meal: PlannedMeal;
};

function storageKey(weekStart: string) {
  return `week-lunch-dessert:${weekStart}`;
}

function asWeekdays(value: unknown): Weekday[] {
  if (!Array.isArray(value)) return [...DEFAULT_DESSERT_DAYS];
  const days = value
    .map((item) => Number(item))
    .filter((item): item is Weekday => item >= 1 && item <= 7);
  const unique = [...new Set(days)].sort((a, b) => a - b);
  return unique.length ? unique : [...DEFAULT_DESSERT_DAYS];
}

export function isWeekLunchDessert(meal: PlannedMeal | null | undefined) {
  if (!meal) return false;
  return meal.id === LUNCH_DESSERT_ID || meal.batchId.startsWith(DESSERT_BATCH_PREFIX);
}

export function dessertWeekdaysOf(meal: PlannedMeal): Weekday[] {
  if (!meal.batchId.startsWith(DESSERT_BATCH_PREFIX)) return [...DEFAULT_DESSERT_DAYS];
  return asWeekdays(meal.batchId.slice(DESSERT_BATCH_PREFIX.length).split(","));
}

export function formatDessertDays(weekdays: Weekday[]) {
  const labels = WEEKDAYS.filter((day) => weekdays.includes(day.id)).map((day) => day.label);
  if (!labels.length) return "Aucun jour";
  if (labels.length === 7) return "Toute la semaine";
  return labels.join(" · ");
}

export function stampDessertMeal(meal: PlannedMeal, weekdays: Weekday[], theme: string): PlannedMeal {
  const days = asWeekdays(weekdays);
  const n = days.length;
  return {
    ...meal,
    id: LUNCH_DESSERT_ID,
    day: "Dessert midi",
    dayIndex: 0,
    mealType: "dejeuner",
    theme: theme.trim() || meal.theme || "Dessert",
    servingsPerPerson: 1,
    batchId: `${DESSERT_BATCH_PREFIX}${days.join(",")}`,
    coverLabel: `${n} midi${n > 1 ? "s" : ""} · 1 part / pers.`,
    lowCalorie: false,
    alexis: declinationFromIngredients(meal.ingredients, "alexis"),
    elodie: declinationFromIngredients(meal.ingredients, "elodie"),
  };
}

export function dummyDessertSlot(): PlannedMeal {
  return stampDessertMeal(dummyTodaySwapSlot("dejeuner"), DEFAULT_DESSERT_DAYS, "Dessert");
}

export function parseWeekLunchDessert(raw: unknown): WeekLunchDessert | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const meal = rec.meal as PlannedMeal | undefined;
  if (!meal || !Array.isArray(meal.ingredients) || isEmptyMeal(meal)) return null;
  const weekdays = asWeekdays(rec.weekdays);
  const theme = typeof rec.theme === "string" ? rec.theme.trim() : "";
  return {
    weekdays,
    theme,
    meal: stampDessertMeal(expandPreparedSauces(meal), weekdays, theme),
  };
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
    return dessertTemplateForProfile(weekDessert, profileId);
  }
  return templateForSlot(household[profileId] ?? [], "dessert-midi", isoWeekday(date));
}

export function dessertTemplateForProfile(
  dessert: WeekLunchDessert,
  profileId: ProfileId,
): SlotTemplate {
  return {
    id: `${LUNCH_DESSERT_ID}-${profileId}`,
    slot: "dessert-midi",
    name: dessert.meal.baseName,
    items: platLinesFromPlanned(dessert.meal, profileId),
    macros: macrosFromPlanned(dessert.meal, profileId),
    weekdays: dessert.weekdays,
    time: "13:15",
  };
}

export function scaleDessertToGoals(meal: PlannedMeal, coach: MealCoachHousehold | null | undefined): PlannedMeal {
  if (!coach) return meal;
  const targets = {
    alexis: Math.max(70, coach.alexis.dessertLunchKcal || 120),
    elodie: Math.max(70, coach.elodie.dessertLunchKcal || 120),
  };
  let ingredients = meal.ingredients.map((item) => ({ ...item }));
  for (const profile of ["alexis", "elodie"] as const) {
    const current = declinationFromIngredients(ingredients, profile).calories;
    const target = targets[profile];
    if (current <= 0) continue;
    const ratio = target / current;
    if (Math.abs(1 - ratio) < 0.08) continue;
    ingredients = ingredients.map((item) => {
      const key = profile === "alexis" ? "gramsAlexis" : "gramsElodie";
      const grams = item[key] ?? 0;
      if (grams <= 0) return item;
      return { ...item, [key]: Math.max(0, Math.round(grams * ratio * 10) / 10) };
    });
  }
  const equalized = equalizeSharedSauce({ ...meal, ingredients });
  return {
    ...equalized,
    servingsPerPerson: 1,
    alexis: declinationFromIngredients(equalized.ingredients, "alexis"),
    elodie: declinationFromIngredients(equalized.ingredients, "elodie"),
  };
}

export function formatDessertBatchForPrompt(weekdays: Weekday[], coach: MealCoachHousehold) {
  const days = formatDessertDays(weekdays);
  const n = Math.max(1, weekdays.length);
  return `DESSERT MIDI BATCH (cette semaine)
Jours : ${days} (${n} midis × 2 personnes = ${n * 2} parts à cuisiner).
JSON = 1 PART / PERSONNE (pas le total fournée).
Cible 1 part : Alexis ~${coach.alexis.dessertLunchKcal || 120} kcal · Élodie ~${coach.elodie.dessertLunchKcal || 120} kcal.
Le plat Gem Chef du déjeuner est GÉNÉRÉ À PART — ici UNIQUEMENT le dessert.`;
}

export function loadLocalWeekLunchDessert(weekStart: string): WeekLunchDessert | null {
  return parseWeekLunchDessert(storage.getJSON<unknown>(storageKey(weekStart), null));
}

function saveLocalWeekLunchDessert(weekStart: string, dessert: WeekLunchDessert | null) {
  if (!dessert) storage.remove(storageKey(weekStart));
  else storage.setJSON(storageKey(weekStart), dessert);
}

export async function loadWeekLunchDessert(weekStart: string): Promise<WeekLunchDessert | null> {
  const local = loadLocalWeekLunchDessert(weekStart);
  const supabase = createBrowserSupabaseClient();
  if (!supabase) return local;

  const { data, error } = await supabase
    .from("plans_semaine")
    .select("lunch_dessert")
    .eq("week_start", weekStart)
    .maybeSingle();
  if (error || !data) return local;
  const remote = parseWeekLunchDessert((data as { lunch_dessert?: Json }).lunch_dessert);
  if (!remote) return local;
  saveLocalWeekLunchDessert(weekStart, remote);
  return remote;
}

export async function persistWeekLunchDessert(
  weekStart: string,
  dessert: WeekLunchDessert | null,
): Promise<string | null> {
  saveLocalWeekLunchDessert(weekStart, dessert);
  const supabase = createBrowserSupabaseClient();
  if (!supabase) return null;

  const payload = dessert as unknown as Json;
  const { data } = await supabase
    .from("plans_semaine")
    .select("week_start")
    .eq("week_start", weekStart)
    .maybeSingle();

  if (!data && !dessert) return null;

  const result = data
    ? await supabase.from("plans_semaine").update({ lunch_dessert: payload }).eq("week_start", weekStart)
    : await supabase.from("plans_semaine").insert({
        week_start: weekStart,
        meals: [],
        lunch_dessert: payload,
      });

  if (!result.error) return null;
  return result.error.message.includes("lunch_dessert") ? null : result.error.message;
}

export function dessertForDate(dessert: WeekLunchDessert | null, date = todayISO()) {
  if (!dessertAppliesToday(dessert, date)) return null;
  return dessert;
}

export function currentWeekDessertMonday(date = todayISO()) {
  return mondayOf(date);
}
