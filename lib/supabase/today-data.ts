import type { SupabaseClient } from "@supabase/supabase-js";
import { isoWeekday, mondayOf, todayISO, yesterdayISO } from "@/lib/dates";
import { mapProfil, mapRepas } from "@/lib/mappers";
import type { SwapProposal } from "@/lib/swap-proposals";
import type { Database } from "@/lib/supabase/database.types";
import type { MealEntry, MealType, Profile, ProfileId, SlotTemplate, SlotTemplateKind } from "@/lib/types";
import {
  emptySlotTemplate,
  loadHouseholdMealTemplates,
  mealFromTemplate,
  mealTypeForTemplate,
  mergeDessertIntoMeal,
  parseMealTemplates,
  plannedSlotEntry,
  templateForSlot,
  withKeptDessert,
} from "@/lib/meal-templates";
import {
  mergeWeekPlatIntoMeal,
  plannedMealForDay,
  shouldAutoServePlat,
  todayPlatFromPlanned,
} from "@/lib/serve-week-plan";
import { loadWeekPlan } from "@/lib/supabase/week-plans";

export async function fetchProfils(
  supabase: SupabaseClient<Database>,
): Promise<Record<ProfileId, Profile> | null> {
  const { data, error } = await supabase.from("profils").select("*");
  if (error || !data) return null;
  const alexis = data.find((row) => row.id === "alexis");
  const elodie = data.find((row) => row.id === "elodie");
  if (!alexis || !elodie) return null;
  return { alexis: mapProfil(alexis), elodie: mapProfil(elodie) };
}

export async function fetchTodayMeals(
  supabase: SupabaseClient<Database>,
  profileIds: ProfileId[],
  date = todayISO(),
): Promise<{ meals: MealEntry[]; error?: string }> {
  const { data, error } = await supabase
    .from("repas")
    .select("*")
    .eq("date", date)
    .in("profile_id", profileIds)
    .order("heure", { ascending: true });

  if (error) return { meals: [], error: error.message };
  const mapped = (data ?? []).map(mapRepas);
  const { keep, extraIds } = pickCanonicalMeals(mapped);
  if (extraIds.length > 0) {
    await supabase.from("repas").delete().in("id", extraIds);
  }
  return { meals: keep };
}

export function pickCanonicalMeals(meals: MealEntry[]): { keep: MealEntry[]; extraIds: string[] } {
  const groups = new Map<string, MealEntry[]>();
  for (const meal of meals) {
    const key = `${meal.profileId}:${meal.type}`;
    const list = groups.get(key) ?? [];
    list.push(meal);
    groups.set(key, list);
  }
  const keep: MealEntry[] = [];
  const extraIds: string[] = [];
  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => {
      if (Boolean(a.isSkipped) !== Boolean(b.isSkipped)) return a.isSkipped ? 1 : -1;
      return b.macros.calories - a.macros.calories;
    });
    keep.push(sorted[0]);
    extraIds.push(...sorted.slice(1).map((item) => item.id));
  }
  return { keep, extraIds };
}

const STORED_MEAL_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when the meal row exists in `repas` (UUID). Client overlays use `week-…` / `alexis-…`. */
export function isStoredMealId(id: string) {
  return STORED_MEAL_ID.test(id);
}

export async function insertMeal(
  supabase: SupabaseClient<Database>,
  meal: Omit<MealEntry, "id">,
) {
  const { error } = await supabase.from("repas").insert({
    profile_id: meal.profileId,
    date: todayISO(),
    heure: meal.time || null,
    type: meal.type,
    nom: meal.name,
    items: meal.items ?? [],
    calories: meal.macros.calories,
    proteines_g: meal.macros.protein,
    glucides_g: meal.macros.carbs,
    lipides_g: meal.macros.fat,
    source: meal.source,
    is_skipped: meal.isSkipped ?? false,
    notes: meal.notes ?? null,
  });
  return error?.message;
}

