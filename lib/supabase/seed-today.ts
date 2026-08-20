import type { SupabaseClient } from "@supabase/supabase-js";
import { todayISO, yesterdayISO } from "@/lib/dates";
import { buildYesterdaySeedMeals, SEED_PROFILS } from "@/lib/supabase/seed-data";
import { applyTodaySlotTemplates, applyWeekPlatsToToday } from "@/lib/supabase/today-data";
import type { Database } from "@/lib/supabase/database.types";

export type SeedResult = {
  ok: boolean;
  seeded: boolean;
  error?: string;
};

/** Profils + templates du jour + plat de la semaine. Ne plus seed des déjeuners/dîners démo. */
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

  if ((existing.count ?? 0) === 0) {
    const yesterdayCount = await supabase
      .from("repas")
      .select("id", { count: "exact", head: true })
      .eq("date", yesterday);
    if ((yesterdayCount.count ?? 0) === 0) {
      const inserted = await supabase.from("repas").insert(buildYesterdaySeedMeals(yesterday));
      if (inserted.error) {
        return { ok: false, seeded: false, error: inserted.error.message };
      }
    }
  }

  const appliedTpl = await applyTodaySlotTemplates(supabase, today);
  const appliedWeek = await applyWeekPlatsToToday(supabase, today);
  return { ok: true, seeded: appliedTpl || appliedWeek };
}
