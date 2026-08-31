import type { Json } from "@/lib/supabase/database.types";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { isoWeekday, mondayOf, todayISO } from "@/lib/dates";
import { macrosFromPlanned, platLinesFromPlanned } from "@/lib/serve-week-plan";
import { storage } from "@/lib/storage";
import { WEEKDAYS } from "@/lib/sport-routine";
import { equalizeSharedSauce } from "@/lib/ingredient-groups";
import { expandPreparedSauces } from "@/lib/homemade-sauces";
import { dummyTodaySwapSlot, isEmptyMeal } from "@/lib/weekly-plan";
import { visualForIngredient } from "@/lib/visual-quantity";
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
  const star =
    rows.find((item) => /konjac|shirataki|tofu soyeux/i.test(item.name))?.name ??
    rows.find((item) => item.role === "shared" && (item.gramsAlexis > 0 || item.gramsElodie > 0))?.name;
  return {
    protein: star ?? "Dessert",
    calories: Math.round(calories) || 0,
    proteinG: Math.round(protein) || 0,
    carbsG: Math.round(carbs) || 0,
    fatG: Math.round(fat) || 0,
  };
}

function isAnimalDessertIng(name: string) {
  return /oeuf|œuf|skyr|fromage blanc|mascarpone|miel|creme fraiche|crème fraîche|beurre(?! de)|lait (de vache|entier|demi)/i.test(
    name,
  );
}

function isLightSweetener(name: string) {
  return /erythritol|érythritol|stevia|stévia|sucralose/i.test(name);
}

function isDenseDessertExtra(name: string) {
  return /sirop|puree d.amande|purée d.amande|beurre d.amande|beurre de cajou|pepites|pépites|chocolat|amandes effilees|amandes effilées|noisettes|granola/i.test(
    name,
  );
}

function dessertGramCap(name: string, slot: DessertSlot) {
  const evening = slot === "soir";
  if (isBulkLightDessertIng(name)) return evening ? 180 : 200;
  if (/extrait|vanille liquide|ar[oô]me/i.test(name)) return 3;
  if (isLightSweetener(name)) return evening ? 6 : 10;
  if (/sirop/i.test(name)) return evening ? 5 : 10;
  if (/puree|purée|beurre d.amande|beurre de cajou/i.test(name)) return evening ? 5 : 8;
  if (/pepites|pépites|chocolat/i.test(name)) return evening ? 0 : 6;
  if (/amandes|noisettes|noix/i.test(name) && !/lait/.test(name)) return evening ? 0 : 8;
  if (/lait/.test(name)) return evening ? 50 : 80;
  if (/tofu soyeux/i.test(name)) return evening ? 100 : 120;
  return evening ? 80 : 140;
}

function roundDessertGrams(n: number) {
  if (n <= 0) return 0;
  if (n < 8) return Math.round(n);
  return Math.round(n * 2) / 2;
}

function withVisual(item: PlannedMeal["ingredients"][number], gramsA: number, gramsE: number) {
  const ref = Math.max(gramsA, gramsE);
  return {
    ...item,
    gramsAlexis: gramsA,
    gramsElodie: gramsE,
    visualQuantity: visualForIngredient(item.name, ref, item.visualQuantity),
  };
}

/** Même dessert, visuels = grammes, extras denses plafonnés. Perte n'a jamais plus de sirop / oléagineux. */
export function repairDessertIntegrity(
  meal: PlannedMeal,
  slot: DessertSlot = "midi",
  coach?: MealCoachHousehold | null,
): PlannedMeal {
  const hasLight = meal.ingredients.some((item) => isLightSweetener(item.name));
  let ingredients = meal.ingredients.filter((item) => {
    if (hasLight && /sirop/i.test(item.name)) return false;
    return true;
  });
  ingredients = ingredients.map((item) => {
    const cap = dessertGramCap(item.name, slot);
    if (isAnimalDessertIng(item.name)) {
      const a = Math.min(item.gramsAlexis, 0);
      const e = roundDessertGrams(Math.min(item.gramsElodie || item.gramsAlexis, cap));
      return withVisual({ ...item, role: "elodie" }, a, e);
    }
    const raw = Math.max(item.gramsAlexis, item.gramsElodie);
    let shared = roundDessertGrams(Math.min(raw || cap * 0.6, cap));
    if (shared <= 0 && !isDenseDessertExtra(item.name)) shared = 0;
    let a = shared;
    let e = shared;
    if (coach && isDenseDessertExtra(item.name)) {
      if (coach.alexis.goal === "perte" && coach.elodie.goal !== "perte") a = roundDessertGrams(shared * 0.7);
      if (coach.elodie.goal === "perte" && coach.alexis.goal !== "perte") e = roundDessertGrams(shared * 0.7);
      if (coach.alexis.goal === "perte" && coach.elodie.goal === "perte") {
        a = roundDessertGrams(shared * 0.85);
        e = roundDessertGrams(shared * 0.85);
      }
    }
    return withVisual({ ...item, role: "shared" }, a, e);
  });
  ingredients = ingredients.filter((item) => item.gramsAlexis > 0 || item.gramsElodie > 0);
  return { ...meal, ingredients };
}

