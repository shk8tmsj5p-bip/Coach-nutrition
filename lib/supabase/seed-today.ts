import type { SupabaseClient } from "@supabase/supabase-js";
import { todayISO, yesterdayISO } from "@/lib/dates";
import {
  buildTodaySeedMeals,
  buildYesterdaySeedMeals,
  SEED_PROFILS,
} from "@/lib/supabase/seed-data";
import type { Database } from "@/lib/supabase/database.types";

export type SeedResult = {
  ok: boolean;
  seeded: boolean;
  error?: string;
};

/** Injecte profils + repas du jour (et d'hier) si la table repas est vide pour aujourd'hui. */
export async function ensureDemoMeals(
  supabase: SupabaseClient<Database>,
): Promise<SeedResult> {
  const today = todayISO();
  const yesterday = yesterdayISO();

  const profils = await supabase.from("profils").upsert(SEED_PROFILS, { onConflict: "id" });
  if (profils.error) {
    return { ok: false, seeded: false, error: profils.error.message };
  }

  const existing = await supabase
    .from("repas")
    .select("id", { count: "exact", head: true })
    .eq("date", today);

  if (existing.error) {
    return { ok: false, seeded: false, error: existing.error.message };
  }
  if ((existing.count ?? 0) > 0) {
    return { ok: true, seeded: false };
  }

  const yesterdayCount = await supabase
    .from("repas")
    .select("id", { count: "exact", head: true })
    .eq("date", yesterday);

  const rows = [
    ...buildTodaySeedMeals(today),
    ...((yesterdayCount.count ?? 0) > 0 ? [] : buildYesterdaySeedMeals(yesterday)),
  ];

  const inserted = await supabase.from("repas").insert(rows);
  if (inserted.error) {
    return { ok: false, seeded: false, error: inserted.error.message };
  }

  return { ok: true, seeded: true };
}
