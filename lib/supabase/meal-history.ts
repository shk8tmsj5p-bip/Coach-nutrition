import { storage } from "@/lib/storage";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { annotatePlan } from "@/lib/weekly-plan";
import { parseWeekLunchDessert } from "@/lib/week-dessert";
import type { PlannedMeal } from "@/lib/types";
import {
  historyFromDessert,
  historyFromPlan,
  mergeMealHistory,
  type MealHistoryItem,
} from "@/lib/meal-history";

function planKey(weekStart: string) {
  return `weekly-plan:${weekStart}`;
}

function isPlan(value: unknown): value is PlannedMeal[] {
  return Array.isArray(value) && value.length > 0 && Array.isArray((value[0] as PlannedMeal)?.ingredients);
}

function isIsoMonday(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function localWeekStarts(): string[] {
  const starts = new Set<string>();
  for (const prefix of ["weekly-plan:", "week-lunch-dessert:", "week-dinner-dessert:"]) {
    for (const key of storage.keysStartingWith(prefix)) {
      const start = key.slice(prefix.length);
      if (isIsoMonday(start)) starts.add(start);
    }
  }
  return [...starts];
}

function localWeek(weekStart: string): MealHistoryItem[] {
  const plan = storage.getJSON<PlannedMeal[] | null>(planKey(weekStart), null);
  const fromPlan = isPlan(plan) ? historyFromPlan(annotatePlan(plan), weekStart) : [];
  const midi = historyFromDessert(
    parseWeekLunchDessert(storage.getJSON(`week-lunch-dessert:${weekStart}`, null), "midi"),
    weekStart,
  );
  const soir = historyFromDessert(
    parseWeekLunchDessert(storage.getJSON(`week-dinner-dessert:${weekStart}`, null), "soir"),
    weekStart,
  );
  return [...fromPlan, ...(midi ? [midi] : []), ...(soir ? [soir] : [])];
}

/** Tous les plats + desserts déjà générés (`plans_semaine` + cache local). Une entrée par titre × semaine. */
export async function loadMealHistory(): Promise<MealHistoryItem[]> {
  const local = localWeekStarts().flatMap((start) => localWeek(start));

  const supabase = createBrowserSupabaseClient();
  if (!supabase) return mergeMealHistory([local]);

  type HistoryRow = {
    week_start: string | null;
    theme: string | null;
    meals: unknown;
    lunch_dessert?: unknown;
    dinner_dessert?: unknown;
  };
  let rows: HistoryRow[] = [];
  const first = await supabase
    .from("plans_semaine")
    .select("week_start, theme, meals, lunch_dessert, dinner_dessert")
    .order("week_start", { ascending: false });

  if (first.error && /lunch_dessert|dinner_dessert/.test(first.error.message)) {
    const retry = await supabase
      .from("plans_semaine")
      .select("week_start, theme, meals")
      .order("week_start", { ascending: false });
    if (retry.error || !retry.data) return mergeMealHistory([local]);
    rows = retry.data;
  } else if (first.error || !first.data) {
    return mergeMealHistory([local]);
  } else {
    rows = first.data;
  }

  const remote: MealHistoryItem[] = [];
  for (const row of rows) {
    const weekStart = String(row.week_start ?? "");
    if (!weekStart) continue;
    const theme = typeof row.theme === "string" ? row.theme : "";
    if (isPlan(row.meals)) {
      remote.push(...historyFromPlan(annotatePlan(row.meals), weekStart, theme));
    }
    const midi = historyFromDessert(parseWeekLunchDessert(row.lunch_dessert, "midi"), weekStart);
    const soir = historyFromDessert(parseWeekLunchDessert(row.dinner_dessert, "soir"), weekStart);
    if (midi) remote.push(midi);
    if (soir) remote.push(soir);
  }
  return mergeMealHistory([remote, local]);
}
