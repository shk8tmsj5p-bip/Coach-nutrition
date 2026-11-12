import { todayISO } from "@/lib/dates";
import type { ProfileId, Workout } from "@/lib/types";

export const HEALTH_WEBHOOK_PATH = "/api/webhooks/health";
export const HEALTH_WEBHOOK_ALIAS_PATH = "/api/health-webhook";

export function withHealthWebhookQuery(
  baseUrl: string,
  opts: { profileId?: ProfileId; secret?: string },
) {
  const absolute = /^https?:\/\//i.test(baseUrl);
  const url = new URL(baseUrl, "https://local.invalid");
  if (opts.profileId) url.searchParams.set("profile_id", opts.profileId);
  const secret = opts.secret?.trim();
  if (secret) url.searchParams.set("secret", secret);
  return absolute ? url.toString() : `${url.pathname}${url.search}`;
}

export type IncomingHealthWorkout = {
  activity: string;
  durationMin: number;
  kcal: number;
  date: string;
  source: "apple_health";
};

export type ParsedHealthPayload = {
  profileId: ProfileId;
  date: string;
  steps?: number;
  /** Somme des durées de `workouts` (jamais un champ racine). */
  workoutMinutes?: number;
  workoutsProvided: boolean;
  activeEnergyKcal?: number;
  restingEnergyKcal?: number;
  distanceKm?: number;
  cyclingDistanceKm?: number;
  weightKg?: number;
  fatMassPct?: number;
  bmi?: number;
  workouts: IncomingHealthWorkout[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function foldKey(key: string) {
  return key
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

/** Raccourcis envoie parfois une liste de dictionnaires, ou un objet imbriqué. */
export function coerceHealthRecord(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) {
    const merged: Record<string, unknown> = {};
    for (const item of value) Object.assign(merged, coerceHealthRecord(item));
    return merged;
  }
  if (!isRecord(value)) return {};
  const out: Record<string, unknown> = { ...value };
  for (const nested of Object.values(value)) {
    if (!isRecord(nested)) continue;
    for (const [key, nestedValue] of Object.entries(nested)) {
      if (out[key] == null) out[key] = nestedValue;
    }
  }
  return out;
}

function foldedView(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    const folded = foldKey(key);
    if (folded && out[folded] == null) out[folded] = value;
  }
  return out;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(",", ".").replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  return undefined;
}

function pickNumber(record: Record<string, unknown>, keys: string[]) {
  const folded = foldedView(record);
  for (const key of keys) {
    const value = asNumber(folded[foldKey(key)] ?? record[key]);
    if (value != null) return value;
  }
  return undefined;
}

function pickRaw(record: Record<string, unknown>, keys: string[]) {
  const folded = foldedView(record);
  for (const key of keys) {
    const value = folded[foldKey(key)] ?? record[key];
    if (value != null && value !== "") return value;
  }
  return undefined;
}

function parseFormBody(text: string): Record<string, unknown> {
  if (!text.includes("=")) return {};
  const record: Record<string, unknown> = {};
  for (const [key, value] of new URLSearchParams(text).entries()) {
    if (value.trim()) record[key] = value;
  }
  return record;
}

/** JSON, JSON-dans-une-string, ou form-urlencoded (Raccourcis iOS). */
export function parseHealthRequestBody(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return {};
  try {
    const json = JSON.parse(trimmed) as unknown;
    if (typeof json === "string") {
      try {
        return JSON.parse(json) as unknown;
      } catch {
        return parseFormBody(json);
      }
    }
    return json;
  } catch {
    return parseFormBody(trimmed);
  }
}

function roundTo(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** Minutes. Si la valeur ressemble à des secondes HealthKit (> 1000), on convertit. */
export function normalizeDurationMin(raw: number) {
  if (raw > 1000) return Math.max(1, Math.round(raw / 60));
  return Math.max(0, Math.round(raw));
}

/** HealthKit envoie souvent la distance en mètres. */
export function normalizeDistanceKm(raw: number) {
  if (raw > 200) return roundTo(raw / 1000, 2);
  return roundTo(Math.max(0, raw), 2);
}

export function normalizeFatPct(raw: number) {
  if (raw > 0 && raw <= 1) return roundTo(raw * 100, 1);
  return roundTo(raw, 1);
}

export function parseISODate(value: unknown, fallback = todayISO()) {
  const text = asString(value);
  if (!text) return fallback;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return todayISO(parsed);
}

export function parseProfileId(value: unknown, fallback: ProfileId = "alexis"): ProfileId {
  const text = asString(value)?.toLowerCase();
  if (!text) return fallback;
  if (text === "elodie" || text === "élodie" || text === "2" || text === "p2") return "elodie";
  if (text === "alexis" || text === "1" || text === "p1") return "alexis";
  return fallback;
}

function readWorkouts(raw: unknown, fallbackDate: string): IncomingHealthWorkout[] {
  let list: unknown[] = [];
  if (Array.isArray(raw)) list = raw;
  else if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) list = parsed;
      else if (isRecord(parsed)) list = [parsed];
    } catch {
      return [];
    }
  } else if (isRecord(raw)) list = [raw];

  const workouts: IncomingHealthWorkout[] = [];
  for (const item of list) {
    if (!isRecord(item)) continue;
    const activity =
      asString(item.activity) ?? asString(item.name) ?? asString(item.type) ?? "Séance";
    const durationRaw =
      asNumber(item.duration_min) ?? asNumber(item.duration) ?? asNumber(item.minutes);
    const kcal = asNumber(item.kcal) ?? asNumber(item.calories) ?? asNumber(item.calories_burned);
    if (durationRaw == null && kcal == null) continue;
    workouts.push({
      activity,
      durationMin: normalizeDurationMin(durationRaw ?? 0),
      kcal: Math.max(0, Math.round(kcal ?? 0)),
      date: parseISODate(item.date ?? item.start ?? item.startDate, fallbackDate),
      source: "apple_health",
    });
  }
  return workouts;
}

