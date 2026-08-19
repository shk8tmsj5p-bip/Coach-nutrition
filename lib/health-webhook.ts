import { todayISO } from "@/lib/dates";
import type { ProfileId, Workout } from "@/lib/types";

export const HEALTH_WEBHOOK_PATH = "/api/webhooks/health";
export const HEALTH_WEBHOOK_ALIAS_PATH = "/api/health-webhook";

export type IncomingHealthWorkout = {
  activity: string;
  durationMin: number;
  kcal: number;
  date: string;
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
  weightKg?: number;
  fatMassPct?: number;
  bmi?: number;
  workouts: IncomingHealthWorkout[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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
  for (const key of keys) {
    const value = asNumber(record[key]);
    if (value != null) return value;
  }
  return undefined;
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
  /** Query string first so Raccourcis can send GET `?steps=…&weight_kg=…` (iOS POST JSON often drops). Body wins if both. */
  const record = {
    ...recordFromSearchParams(searchParams),
    ...(isRecord(body) ? body : {}),
  };
  const date = parseISODate(
    record.date ?? record.jour ?? searchParams.get("date"),
    todayISO(),
  );
  const profileId = parseProfileId(
    searchParams.get("profile_id") ??
      searchParams.get("profile") ??
      record.profile_id ??
      record.profileId ??
      record.profile,
    "alexis",
  );

  const steps = pickNumber(record, ["steps", "pas"]);
  const workoutsRaw = record.workouts ?? record.seances ?? record.activities;
  const workoutsProvided = workoutsRaw !== undefined;
  const workouts = readWorkouts(workoutsRaw, date);
  const activeEnergyKcal = pickNumber(record, [
    "active_energy_kcal",
    "active_kcal",
    "activeKcal",
    "active_energy",
    "calories_actives",
  ]);
  const restingEnergyKcal = pickNumber(record, [
    "resting_energy_kcal",
    "resting_kcal",
    "resting_energy",
    "energie_repos",
  ]);
  const distanceRaw = pickNumber(record, ["distance_km", "distance", "walking_running_distance"]);
  const weightKg = pickNumber(record, ["weight_kg", "poids", "weight"]);
  const fatRaw = pickNumber(record, ["fat_mass_pct", "fat_pct", "masse_grasse", "body_fat"]);
  const bmi = pickNumber(record, ["bmi", "imc"]);

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
    weightKg: weightKg == null ? undefined : roundTo(weightKg, 2),
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
    payload.distanceKm != null
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
    request.headers.get("x-health-webhook-secret") ??
    request.headers.get("x-webhook-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ??
    undefined;
  const query = new URL(request.url).searchParams.get("secret") ?? undefined;
  const record = isRecord(body) ? asString(body.secret) : undefined;
  return header || query || record;
}

export function isWebhookAuthorized(request: Request, body: unknown) {
  const expected = process.env.HEALTH_WEBHOOK_SECRET?.trim();
  if (!expected) return true;
  return readWebhookSecret(request, body) === expected;
}
