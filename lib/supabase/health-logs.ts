import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { sanitizeRestingKcal } from "@/lib/health-energy";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { todayISO } from "@/lib/dates";
import {
  dailyExternalId,
  hasActivityMetrics,
  hasBodyMetrics,
  inferIntensity,
  mapActivityLabel,
  workoutExternalId,
  type IncomingHealthWorkout,
  type ParsedHealthPayload,
} from "@/lib/health-webhook";
import type { Database, Json, LogSanteRow } from "@/lib/supabase/database.types";
import type { DailyMovement, ProfileId, Workout, WorkoutSource } from "@/lib/types";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { passiveKcalFromMovement } from "@/lib/utils";

const DAILY_TYPE = "daily";

export function createWebhookSupabaseClient() {
  const admin = createAdminSupabaseClient();
  if (admin) return admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function payloadObject(value: Json): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function num(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return undefined;
}

function keepNumber(next: number | undefined, previous: unknown, fallback = 0) {
  if (next != null) return next;
  if (typeof previous === "number" && Number.isFinite(previous)) return previous;
  return fallback;
}

function sourceFromRow(source: LogSanteRow["source"]): WorkoutSource {
  if (source === "manual") return "manual";
  return "apple-health";
}

function similarDuration(a: number, b: number) {
  const delta = Math.abs(a - b);
  return delta <= 15 || (b > 0 && delta / b <= 0.25);
}

function similarActivity(left: string, right: string) {
  return mapActivityLabel(left).toLowerCase() === mapActivityLabel(right).toLowerCase();
}

async function findDailyRow(
  supabase: SupabaseClient<Database>,
  profileId: ProfileId,
  date: string,
) {
  const { data, error } = await supabase
    .from("logs_sante")
    .select("*")
    .eq("profile_id", profileId)
    .eq("date", date)
    .eq("kind", "activite")
    .eq("activity_type", DAILY_TYPE)
    .limit(1);
  if (error) return { row: null, error: error.message };
  return { row: data?.[0] ?? null, error: undefined };
}

async function loadEnergyAnchors(supabase: SupabaseClient<Database>, profileId: ProfileId) {
  const { data } = await supabase.from("profils").select("bmr, tdee").eq("id", profileId).limit(1);
  const row = data?.[0];
  return {
    bmr: Number(row?.bmr) || 1600,
    tdee: Number(row?.tdee) || 2200,
  };
}

async function upsertDailyMovement(
  supabase: SupabaseClient<Database>,
  payload: ParsedHealthPayload,
  anchors: { bmr: number; tdee: number },
) {
  if (!hasActivityMetrics(payload)) {
    return { updated: false as const };
  }

  const existing = await findDailyRow(supabase, payload.profileId, payload.date);
  if (existing.error) return { updated: false as const, error: existing.error };

  const previous = payloadObject(existing.row?.payload ?? {});
  const steps = keepNumber(payload.steps, previous.steps);
  const workoutMinutes = payload.workoutsProvided
    ? (payload.workoutMinutes ?? 0)
    : keepNumber(undefined, previous.workout_minutes, existing.row?.duration_min ?? 0);
  const activeEnergyKcal = keepNumber(
    payload.activeEnergyKcal,
    previous.active_energy_kcal ?? previous.active_kcal,
    existing.row?.calories_burned ?? 0,
  );
  const restingRaw = keepNumber(
    payload.restingEnergyKcal,
    previous.resting_energy_kcal_raw ?? previous.resting_energy_kcal,
  );
  const restingSanitized = sanitizeRestingKcal(restingRaw, anchors);
  const restingEnergyKcal = restingSanitized.value;
  const distanceKm = keepNumber(payload.distanceKm, previous.walking_distance_km ?? previous.distance_km);
  const cyclingDistanceKm = keepNumber(payload.cyclingDistanceKm, previous.cycling_distance_km);

  const nextPayload: Json = {
    ...previous,
    steps,
    workout_minutes: workoutMinutes,
    active_energy_kcal: activeEnergyKcal,
    active_kcal: activeEnergyKcal,
    resting_energy_kcal_raw: restingRaw,
    resting_energy_kcal: restingEnergyKcal,
    resting_energy_corrected: restingSanitized.corrected,
    walking_distance_km: distanceKm,
    cycling_distance_km: cyclingDistanceKm,
    distance_km: distanceKm,
  };

  const fields = {
    calories_burned: activeEnergyKcal,
    duration_min: workoutMinutes,
    notes: `${steps} pas`,
    payload: nextPayload,
    source: "apple_health" as const,
    activity_name: "Pas & énergie active",
    activity_type: DAILY_TYPE,
    external_id: existing.row?.external_id ?? dailyExternalId(payload.profileId, payload.date),
  };

  if (existing.row) {
    const { error } = await supabase.from("logs_sante").update(fields).eq("id", existing.row.id);
    if (error) return { updated: false as const, error: error.message };
    return {
      updated: true as const,
      id: existing.row.id,
      steps,
      workoutMinutes,
      activeEnergyKcal,
      restingEnergyKcal,
      distanceKm,
      cyclingDistanceKm,
    };
  }

  const { data, error } = await supabase
    .from("logs_sante")
    .insert({
      profile_id: payload.profileId,
      date: payload.date,
      kind: "activite",
      ...fields,
    })
    .select("id")
    .limit(1);
  if (error) return { updated: false as const, error: error.message };
  return {
    updated: true as const,
    id: data?.[0]?.id,
    steps,
    workoutMinutes,
    activeEnergyKcal,
    restingEnergyKcal,
    distanceKm,
    cyclingDistanceKm,
  };
}

async function isDuplicateWorkout(
  supabase: SupabaseClient<Database>,
  profileId: ProfileId,
  workout: IncomingHealthWorkout,
) {
  const externalId = workoutExternalId(profileId, workout.date, workout);
  const byId = await supabase
    .from("logs_sante")
    .select("id")
    .eq("profile_id", profileId)
    .eq("external_id", externalId)
    .limit(1);
  if ((byId.data ?? []).length > 0) return true;

  const { data } = await supabase
    .from("logs_sante")
    .select("activity_name, activity_type, duration_min, source")
    .eq("profile_id", profileId)
    .eq("date", workout.date)
    .eq("kind", "activite")
    .neq("activity_type", DAILY_TYPE);

  return (data ?? []).some((row) => {
    if (row.source === "manual") return false;
    const name = row.activity_name ?? row.activity_type ?? "";
    const duration = row.duration_min ?? 0;
    return similarActivity(name, workout.activity) && similarDuration(duration, workout.durationMin);
  });
}

async function insertWorkouts(
  supabase: SupabaseClient<Database>,
  profileId: ProfileId,
  workouts: IncomingHealthWorkout[],
) {
  let inserted = 0;
  let skipped = 0;
  for (const workout of workouts) {
    const duplicate = await isDuplicateWorkout(supabase, profileId, workout);
    if (duplicate) {
      skipped += 1;
      continue;
    }
    const { error } = await supabase.from("logs_sante").insert({
      profile_id: profileId,
      date: workout.date,
      kind: "activite",
      source: workout.source,
      activity_name: mapActivityLabel(workout.activity),
      activity_type: workout.activity,
      duration_min: workout.durationMin,
      calories_burned: workout.kcal,
      intensity: inferIntensity(workout.durationMin, workout.kcal),
      external_id: workoutExternalId(profileId, workout.date, workout),
      payload: {
        activity: workout.activity,
        duration: workout.durationMin,
        kcal: workout.kcal,
      },
    });
    if (error) {
      if (error.code === "23505") {
        skipped += 1;
        continue;
      }
      return { inserted, skipped, error: error.message };
    }
    inserted += 1;
  }
  return { inserted, skipped };
}

async function sumDedicatedWorkoutKcal(
  supabase: SupabaseClient<Database>,
  profileId: ProfileId,
  date: string,
) {
  const { data, error } = await supabase
    .from("logs_sante")
    .select("calories_burned")
    .eq("profile_id", profileId)
    .eq("date", date)
    .eq("kind", "activite")
    .neq("activity_type", DAILY_TYPE);
  if (error) return { kcal: 0, error: error.message };
  const kcal = (data ?? []).reduce((sum, row) => sum + (row.calories_burned ?? 0), 0);
  return { kcal };
}

async function patchNetPassive(
  supabase: SupabaseClient<Database>,
  dailyId: string | undefined,
  activeEnergyKcal: number,
  workoutKcal: number,
) {
  const netPassiveKcal = passiveKcalFromMovement(activeEnergyKcal, workoutKcal);
  if (!dailyId) return netPassiveKcal;

  const existing = await supabase.from("logs_sante").select("payload").eq("id", dailyId).limit(1);
  const previous = payloadObject(existing.data?.[0]?.payload ?? {});
  const { error } = await supabase
    .from("logs_sante")
    .update({
      payload: {
        ...previous,
        net_passive_kcal: netPassiveKcal,
        workout_kcal: workoutKcal,
      },
    })
    .eq("id", dailyId);
  if (error) console.error("[HEALTH WEBHOOK] net passive patch:", error.message);
  return netPassiveKcal;
}

async function upsertPeseeFromHealth(
  supabase: SupabaseClient<Database>,
  payload: ParsedHealthPayload,
) {
  if (!hasBodyMetrics(payload)) return { updated: false as const };

  const existing = await supabase
    .from("pesees")
    .select("*")
    .eq("profile_id", payload.profileId)
    .eq("date", payload.date)
    .limit(1);
  if (existing.error) return { updated: false as const, error: existing.error.message };

  const current = existing.data?.[0];
  const row = {
    profile_id: payload.profileId,
    date: payload.date,
    poids: payload.weightKg ?? current?.poids ?? null,
    masse_grasse: payload.fatMassPct ?? current?.masse_grasse ?? null,
    bmi: payload.bmi ?? current?.bmi ?? null,
    masse_musculaire: current?.masse_musculaire ?? null,
    tour_taille: current?.tour_taille ?? null,
    journal_notes: current?.journal_notes ?? null,
  };

  const withBmi = await supabase.from("pesees").upsert(row, { onConflict: "profile_id,date" });
  if (withBmi.error) {
    const missingBmi = /bmi/i.test(withBmi.error.message);
    if (!missingBmi) return { updated: false as const, error: withBmi.error.message };
    const { bmi: _bmi, ...withoutBmi } = row;
    const fallback = await supabase.from("pesees").upsert(withoutBmi, { onConflict: "profile_id,date" });
    if (fallback.error) return { updated: false as const, error: fallback.error.message };
  }

  if (payload.weightKg != null) {
    await supabase.from("profils").update({ current_weight_kg: payload.weightKg }).eq("id", payload.profileId);
  }

  return {
    updated: true as const,
    weightKg: row.poids,
    fatMassPct: row.masse_grasse,
    bmi: row.bmi,
  };
}

export async function ingestHealthPayload(
  supabase: SupabaseClient<Database>,
  payload: ParsedHealthPayload,
) {
  const anchors = await loadEnergyAnchors(supabase, payload.profileId);
  const daily = await upsertDailyMovement(supabase, payload, anchors);
  if (daily.error) return { ok: false as const, error: daily.error };

  const workouts = await insertWorkouts(supabase, payload.profileId, payload.workouts);
  if (workouts.error) return { ok: false as const, error: workouts.error };

  const pesees = await upsertPeseeFromHealth(supabase, payload);
  if (pesees.error) return { ok: false as const, error: pesees.error };

  const dedicated = await sumDedicatedWorkoutKcal(supabase, payload.profileId, payload.date);
  if (dedicated.error) return { ok: false as const, error: dedicated.error };

  const activeEnergyKcal = daily.activeEnergyKcal ?? 0;
  const netPassiveKcal = await patchNetPassive(
    supabase,
    daily.id,
    activeEnergyKcal,
    dedicated.kcal,
  );

  return {
    ok: true as const,
    profile_id: payload.profileId,
    date: payload.date,
    steps: daily.steps,
    workout_minutes: daily.workoutMinutes,
    active_energy_kcal: daily.activeEnergyKcal,
    resting_energy_kcal: daily.restingEnergyKcal,
    distance_km: daily.distanceKm,
    cycling_distance_km: daily.cyclingDistanceKm,
    workout_kcal: dedicated.kcal,
    net_passive_kcal: netPassiveKcal,
    weight_kg: pesees.weightKg,
    fat_mass_pct: pesees.fatMassPct,
    bmi: pesees.bmi,
    workouts_received: payload.workouts.length,
    workouts_inserted: workouts.inserted,
    workouts_skipped: workouts.skipped,
  };
}

function emptyMovement(profileId: ProfileId, date: string): DailyMovement {
  return {
    date,
    profileId,
    steps: 0,
    activeEnergyKcal: 0,
    restingEnergyKcal: 0,
    workoutMinutes: 0,
    distanceKm: 0,
    cyclingDistanceKm: 0,
    source: "apple-health",
  };
}

function mapDailyRow(row: LogSanteRow): DailyMovement {
  const payload = payloadObject(row.payload);
  const steps = num(payload.steps) ?? (Number.parseInt(row.notes ?? "", 10) || 0);
  const active =
    num(payload.active_energy_kcal) ?? num(payload.active_kcal) ?? row.calories_burned ?? 0;
  return {
    date: row.date,
    profileId: row.profile_id,
    steps,
    activeEnergyKcal: active,
    restingEnergyKcal: num(payload.resting_energy_kcal) ?? 0,
    workoutMinutes: num(payload.workout_minutes) ?? row.duration_min ?? 0,
    distanceKm: num(payload.walking_distance_km) ?? num(payload.distance_km) ?? 0,
    cyclingDistanceKm: num(payload.cycling_distance_km) ?? 0,
    source: "apple-health",
  };
}

function mapWorkoutRow(row: LogSanteRow): Workout {
  return {
    id: row.id,
    date: row.date,
    name: row.activity_name || mapActivityLabel(row.activity_type || "Séance"),
    type: row.activity_type || "workout",
    durationMin: row.duration_min ?? 0,
    calories: row.calories_burned ?? 0,
    source: sourceFromRow(row.source),
    profileId: row.profile_id,
    intensity: row.intensity ?? "moderate",
  };
}

export async function fetchTodayActivity(
  supabase: SupabaseClient<Database>,
  profileIds: ProfileId[],
  date = todayISO(),
): Promise<{
  movement: Record<ProfileId, DailyMovement>;
  workouts: Workout[];
  error?: string;
}> {
  const movement: Record<ProfileId, DailyMovement> = {
    alexis: emptyMovement("alexis", date),
    elodie: emptyMovement("elodie", date),
  };
  if (profileIds.length === 0) return { movement, workouts: [] };

  const { data, error } = await supabase
    .from("logs_sante")
    .select("*")
    .eq("date", date)
    .eq("kind", "activite")
    .in("profile_id", profileIds)
    .order("logged_at", { ascending: true });

  if (error) return { movement, workouts: [], error: error.message };

  const workouts: Workout[] = [];
  for (const row of data ?? []) {
    if (row.activity_type === DAILY_TYPE) {
      movement[row.profile_id] = mapDailyRow(row);
      continue;
    }
    workouts.push(mapWorkoutRow(row));
  }

  const body = await fetchTodayBodyMetrics(supabase, profileIds, date);
  for (const id of profileIds) {
    movement[id] = { ...movement[id], ...body[id] };
  }

  return { movement, workouts };
}

async function fetchTodayBodyMetrics(
  supabase: SupabaseClient<Database>,
  profileIds: ProfileId[],
  date: string,
) {
  const empty: Record<ProfileId, Pick<DailyMovement, "weightKg" | "fatMassPct" | "bmi">> = {
    alexis: {},
    elodie: {},
  };
  const query = await supabase
    .from("pesees")
    .select("profile_id, poids, masse_grasse, bmi")
    .eq("date", date)
    .in("profile_id", profileIds);

  const rows = query.error
    ? (
        await supabase
          .from("pesees")
          .select("profile_id, poids, masse_grasse")
          .eq("date", date)
          .in("profile_id", profileIds)
      ).data
    : query.data;

  for (const row of rows ?? []) {
    const extra = row as { bmi?: number | null };
    empty[row.profile_id] = {
      weightKg: row.poids == null ? null : Number(row.poids),
      fatMassPct: row.masse_grasse == null ? null : Number(row.masse_grasse),
      bmi: extra.bmi == null ? null : Number(extra.bmi),
    };
  }
  return empty;
}

function movementFromRow(row: LogSanteRow): DailyMovement {
  return mapDailyRow(row);
}

export async function loadHealthHistory(profileId: ProfileId): Promise<DailyMovement[]> {
  const supabase = createBrowserSupabaseClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("logs_sante")
    .select("*")
    .eq("profile_id", profileId)
    .eq("kind", "activite")
    .eq("activity_type", DAILY_TYPE)
    .order("date", { ascending: true });
  if (error || !data) return [];
  return data.map(movementFromRow);
}

export async function fetchActivityRange(
  supabase: SupabaseClient<Database> | null,
  profileId: ProfileId,
  from: string,
  to: string,
): Promise<{ days: DailyMovement[]; workouts: Workout[] }> {
  if (!supabase) return { days: [], workouts: [] };
  const { data, error } = await supabase
    .from("logs_sante")
    .select("*")
    .eq("profile_id", profileId)
    .eq("kind", "activite")
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: true });
  if (error || !data) return { days: [], workouts: [] };
  const days: DailyMovement[] = [];
  const workouts: Workout[] = [];
  for (const row of data) {
    if (row.activity_type === DAILY_TYPE) days.push(mapDailyRow(row));
    else workouts.push(mapWorkoutRow(row));
  }
  return { days, workouts };
}