export function sumWorkoutMinutes(workouts: IncomingHealthWorkout[], date: string) {
  return workouts
    .filter((item) => item.date === date)
    .reduce((sum, item) => sum + item.durationMin, 0);
}

function recordFromSearchParams(searchParams: URLSearchParams): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  for (const [key, value] of searchParams.entries()) {
    if (value.trim()) record[key] = value;
  }
  return record;
}

export function parseHealthPayload(
  body: unknown,
  searchParams: URLSearchParams,
): ParsedHealthPayload {
  /** Query first (GET Raccourcis). Body wins if both — JSON, form, ou GET avec corps. */
  const record = {
    ...recordFromSearchParams(searchParams),
    ...coerceHealthRecord(body),
  };
  const date = parseISODate(
    pickRaw(record, ["date", "jour", "startdate", "start"]) ?? searchParams.get("date"),
    todayISO(),
  );
  const profileId = parseProfileId(
    searchParams.get("profile_id") ??
      searchParams.get("profile") ??
      pickRaw(record, ["profile_id", "profileId", "profile"]),
    "alexis",
  );

  const steps = pickNumber(record, [
    "steps",
    "pas",
    "step_count",
    "stepCount",
    "steps_count",
    "HKQuantityTypeIdentifierStepCount",
  ]);
  const workoutsRaw = pickRaw(record, [
    "workouts",
    "seances",
    "activities",
    "workout",
    "hkworkout",
    "workoutSamples",
  ]);
  const workoutsProvided = workoutsRaw !== undefined;
  const workouts = readWorkouts(workoutsRaw, date);
  const activeEnergyKcal = pickNumber(record, [
    "active_energy_kcal",
    "active_kcal",
    "activeKcal",
    "active_energy",
    "calories_actives",
    "energie_active",
    "activeEnergyBurned",
    "HKQuantityTypeIdentifierActiveEnergyBurned",
  ]);
  const restingEnergyKcal = pickNumber(record, [
    "resting_energy_kcal",
    "resting_kcal",
    "resting_energy",
    "energie_repos",
    "basal_energy",
    "basalEnergyBurned",
    "HKQuantityTypeIdentifierBasalEnergyBurned",
  ]);
  const distanceRaw = pickNumber(record, [
    "distance_km",
    "distance",
    "walking_running_distance",
    "walkingRunningDistance",
    "HKQuantityTypeIdentifierDistanceWalkingRunning",
  ]);
  const cyclingRaw = pickNumber(record, [
    "cycling_distance_km",
    "velo_km",
    "bike_distance_km",
    "cycling_distance",
    "distanceCycling",
    "HKQuantityTypeIdentifierDistanceCycling",
  ]);
  const weightKg = pickNumber(record, [
    "weight_kg",
    "poids",
    "weight",
    "bodyMass",
    "HKQuantityTypeIdentifierBodyMass",
  ]);
  const fatRaw = pickNumber(record, [
    "fat_mass_pct",
    "fat_pct",
    "masse_grasse",
    "body_fat",
    "bodyFatPercentage",
    "HKQuantityTypeIdentifierBodyFatPercentage",
  ]);
  const bmi = pickNumber(record, ["bmi", "imc", "HKQuantityTypeIdentifierBodyMassIndex"]);

  return {
    profileId,
    date,
    steps: steps == null ? undefined : Math.max(0, Math.round(steps)),
    workoutMinutes: workoutsProvided ? sumWorkoutMinutes(workouts, date) : undefined,
    workoutsProvided,
    activeEnergyKcal: activeEnergyKcal == null ? undefined : Math.max(0, Math.round(activeEnergyKcal)),
    restingEnergyKcal:
      restingEnergyKcal == null ? undefined : Math.max(0, Math.round(restingEnergyKcal)),
    distanceKm: distanceRaw == null ? undefined : normalizeDistanceKm(distanceRaw),
    cyclingDistanceKm: cyclingRaw == null ? undefined : normalizeDistanceKm(cyclingRaw),
    weightKg: weightKg == null || weightKg <= 0 ? undefined : roundTo(weightKg, 2),
    fatMassPct: fatRaw == null ? undefined : normalizeFatPct(fatRaw),
    bmi: bmi == null ? undefined : roundTo(bmi, 1),
    workouts,
  };
}