export function stampDessertMeal(
  meal: PlannedMeal,
  weekdays: Weekday[],
  theme: string,
  slot: DessertSlot = "midi",
  product?: DessertProduct | null,
  coach?: MealCoachHousehold | null,
): PlannedMeal {
  const days = asWeekdays(weekdays);
  const n = days.length;
  const withProduct = repairDessertIntegrity(
    ensureDessertProductInMeal(expandPreparedSauces(meal), product),
    slot,
    coach,
  );
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
  const midi = (person: MealCoachHousehold["alexis"]) => {
    if (person.goal === "perte") return clamp(person.dessertLunchKcal || 90, 70, 100);
    if (person.goal === "prise") return clamp(person.dessertLunchKcal || 140, 110, 160);
    return clamp(person.dessertLunchKcal || 120, 90, 130);
  };
  const soir = (person: MealCoachHousehold["alexis"]) => {
    if (person.goal === "perte") return clamp(person.dessertDinnerKcal || 50, 35, 55);
    return clamp(person.dessertDinnerKcal || 60, 40, 70);
  };
  const pick = slot === "soir" ? soir : midi;
  return { alexis: pick(coach.alexis), elodie: pick(coach.elodie) };
}

export function scaleDessertToGoals(
  meal: PlannedMeal,
  coach: MealCoachHousehold | null | undefined,
  slot: DessertSlot = "midi",
  product?: DessertProduct | null,
): PlannedMeal {
  const repaired = repairDessertIntegrity(ensureDessertProductInMeal(meal, product), slot, coach);
  if (!coach) {
    return {
      ...repaired,
      servingsPerPerson: 1,
      alexis: macrosWithProduct(repaired.ingredients, "alexis", product),
      elodie: macrosWithProduct(repaired.ingredients, "elodie", product),
    };
  }
  const targets = dessertKcalTargets(coach, slot);
  let ingredients = repaired.ingredients.map((item) => ({ ...item }));
  for (const profile of ["alexis", "elodie"] as const) {
    ingredients = scaleDessertProfile(ingredients, profile, targets[profile], slot, product);
  }
  const equalized = equalizeSharedSauce({ ...repaired, ingredients });
  const withVisuals = {
    ...equalized,
    ingredients: equalized.ingredients.map((item) =>
      withVisual(item, item.gramsAlexis, item.gramsElodie),
    ),
  };
  return {
    ...withVisuals,
    servingsPerPerson: 1,
    alexis: macrosWithProduct(withVisuals.ingredients, "alexis", product),
    elodie: macrosWithProduct(withVisuals.ingredients, "elodie", product),
  };
}

function scaleDessertProfile(
  ingredients: PlannedMeal["ingredients"],
  profile: "alexis" | "elodie",
  target: number,
  slot: DessertSlot,
  product?: DessertProduct | null,
) {
  const key = profile === "alexis" ? "gramsAlexis" : "gramsElodie";
  let next = ingredients;
  for (let pass = 0; pass < 5; pass += 1) {
    const current = macrosWithProduct(next, profile, product).calories;
    if (current <= 0) break;
    const ratio = target / current;
    if (Math.abs(1 - ratio) < 0.08) break;
    const denseLeft = next.some((item) => (item[key] ?? 0) > 0 && isDenseDessertExtra(item.name));
    next = next.map((item) => {
      const grams = item[key] ?? 0;
      if (grams <= 0) return item;
      if (ratio < 1 && denseLeft && !isDenseDessertExtra(item.name)) return item;
      if (ratio > 1 && (isDenseDessertExtra(item.name) || isBulkLightDessertIng(item.name, product))) {
        return item;
      }
      const cap = dessertGramCap(item.name, slot);
      const scaled = roundDessertGrams(Math.min(cap, Math.max(0, grams * ratio)));
      return { ...item, [key]: scaled };
    });
  }
  return next;
}

export function formatDessertBatchForPrompt(
  weekdays: Weekday[],
  coach: MealCoachHousehold,
  slot: DessertSlot = "midi",
) {
  const days = formatDessertDays(weekdays);
  const n = Math.max(1, weekdays.length);
  const targets = dessertKcalTargets(coach, slot);
  const goalLine = (person: MealCoachHousehold["alexis"]) =>
    `${person.name} · ${person.goal} → ~${targets[person.id]} kcal / part${person.goal === "perte" ? " (extras denses PLUS PETITS, jamais plus)" : ""}`;
  const shared = `MÊME dessert, MÊMES ingrédients. grams_alexis / grams_elodie = portions, PAS deux recettes.
INTERDIT érythritol pour l'un et sirop d'érable / purée d'amande / pépites uniquement pour l'autre.
visual_unit DOIT coller aux grammes : 1 cs sirop ≈ 20 g, 1 cs purée d'amande ≈ 18 g, 1 poignée amandes ≈ 15–18 g, 1 cs pépites ≈ 12 g, 1 cs lait ≈ 15 g, 1 cl lait ≈ 10 g. INTERDIT 2 cs = 99 g.`;
  if (slot === "soir") {
    return `DESSERT SOIR BATCH · TRÈS LIGHT (cette semaine)
Jours : ${days} (${n} soirs × 2 personnes = ${n * 2} parts).
JSON = 1 PART / PERSONNE.
${goalLine(coach.alexis)}
${goalLine(coach.elodie)}
${shared}
Base : tofu soyeux et/ou konjac / shirataki. INTERDIT pâte brisée, beurre, crème, mascarpone, plus de 8 g de sucre / sirop par part.
Gourmand : vanille, cacao, agrume, cannelle, un peu de fruit.
Le dîner Gem Chef est GÉNÉRÉ À PART — ici UNIQUEMENT le dessert soir.`;
  }
  return `DESSERT MIDI BATCH (cette semaine)
Jours : ${days} (${n} midis × 2 personnes = ${n * 2} parts à cuisiner).
JSON = 1 PART / PERSONNE (pas le total fournée).
${goalLine(coach.alexis)}
${goalLine(coach.elodie)}
${shared}
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
