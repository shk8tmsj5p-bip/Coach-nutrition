import type { Macros, Profile, ProfileId, SlotTemplate, SportRoutine } from "@/lib/types";
import type { GoalPatch } from "@/lib/goals";
import type { AppliedAdjustments, HouseholdAppliedAdjustments } from "@/lib/coach-adjustments";
import { parseAppliedAdjustments } from "@/lib/coach-adjustments";
import type { Json } from "@/lib/supabase/database.types";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { parseSportRoutine, sportRoutineToJson } from "@/lib/sport-routine";
import {
  mealTemplatesToJson,
  parseMealTemplates,
  saveHouseholdMealTemplatesLocal,
} from "@/lib/meal-templates";
import { applyTodaySlotTemplates } from "@/lib/supabase/today-data";
import { storage } from "@/lib/storage";

const STORAGE_KEY = "profil-goals";
const TARGETS_KEY = "profil-targets";
const ADJUSTMENTS_KEY = "applied-adjustments";
const AVERSIONS_KEY = "profil-aversions";
const TEMPLATES_KEY = "meal-templates";

function localGoals() {
  return storage.getJSON<Partial<Record<ProfileId, Partial<GoalPatch>>>>(STORAGE_KEY, {});
}

function localTargets() {
  return storage.getJSON<Partial<Record<ProfileId, Macros>>>(TARGETS_KEY, {});
}

function localAdjustments() {
  return storage.getJSON<HouseholdAppliedAdjustments>(ADJUSTMENTS_KEY, {});
}

function mergeGoalPatch(
  profile: Profile,
  patch?: Partial<GoalPatch> & { targets?: Macros },
): Profile {
  if (!patch) return profile;
  const localRoutine = patch.sportRoutine;
  const hasSessions = Array.isArray(localRoutine?.sessions) && localRoutine.sessions.length > 0;
  const { targets, ...rest } = patch;
  return {
    ...profile,
    ...rest,
    ...(targets ? { targets } : {}),
    sportRoutine: parseSportRoutine(hasSessions ? localRoutine : (profile.sportRoutine ?? localRoutine)),
  };
}

function localAversions() {
  return storage.getJSON<Partial<Record<ProfileId, string[]>>>(AVERSIONS_KEY, {});
}

function localTemplates() {
  return storage.getJSON<Partial<Record<ProfileId, SlotTemplate[]>>>(TEMPLATES_KEY, {});
}

export function overlayLocalGoals(catalog: Record<ProfileId, Profile>): Record<ProfileId, Profile> {
  const saved = localGoals();
  const targets = localTargets();
  const adjustments = localAdjustments();
  const aversions = localAversions();
  const templates = localTemplates();
  return {
    alexis: {
      ...mergeGoalPatch(catalog.alexis, { ...saved.alexis, targets: targets.alexis }),
      aversions: aversions.alexis ?? catalog.alexis.aversions,
      mealTemplates: parseMealTemplates(
        templates.alexis ?? catalog.alexis.mealTemplates,
        "alexis",
      ),
      appliedAdjustments:
        parseAppliedAdjustments(adjustments.alexis) ?? catalog.alexis.appliedAdjustments ?? null,
    },
    elodie: {
      ...mergeGoalPatch(catalog.elodie, { ...saved.elodie, targets: targets.elodie }),
      aversions: aversions.elodie ?? catalog.elodie.aversions,
      mealTemplates: parseMealTemplates(
        templates.elodie ?? catalog.elodie.mealTemplates,
        "elodie",
      ),
      appliedAdjustments:
        parseAppliedAdjustments(adjustments.elodie) ?? catalog.elodie.appliedAdjustments ?? null,
    },
  };
}

