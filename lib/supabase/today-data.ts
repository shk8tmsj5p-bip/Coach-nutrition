import type { SupabaseClient } from "@supabase/supabase-js";
import { todayISO, yesterdayISO } from "@/lib/dates";
import { mapProfil, mapRepas } from "@/lib/mappers";
import type { SwapProposal } from "@/lib/swap-proposals";
import type { Database } from "@/lib/supabase/database.types";
import type { MealEntry, MealType, Profile, ProfileId } from "@/lib/types";

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
    })
    .eq("id", meal.id);
  return error?.message;
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
      .select("id")
      .eq("date", today)
      .eq("profile_id", id)
      .eq("type", mealType)
      .limit(1)
      .maybeSingle();

    if (error) return { swapped, error: error.message };
    if (!data) continue;

    const updated = await supabase
      .from("repas")
      .update({
        nom: next.nom,
        calories: next.calories,
        proteines_g: next.proteines_g,
        glucides_g: next.glucides_g,
        lipides_g: next.lipides_g,
        items: next.items,
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
