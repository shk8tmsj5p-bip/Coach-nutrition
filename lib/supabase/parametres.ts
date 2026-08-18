import type { Json, ParametresRow } from "@/lib/supabase/database.types";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  loadKitchenPrefs,
  parseKitchenPrefs,
  saveKitchenPrefsLocal,
  type KitchenPrefs,
} from "@/lib/kitchen-prefs";

function fromRow(row: ParametresRow): KitchenPrefs {
  const fromJson = parseKitchenPrefs(row.kitchen_prefs);
  return {
    ...fromJson,
    dinnersLowCal: row.dinners_low_calorie,
    tofuWeekdayFresh: row.tofu_never_cooked_in_batch,
  };
}

export async function hydrateKitchenPrefsFromSupabase(): Promise<KitchenPrefs> {
  const local = loadKitchenPrefs();
  const supabase = createBrowserSupabaseClient();
  if (!supabase) return local;

  const { data, error } = await supabase.from("parametres").select("*").eq("id", "foyer").maybeSingle();
  if (error || !data) return local;

  const merged = fromRow(data);
  saveKitchenPrefsLocal(merged);
  return merged;
}

export async function persistKitchenPrefs(prefs: KitchenPrefs): Promise<string | null> {
  saveKitchenPrefsLocal(prefs);
  const supabase = createBrowserSupabaseClient();
  if (!supabase) return null;

  const payload = {
    id: "foyer" as const,
    dinners_low_calorie: prefs.dinnersLowCal,
    tofu_never_cooked_in_batch: prefs.tofuWeekdayFresh,
    kitchen_prefs: prefs as unknown as Json,
  };

  const { error } = await supabase.from("parametres").upsert(payload, { onConflict: "id" });
  if (!error) return null;

  const { error: fallback } = await supabase
    .from("parametres")
    .upsert(
      {
        id: "foyer",
        dinners_low_calorie: prefs.dinnersLowCal,
        tofu_never_cooked_in_batch: prefs.tofuWeekdayFresh,
      },
      { onConflict: "id" },
    );
  return fallback?.message ?? error.message;
}