export async function updateMeal(
  supabase: SupabaseClient<Database>,
  meal: MealEntry,
) {
  const { error } = await supabase
    .from("repas")
    .update({
      type: meal.type,
      nom: meal.name,
      items: meal.items ?? [],
      calories: meal.macros.calories,
      proteines_g: meal.macros.protein,
      glucides_g: meal.macros.carbs,
      lipides_g: meal.macros.fat,
      is_skipped: meal.isSkipped ?? false,
      notes: meal.notes ?? null,
    })
    .eq("id", meal.id);
  return error?.message;
}

/** Update a DB row, or insert when the card is a local overlay (week plat / template). */
export async function upsertMeal(
  supabase: SupabaseClient<Database>,
  meal: MealEntry,
) {
  if (isStoredMealId(meal.id)) {
    const { data, error } = await supabase
      .from("repas")
      .update({
        type: meal.type,
        nom: meal.name,
        items: meal.items ?? [],
        calories: meal.macros.calories,
        proteines_g: meal.macros.protein,
        glucides_g: meal.macros.carbs,
        lipides_g: meal.macros.fat,
        is_skipped: meal.isSkipped ?? false,
        notes: meal.notes ?? null,
      })
      .eq("id", meal.id)
      .select("id");
    if (error) return error.message;
    if (data && data.length > 0) return;
  }
  return insertMeal(supabase, meal);
}

export async function restorePlannedMeals(
  supabase: SupabaseClient<Database>,
  profileId: ProfileId,
  types: MealType[],
): Promise<{ error?: string }> {
  if (types.length === 0) return {};
  const today = todayISO();
  const removed = await supabase
    .from("repas")
    .delete()
    .eq("date", today)
    .eq("profile_id", profileId)
    .in("type", types);
  if (removed.error) return { error: removed.error.message };

  const weekTypes = types.filter((type): type is "dejeuner" | "diner" => type === "dejeuner" || type === "diner");
  if (weekTypes.length > 0) {
    await applyWeekPlatsToToday(supabase, today, { profileIds: [profileId], types: weekTypes, force: true });
  }

  const slots: TemplateSlot[] = [];
  if (types.includes("petit-dejeuner")) slots.push("petit-dejeuner");
  if (types.includes("collation")) slots.push("collation");
  if (types.includes("dejeuner")) slots.push("dessert-midi");
  if (types.includes("diner")) slots.push("dessert-soir");
  if (slots.length > 0) {
    await applyTodaySlotTemplates(supabase, today, {
      replacePlan: true,
      force: true,
      profileIds: [profileId],
      slots,
    });
  }
  return {};
}

export function plannedMealEntry(
  profileId: ProfileId,
  type: MealType,
  date = todayISO(),
  templates?: SlotTemplate[],
): MealEntry | null {
  return plannedSlotEntry(profileId, type, date, templates);
}

function plannedRowFromTemplate(profileId: ProfileId, date: string, template: SlotTemplate) {
  const entry = mealFromTemplate(profileId, template);
  return {
    profile_id: profileId,
    date,
    type: entry.type,
    heure: entry.time || null,
    nom: entry.name,
    items: entry.items ?? [],
    calories: entry.macros.calories,
    proteines_g: entry.macros.protein,
    glucides_g: entry.macros.carbs,
    lipides_g: entry.macros.fat,
    source: "plan" as const,
    is_planned: true,
    is_skipped: false,
  };
}

type TemplateSlot = SlotTemplateKind;

function isLoggedSource(source: MealEntry["source"] | string | null | undefined) {
  return source === "text" || source === "photo" || source === "barcode" || source === "log";
}

function emptyDessert(slot: "dessert-midi" | "dessert-soir") {
  return { ...emptySlotTemplate(slot), items: [], macros: { calories: 0, protein: 0, carbs: 0, fat: 0 } };
}

