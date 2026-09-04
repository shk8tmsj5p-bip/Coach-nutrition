import type { PlannedMeal } from "@/lib/types";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/database.types";
import { emptyWeekPlan, annotatePlan, isEmptyMeal } from "@/lib/weekly-plan";
import { addDaysISO } from "@/lib/dates";
import { storage } from "@/lib/storage";
import { clearLocalShopping } from "@/lib/supabase/shopping-list";

function storageKey(weekStart: string) {
  return `weekly-plan:${weekStart}`;
}

function isPlan(value: unknown): value is PlannedMeal[] {
  return Array.isArray(value) && value.length > 0 && Array.isArray((value[0] as PlannedMeal)?.ingredients);
}

export async function loadWeekPlan(weekStart: string): Promise<{
  plan: PlannedMeal[];
  theme: string;
  source: "supabase" | "local" | "seed";
}> {
  const local = storage.getJSON<PlannedMeal[] | null>(storageKey(weekStart), null);
  const supabase = createBrowserSupabaseClient();
  if (!supabase) {
    if (isPlan(local)) return { plan: annotatePlan(local), theme: "", source: "local" };
    return { plan: emptyWeekPlan(), theme: "", source: "seed" };
  }

  const { data, error } = await supabase
    .from("plans_semaine")
    .select("meals, theme")
    .eq("week_start", weekStart)
    .maybeSingle();

  if (!error && data && isPlan(data.meals)) {
    const plan = annotatePlan(data.meals);
    storage.setJSON(storageKey(weekStart), plan);
    return { plan, theme: data.theme ?? "", source: "supabase" };
  }

  if (isPlan(local)) return { plan: annotatePlan(local), theme: "", source: "local" };
  return { plan: emptyWeekPlan(), theme: "", source: "seed" };
}

function collectTitles(plan: PlannedMeal[], titles: Set<string>) {
  for (const meal of plan) {
    if (isEmptyMeal(meal)) continue;
    const name = meal.baseName?.trim();
    if (name) titles.add(name);
  }
}

/** Titres uniques des 8 semaines précédant `beforeWeekStart` (lundi). */
export async function loadRecentMealTitles(beforeWeekStart: string, weeks = 8): Promise<string[]> {
  const titles = new Set<string>();
  const starts: string[] = [];
  for (let i = 1; i <= weeks; i += 1) {
    starts.push(addDaysISO(beforeWeekStart, -7 * i));
  }

  for (const start of starts) {
    const local = storage.getJSON<PlannedMeal[] | null>(storageKey(start), null);
    if (isPlan(local)) collectTitles(local, titles);
  }

  const supabase = createBrowserSupabaseClient();
  if (supabase && starts.length > 0) {
    const oldest = starts[starts.length - 1];
    const { data } = await supabase
      .from("plans_semaine")
      .select("week_start, meals")
      .gte("week_start", oldest)
      .lt("week_start", beforeWeekStart);

    for (const row of data ?? []) {
      if (isPlan(row.meals)) collectTitles(row.meals as PlannedMeal[], titles);
    }
  }

  return [...titles];
}

export async function deleteWeekPlan(weekStart: string): Promise<string | null> {
  storage.remove(storageKey(weekStart));
  clearLocalShopping(weekStart);
  const supabase = createBrowserSupabaseClient();
  if (!supabase) return null;
  const { error } = await supabase.from("plans_semaine").delete().eq("week_start", weekStart);
  return error?.message ?? null;
}

export function subscribeWeekPlan(weekStart: string, onChange: () => void, channelName?: string) {
  const supabase = createBrowserSupabaseClient();
  if (!supabase) return () => {};
  const channel = supabase
    .channel(channelName ?? `plans-semaine:${weekStart}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "plans_semaine", filter: `week_start=eq.${weekStart}` },
      () => onChange(),
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function saveWeekPlan(
  weekStart: string,
  plan: PlannedMeal[],
  theme: string,
): Promise<string | null> {
  storage.setJSON(storageKey(weekStart), plan);
  const supabase = createBrowserSupabaseClient();
  if (!supabase) return null;

  const { error } = await supabase.from("plans_semaine").upsert({
    week_start: weekStart,
    theme: theme.trim() || null,
    meals: plan as unknown as Json,
  });
  return error?.message ?? null;
}