export function movementSeries(
  days: DailyMovement[],
  key: "steps" | "distanceKm" | "cyclingDistanceKm" | "workoutMinutes" | "activeEnergyKcal" | "restingEnergyKcal",
) {
  return days.map((day) => ({ date: day.date, value: Number(day[key] ?? 0) }));
}

function manualExternalId(profileId: ProfileId, date: string, overlayId: string) {
  return `manual:${profileId}:${date}:${overlayId}`;
}

export async function upsertManualWorkout(opts: {
  profileId: ProfileId;
  date: string;
  overlayId: string;
  activity: string;
  durationMin: number;
  calories: number;
  workoutId?: string;
}): Promise<{ id: string; error?: string }> {
  const localId = opts.workoutId?.startsWith("local-") ? undefined : opts.workoutId;
  const supabase = createBrowserSupabaseClient();
  if (!supabase) {
    return { id: localId || `local-${opts.overlayId}` };
  }

  const fields = {
    profile_id: opts.profileId,
    date: opts.date,
    kind: "activite" as const,
    source: "manual" as const,
    activity_name: mapActivityLabel(opts.activity),
    activity_type: opts.activity,
    duration_min: opts.durationMin,
    calories_burned: opts.calories,
    intensity: inferIntensity(opts.durationMin, opts.calories),
    external_id: manualExternalId(opts.profileId, opts.date, opts.overlayId),
    payload: {
      activity: opts.activity,
      duration: opts.durationMin,
      kcal: opts.calories,
      overlay_id: opts.overlayId,
    } as Json,
  };

  if (localId) {
    const { error } = await supabase.from("logs_sante").update(fields).eq("id", localId);
    if (!error) return { id: localId };
  }

  const existing = await supabase
    .from("logs_sante")
    .select("id")
    .eq("external_id", fields.external_id)
    .limit(1);
  const rowId = existing.data?.[0]?.id;
  if (rowId) {
    const { error } = await supabase.from("logs_sante").update(fields).eq("id", rowId);
    if (error) return { id: rowId, error: error.message };
    return { id: rowId };
  }

  const inserted = await supabase.from("logs_sante").insert(fields).select("id").limit(1);
  if (inserted.error) {
    return { id: localId || `local-${opts.overlayId}`, error: inserted.error.message };
  }
  return { id: inserted.data?.[0]?.id ?? localId ?? `local-${opts.overlayId}` };
}

export async function deleteManualWorkout(workoutId: string | undefined) {
  if (!workoutId || workoutId.startsWith("local-") || workoutId.startsWith("extra-")) {
    return { error: undefined as string | undefined };
  }
  const supabase = createBrowserSupabaseClient();
  if (!supabase) return {};
  const { error } = await supabase
    .from("logs_sante")
    .delete()
    .eq("id", workoutId)
    .eq("source", "manual");
  return { error: error?.message };
}