function dessertMealFromRow(
  row: {
    id: string;
    nom: string | null;
    heure: string | null;
    calories: number | null;
    proteines_g: number | null;
    glucides_g: number | null;
    lipides_g: number | null;
    source: string | null;
    is_skipped: boolean | null;
    items: unknown;
    notes?: string | null;
  },
  profileId: ProfileId,
  type: MealType,
): MealEntry {
  const source =
    row.source === "log" || row.source === "photo" || row.source === "barcode" || row.source === "text"
      ? row.source
      : "plan";
  return {
    id: row.id,
    name: row.nom ?? "",
    type,
    time: row.heure ? String(row.heure).slice(0, 5) : "",
    macros: {
      calories: row.calories ?? 0,
      protein: Number(row.proteines_g ?? 0),
      carbs: Number(row.glucides_g ?? 0),
      fat: Number(row.lipides_g ?? 0),
    },
    profileId,
    source,
    items: Array.isArray(row.items) ? row.items.map(String) : [],
    isSkipped: Boolean(row.is_skipped),
    notes: row.notes ?? undefined,
  };
}

function isLegacySeedBreakfast(name: string) {
  const n = name.toLowerCase();
  return n.includes("overnight oats") || n.includes("skyr, granola");
}

export function fillMissingSlotsFromTemplates(
  meals: MealEntry[],
  profileIds: ProfileId[],
  date = todayISO(),
  household: Record<ProfileId, SlotTemplate[]> = loadHouseholdMealTemplates(),
  opts: { createMissing?: boolean } = {},
): MealEntry[] {
  const weekday = isoWeekday(date);
  const createMissing = opts.createMissing !== false;
  const next = meals.filter((meal) => {
    if (!profileIds.includes(meal.profileId)) return true;
    if (meal.type !== "petit-dejeuner" && meal.type !== "collation") return true;
    if (isLoggedSource(meal.source) || meal.isSkipped) return true;
    if (meal.source === "plan" && isLegacySeedBreakfast(meal.name)) return false;
    return true;
  });
  for (const id of profileIds) {
    for (const slot of ["petit-dejeuner", "collation"] as const) {
      if (next.some((meal) => meal.profileId === id && meal.type === slot)) continue;
      if (!createMissing) continue;
      const template = templateForSlot(household[id], slot, weekday);
      if (!template) continue;
      next.push(mealFromTemplate(id, template, `${id}-${slot}-${date}`));
    }
    for (const slot of ["dessert-midi", "dessert-soir"] as const) {
      const template = templateForSlot(household[id], slot, weekday);
      if (!template || !template.items.length) continue;
      const mealType = mealTypeForTemplate(slot);
      const index = next.findIndex((meal) => meal.profileId === id && meal.type === mealType);
      if (index < 0) {
        if (!createMissing) continue;
        const entry = mealFromTemplate(id, template, `${id}-${slot}-${date}`);
        next.push({
          ...entry,
          name: mealType === "diner" ? "Dîner" : "Déjeuner",
        });
        continue;
      }
      const current = next[index];
      if (current.isSkipped) continue;
      next[index] = mergeDessertIntoMeal(current, template);
    }
  }
  return next;
}

async function householdTemplatesFromDb(
  supabase: SupabaseClient<Database>,
): Promise<Record<ProfileId, SlotTemplate[]>> {
  const local = loadHouseholdMealTemplates();
  const { data } = await supabase.from("profils").select("id, meal_templates");
  if (!data?.length) return local;
  const alexis = data.find((row) => row.id === "alexis");
  const elodie = data.find((row) => row.id === "elodie");
  return {
    alexis: parseMealTemplates(alexis?.meal_templates ?? local.alexis, "alexis"),
    elodie: parseMealTemplates(elodie?.meal_templates ?? local.elodie, "elodie"),
  };
}