export function hasActivityMetrics(payload: ParsedHealthPayload) {
  return (
    payload.steps != null ||
    payload.workoutsProvided ||
    payload.activeEnergyKcal != null ||
    payload.restingEnergyKcal != null ||
    payload.distanceKm != null ||
    payload.cyclingDistanceKm != null
  );
}

export function hasBodyMetrics(payload: ParsedHealthPayload) {
  return payload.weightKg != null || payload.fatMassPct != null || payload.bmi != null;
}

export function isEmptyHealthPayload(payload: ParsedHealthPayload) {
  return !hasActivityMetrics(payload) && !hasBodyMetrics(payload) && payload.workouts.length === 0;
}

export function workoutExternalId(
  profileId: ProfileId,
  date: string,
  workout: IncomingHealthWorkout,
) {
  const slug = workout.activity
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `apple-health:${profileId}:${date}:${slug || "seance"}:${workout.durationMin}:${workout.kcal}`;
}

export function dailyExternalId(profileId: ProfileId, date: string) {
  return `apple-health:${profileId}:${date}:daily`;
}

export function mapActivityLabel(activity: string) {
  const text = activity.toLowerCase();
  if (/run|course|footing|jogging/.test(text)) return "Course";
  if (/ride|cycl|v[ée]lo|bike/.test(text)) return "Vélo";
  if (/strength|muscu|weight|force|hiit/.test(text)) return "Musculation";
  if (/walk|marche/.test(text)) return "Marche";
  if (/swim|natation/.test(text)) return "Natation";
  if (/yoga/.test(text)) return "Yoga";
  if (/hik|randonn/.test(text)) return "Randonnée";
  if (/equit|horse|ride à cheval/.test(text)) return "Équitation";
  return activity;
}

export function inferIntensity(durationMin: number, kcal: number): Workout["intensity"] {
  const rate = durationMin > 0 ? kcal / durationMin : 0;
  if (rate >= 12 || durationMin >= 90) return "high";
  if (rate <= 5 && durationMin <= 25) return "low";
  return "moderate";
}

export function readWebhookSecret(request: Request, body: unknown) {
  const header =
    request.headers.get("x-health-webhook-secret")?.trim() ||
    request.headers.get("x-webhook-secret")?.trim() ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ||
    undefined;
  const query = new URL(request.url).searchParams.get("secret")?.trim() || undefined;
  const record = coerceHealthRecord(body);
  const fromBody = asString(pickRaw(record, ["secret", "token", "webhook_secret"]));
  return header || query || fromBody;
}

export function isWebhookAuthorized(request: Request, body: unknown) {
  const expected = process.env.HEALTH_WEBHOOK_SECRET?.trim();
  if (!expected) return true;
  const got = readWebhookSecret(request, body)?.trim();
  return Boolean(got) && got === expected;
}