export async function saveProfileGoals(
  profileId: ProfileId,
  patch: GoalPatch,
): Promise<string | null> {
  const all = { ...localGoals(), [profileId]: patch };
  storage.setJSON(STORAGE_KEY, all);

  const supabase = createBrowserSupabaseClient();
  if (!supabase) return null;

  const { error } = await supabase
    .from("profils")
    .update({
      start_weight_kg: patch.startWeightKg,
      target_weight_kg: patch.targetWeightKg,
      primary_goal: patch.primaryGoal,
      weekly_rate_kg: patch.weeklyRateKg,
      sport_routine: sportRoutineToJson(patch.sportRoutine),
    })
    .eq("id", profileId);

  return error?.message ?? null;
}

export async function saveSportRoutine(
  profileId: ProfileId,
  routine: SportRoutine,
): Promise<string | null> {
  return saveSportRoutines({ [profileId]: routine });
}

export async function saveSportRoutines(
  routines: Partial<Record<ProfileId, SportRoutine>>,
): Promise<string | null> {
  const all = localGoals();
  const next = { ...all };
  for (const id of ["alexis", "elodie"] as const) {
    if (!routines[id]) continue;
    next[id] = { ...next[id], sportRoutine: routines[id] };
  }
  storage.setJSON(STORAGE_KEY, next);

  const supabase = createBrowserSupabaseClient();
  if (!supabase) return null;

  let firstError: string | null = null;
  for (const id of ["alexis", "elodie"] as const) {
    const routine = routines[id];
    if (!routine) continue;
    const { error } = await supabase
      .from("profils")
      .update({ sport_routine: sportRoutineToJson(routine) })
      .eq("id", id);
    if (error && !firstError) firstError = error.message;
  }
  return firstError;
}

export async function saveProfileAversions(
  profileId: ProfileId,
  aversions: string[],
): Promise<string | null> {
  const cleaned = [...new Set(aversions.map((item) => item.trim()).filter(Boolean))];
  const all = { ...localAversions(), [profileId]: cleaned };
  storage.setJSON(AVERSIONS_KEY, all);

  const supabase = createBrowserSupabaseClient();
  if (!supabase) return null;

  const { error } = await supabase.from("profils").update({ aversions: cleaned }).eq("id", profileId);
  return error?.message ?? null;
}

export async function saveProfileTargets(
  profileId: ProfileId,
  targets: Macros,
): Promise<string | null> {
  const all = { ...localTargets(), [profileId]: targets };
  storage.setJSON(TARGETS_KEY, all);

  const supabase = createBrowserSupabaseClient();
  if (!supabase) return null;

  const { error } = await supabase
    .from("profils")
    .update({
      target_calories: targets.calories,
      target_protein_g: targets.protein,
      target_carbs_g: targets.carbs,
      target_fat_g: targets.fat,
    })
    .eq("id", profileId);

  return error?.message ?? null;
}

export async function saveAppliedAdjustments(
  profileId: ProfileId,
  adjustments: AppliedAdjustments | null,
): Promise<string | null> {
  const all = { ...localAdjustments(), [profileId]: adjustments ?? undefined };
  storage.setJSON(ADJUSTMENTS_KEY, all);

  const supabase = createBrowserSupabaseClient();
  if (!supabase) return null;

  const { error } = await supabase
    .from("profils")
    .update({ applied_adjustments: adjustments as Json | null })
    .eq("id", profileId);

  return error?.message ?? null;
}

export async function saveMealTemplates(
  templates: Partial<Record<ProfileId, SlotTemplate[]>>,
): Promise<string | null> {
  saveHouseholdMealTemplatesLocal(templates);

  const supabase = createBrowserSupabaseClient();
  if (!supabase) return null;

  let firstError: string | null = null;
  for (const id of ["alexis", "elodie"] as const) {
    const list = templates[id];
    if (list === undefined) continue;
    const { error } = await supabase
      .from("profils")
      .update({ meal_templates: mealTemplatesToJson(list) })
      .eq("id", id);
    if (error && !firstError) firstError = error.message;
  }
  await applyTodaySlotTemplates(supabase, undefined, { replacePlan: true });
  return firstError;
}