export async function applyTodaySlotTemplates(
  supabase: SupabaseClient<Database>,
  date = todayISO(),
  opts: {
    replacePlan?: boolean;
    force?: boolean;
    profileIds?: ProfileId[];
    slots?: TemplateSlot[];
  } = {},
): Promise<boolean> {
  const weekday = isoWeekday(date);
  const household = await householdTemplatesFromDb(supabase);
  const existing = await supabase
    .from("repas")
    .select("id, profile_id, type, source, is_skipped, nom, items, calories, proteines_g, glucides_g, lipides_g, heure")
    .eq("date", date);
  if (existing.error) return false;

  const byKey = new Map(
    (existing.data ?? []).map((row) => [`${row.profile_id}:${row.type}`, row] as const),
  );
  const profileIds = opts.profileIds ?? (["alexis", "elodie"] as const);
  const wantSlot = (slot: TemplateSlot) => !opts.slots || opts.slots.includes(slot);
  let changed = false;
  for (const id of profileIds) {
    for (const slot of ["petit-dejeuner", "collation"] as const) {
      if (!wantSlot(slot)) continue;
      const template = templateForSlot(household[id], slot, weekday);
      if (!template) continue;
      const payload = plannedRowFromTemplate(id, date, template);
      const current = byKey.get(`${id}:${slot}`);
      if (!current) {
        const inserted = await supabase.from("repas").insert(payload);
        if (!inserted.error) changed = true;
        continue;
      }
      if (current.is_skipped || isLoggedSource(current.source)) {
        if (!opts.force) continue;
      }
      const replace =
        Boolean(opts.force) ||
        Boolean(opts.replacePlan) ||
        (current.source === "plan" && isLegacySeedBreakfast(current.nom ?? ""));
      if (!replace) continue;
      const updated = await supabase
        .from("repas")
        .update({
          nom: payload.nom,
          items: payload.items,
          calories: payload.calories,
          proteines_g: payload.proteines_g,
          glucides_g: payload.glucides_g,
          lipides_g: payload.lipides_g,
          heure: payload.heure,
          source: "plan",
          is_planned: true,
          is_skipped: false,
        })
        .eq("id", current.id);
      if (!updated.error) changed = true;
    }
    for (const slot of ["dessert-midi", "dessert-soir"] as const) {
      if (!wantSlot(slot)) continue;
      const template = templateForSlot(household[id], slot, weekday);
      const mealType = mealTypeForTemplate(slot);
      const current = byKey.get(`${id}:${mealType}`);
      if (!template || !template.items.length) {
        if (!current || ((current.is_skipped || isLoggedSource(current.source)) && !opts.force) || !opts.replacePlan) continue;
        const stripped = mergeDessertIntoMeal(dessertMealFromRow(current, id, mealType), emptyDessert(slot), {
          replace: true,
        });
        const cleared = await supabase
          .from("repas")
          .update({
            items: stripped.items ?? [],
            calories: stripped.macros.calories,
            proteines_g: stripped.macros.protein,
            glucides_g: stripped.macros.carbs,
            lipides_g: stripped.macros.fat,
          })
          .eq("id", current.id);
        if (!cleared.error) changed = true;
        continue;
      }
      if (!current) {
        const entry = mealFromTemplate(id, template);
        const inserted = await supabase.from("repas").insert({
          profile_id: id,
          date,
          type: mealType,
          heure: entry.time || null,
          nom: mealType === "diner" ? "Dîner" : "Déjeuner",
          items: entry.items ?? [],
          calories: entry.macros.calories,
          proteines_g: entry.macros.protein,
          glucides_g: entry.macros.carbs,
          lipides_g: entry.macros.fat,
          source: "plan",
          is_planned: true,
          is_skipped: false,
        });
        if (!inserted.error) changed = true;
        continue;
      }
      if (current.is_skipped && !opts.force) continue;
      const merged = mergeDessertIntoMeal(dessertMealFromRow(current, id, mealType), template, {
        replace: Boolean(opts.replacePlan) || Boolean(opts.force),
      });
      const updated = await supabase
        .from("repas")
        .update({
          items: merged.items ?? [],
          calories: merged.macros.calories,
          proteines_g: merged.macros.protein,
          glucides_g: merged.macros.carbs,
          lipides_g: merged.macros.fat,
          is_skipped: opts.force ? false : current.is_skipped,
        })
        .eq("id", current.id);
      if (!updated.error) changed = true;
    }
  }
  return changed;
}

