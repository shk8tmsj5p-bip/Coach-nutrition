import type { ProfilRow, RepasRow } from "@/lib/supabase/database.types";
import { parseAppliedAdjustments } from "@/lib/coach-adjustments";
import { parseSportRoutine } from "@/lib/sport-routine";
import type { MealEntry, Profile } from "@/lib/types";

export function mapProfil(row: ProfilRow): Profile {
  return {
    id: row.id,
    name: row.display_name,
    heightCm: row.height_cm,
    age: row.age,
    sex: row.sex,
    diet: row.diet,
    aversions: row.aversions ?? [],
    preferences: row.preferences ?? [],
    startWeightKg: Number(row.start_weight_kg),
    currentWeightKg: Number(row.current_weight_kg),
    targetWeightKg: Number(row.target_weight_kg),
    primaryGoal:
      row.primary_goal === "maintien" || row.primary_goal === "prise" ? row.primary_goal : "perte",
    weeklyRateKg: Number(row.weekly_rate_kg ?? -0.5),
    sportRoutine: parseSportRoutine(row.sport_routine),
    targets: {
      calories: row.target_calories,
      protein: row.target_protein_g,
      carbs: row.target_carbs_g,
      fat: row.target_fat_g,
    },
    bmr: row.bmr,
    tdee: row.tdee,
    accent: row.accent,
    appliedAdjustments: parseAppliedAdjustments(row.applied_adjustments),
  };
}

function itemsFromJson(value: RepasRow["items"]): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.map((entry) => {
    if (typeof entry === "string") return entry;
    if (entry && typeof entry === "object" && "name" in entry) {
      const rec = entry as { name?: unknown; grams?: unknown };
      return rec.grams != null ? `${String(rec.name)} ${String(rec.grams)}g` : String(rec.name);
    }
    return String(entry);
  });
  return items.length ? items : undefined;
}

export function mapRepas(row: RepasRow): MealEntry {
  return {
    id: row.id,
    name: row.nom,
    type: row.type,
    time: row.heure ? String(row.heure).slice(0, 5) : "",
    macros: {
      calories: row.calories,
      protein: Number(row.proteines_g),
      carbs: Number(row.glucides_g),
      fat: Number(row.lipides_g),
    },
    profileId: row.profile_id,
    source: row.source,
    items: itemsFromJson(row.items),
    isSkipped: Boolean(row.is_skipped),
  };
}