export async function applyWeekPlatsToToday(
  supabase: SupabaseClient<Database>,
  date = todayISO(),
  opts: {
    profileIds?: ProfileId[];
    types?: Array<"dejeuner" | "diner">;
    force?: boolean;
  } = {},
): Promise<boolean> {
  const { plan } = await loadWeekPlan(mondayOf(date));
  const profileIds = opts.profileIds ?? (["alexis", "elodie"] as const);
  const types = opts.types ?? (["dejeuner", "diner"] as const);
  const existing = await supabase
    .from("repas")
    .select("id, profile_id, type, source, is_skipped, nom, items, calories, proteines_g, glucides_g, lipides_g, heure, notes")
    .eq("date", date);
  if (existing.error) return false;

  const byKey = new Map(
    (existing.data ?? []).map((row) => [`${row.profile_id}:${row.type}`, row] as const),
  );
  let changed = false;

  for (const id of profileIds) {
    for (const type of types) {
      const planned = plannedMealForDay(plan, date, type);
      if (!planned) continue;
      const plat = todayPlatFromPlanned(planned, id, date);
      const current = byKey.get(`${id}:${type}`);
      if (!current) {
        const inserted = await supabase.from("repas").insert({
          profile_id: id,
          date,
          type,
          heure: plat.time || null,
          nom: plat.name,
          items: plat.items ?? [],
          calories: plat.macros.calories,
          proteines_g: plat.macros.protein,
          glucides_g: plat.macros.carbs,
          lipides_g: plat.macros.fat,
          source: "plan",
          is_planned: true,
          is_skipped: false,
          notes: plat.notes ?? null,
        });
        if (!inserted.error) changed = true;
        continue;
      }
      const meal = dessertMealFromRow(current, id, type);
      if (!opts.force && !shouldAutoServePlat(meal)) continue;
      const merged = mergeWeekPlatIntoMeal(meal, plat);
      const updated = await supabase
        .from("repas")
        .update({
          nom: merged.name,
          items: merged.items ?? [],
          calories: merged.macros.calories,
          proteines_g: merged.macros.protein,
          glucides_g: merged.macros.carbs,
          lipides_g: merged.macros.fat,
          heure: merged.time || current.heure,
          source: "plan",
          is_planned: true,
          is_skipped: false,
          notes: merged.notes ?? null,
        })
        .eq("id", current.id);
      if (!updated.error) changed = true;
    }
  }
  return changed;
}

export async function setMealSkipped(
  supabase: SupabaseClient<Database>,
  mealId: string,
  isSkipped: boolean,
) {
  const { error } = await supabase
    .from("repas")
    .update({ is_skipped: isSkipped })
    .eq("id", mealId);
  return error?.message;
}

export async function copyYesterdayMeals(
  supabase: SupabaseClient<Database>,
  profileIds: ProfileId[],
  mealTypes: MealType[],
): Promise<{ copied: number; error?: string }> {
  if (mealTypes.length === 0) return { copied: 0 };

  const today = todayISO();
  const yesterday = yesterdayISO();

  const previous = await supabase
    .from("repas")
    .select("*")
    .eq("date", yesterday)
    .in("profile_id", profileIds)
    .in("type", mealTypes);

  if (previous.error) return { copied: 0, error: previous.error.message };
  const rows = (previous.data ?? []).filter((row) => !row.is_skipped);
  if (rows.length === 0) return { copied: 0 };

  const existingToday = await supabase
    .from("repas")
    .select("id, profile_id, type")
    .eq("date", today)
    .in("profile_id", profileIds)
    .in("type", mealTypes);

  if (existingToday.error) return { copied: 0, error: existingToday.error.message };

  const availableToday = [...(existingToday.data ?? [])];
  let copied = 0;

  for (const row of rows) {
    const fields = {
      heure: row.heure,
      nom: row.nom,
      base_partagee: row.base_partagee,
      proteine: row.proteine,
      items: row.items,
      calories: row.calories,
      proteines_g: row.proteines_g,
      glucides_g: row.glucides_g,
      lipides_g: row.lipides_g,
      source: "log" as const,
      is_planned: false,
      low_calorie: row.low_calorie,
      appliances: row.appliances,
      notes: row.notes,
      is_skipped: false,
    };

    const matchIndex = availableToday.findIndex(
      (meal) => meal.profile_id === row.profile_id && meal.type === row.type,
    );

    if (matchIndex >= 0) {
      const target = availableToday.splice(matchIndex, 1)[0];
      const updated = await supabase.from("repas").update(fields).eq("id", target.id);
      if (updated.error) return { copied, error: updated.error.message };
    } else {
      const inserted = await supabase.from("repas").insert({
        profile_id: row.profile_id,
        group_id: row.group_id,
        date: today,
        type: row.type,
        ...fields,
      });
      if (inserted.error) return { copied, error: inserted.error.message };
    }
    copied += 1;
  }

  return { copied };
}

export async function swapMeal(
  supabase: SupabaseClient<Database>,
  profileIds: ProfileId[],
  mealType: MealType,
  proposals: Partial<Record<ProfileId, SwapProposal>>,
): Promise<{ swapped: number; error?: string }> {
  const today = todayISO();
  let swapped = 0;

  for (const id of profileIds) {
    const next = proposals[id];
    if (!next) continue;

    const { data, error } = await supabase
      .from("repas")
      .select("id, items, calories, proteines_g, glucides_g, lipides_g")
      .eq("date", today)
      .eq("profile_id", id)
      .eq("type", mealType)
      .limit(1)
      .maybeSingle();

    if (error) return { swapped, error: error.message };
    if (!data) continue;

    const existingItems = Array.isArray(data.items) ? data.items.map(String) : [];
    const kept = withKeptDessert(existingItems, next.items, {
      calories: next.calories,
      protein: next.proteines_g,
      carbs: next.glucides_g,
      fat: next.lipides_g,
    });

    const updated = await supabase
      .from("repas")
      .update({
        nom: next.nom,
        calories: kept.macros.calories,
        proteines_g: kept.macros.protein,
        glucides_g: kept.macros.carbs,
        lipides_g: kept.macros.fat,
        items: kept.items,
        low_calorie: next.lowCalorie,
        is_skipped: false,
        notes: `Remplacement · ${next.theme}`,
      })
      .eq("id", data.id);

    if (updated.error) return { swapped, error: updated.error.message };
    swapped += 1;
  }

  return { swapped };
}

export async function setFasting(
  supabase: SupabaseClient<Database>,
  profileId: ProfileId,
  fasting: boolean,
) {
  const today = todayISO();
  const existing = await supabase
    .from("logs_sante")
    .select("id")
    .eq("profile_id", profileId)
    .eq("date", today)
    .eq("kind", "checkin")
    .limit(1)
    .maybeSingle();

  if (existing.data?.id) {
    return supabase.from("logs_sante").update({ fasting }).eq("id", existing.data.id);
  }

  return supabase.from("logs_sante").insert({
    profile_id: profileId,
    date: today,
    kind: "checkin",
    source: "manual",
    fasting,
  });
}

export async function fetchFasting(
  supabase: SupabaseClient<Database>,
  profileIds: ProfileId[],
): Promise<Record<ProfileId, boolean>> {
  const result: Record<ProfileId, boolean> = { alexis: false, elodie: false };
  const { data } = await supabase
    .from("logs_sante")
    .select("profile_id, fasting")
    .eq("date", todayISO())
    .eq("kind", "checkin")
    .in("profile_id", profileIds);

  for (const row of data ?? []) {
    result[row.profile_id] = Boolean(row.fasting);
  }
  return result;
}
