import { todayISO } from "@/lib/dates";
import { activityLabel, defaultEffort, effortAllowed, effortLabel } from "@/lib/sport-routine";
import { storage } from "@/lib/storage";
import { deleteManualWorkout, upsertManualWorkout } from "@/lib/supabase/health-logs";
import {
  markSessionsValidated,
  SESSION_VALIDATIONS_EVENT,
  sportActivityFromText,
  unvalidateSession,
} from "@/lib/strava-match";
import type { ProfileId, SportActivity, SportEffort, Workout, WorkoutSource } from "@/lib/types";

export type LoggedTodaySource = WorkoutSource;

export type LoggedTodaySession = {
  id: string;
  plannedId: string | null;
  activity: SportActivity;
  effort: SportEffort;
  durationMin: number;
  calories: number;
  elevationM?: number;
  source: LoggedTodaySource;
  workoutId?: string;
  workoutName?: string;
};

const EVENT = SESSION_VALIDATIONS_EVENT;

function storageKey(profileId: ProfileId, date: string) {
  return `today-sport:${profileId}:${date}`;
}

function bump() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENT));
}

export function loadLoggedToday(profileId: ProfileId, date = todayISO()): LoggedTodaySession[] {
  const raw = storage.getJSON<unknown>(storageKey(profileId, date), []);
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => parseLogged(item))
    .filter((item): item is LoggedTodaySession => item != null);
}

function parseLogged(value: unknown): LoggedTodaySession | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  const activity = rec.activity;
  if (activity !== "course" && activity !== "velo" && activity !== "muscu") return null;
  const durationMin = Number(rec.durationMin);
  if (!Number.isFinite(durationMin) || durationMin < 1) return null;
  const effortRaw = typeof rec.effort === "string" ? (rec.effort as SportEffort) : defaultEffort(activity);
  const effort = effortAllowed(activity, effortRaw) ? effortRaw : defaultEffort(activity);
  const source: LoggedTodaySource =
    rec.source === "strava" || rec.source === "apple-health" || rec.source === "manual"
      ? rec.source
      : "manual";
  const id = typeof rec.id === "string" && rec.id.trim() ? rec.id : `extra-${crypto.randomUUID()}`;
  return {
    id,
    plannedId: typeof rec.plannedId === "string" && rec.plannedId.trim() ? rec.plannedId : null,
    activity,
    effort,
    durationMin: Math.round(durationMin),
    calories: Math.max(0, Math.round(Number(rec.calories) || 0)),
    elevationM:
      rec.elevationM == null || rec.elevationM === ""
        ? undefined
        : Math.max(0, Math.round(Number(rec.elevationM) || 0)),
    source,
    workoutId: typeof rec.workoutId === "string" && rec.workoutId.trim() ? rec.workoutId : undefined,
    workoutName: typeof rec.workoutName === "string" && rec.workoutName.trim() ? rec.workoutName : undefined,
  };
}

export function persistLoggedToday(
  profileId: ProfileId,
  sessions: LoggedTodaySession[],
  date = todayISO(),
) {
  storage.setJSON(storageKey(profileId, date), sessions);
  bump();
  return sessions;
}

export function loggedForPlanned(sessions: LoggedTodaySession[], plannedId: string) {
  return sessions.find((item) => item.plannedId === plannedId || item.id === plannedId) ?? null;
}

export function extrasLogged(sessions: LoggedTodaySession[]) {
  return sessions.filter((item) => !item.plannedId);
}

export function claimedWorkoutIds(sessions: LoggedTodaySession[]) {
  return sessions.map((item) => item.workoutId).filter((id): id is string => Boolean(id));
}

export function loggedToWorkout(
  profileId: ProfileId,
  date: string,
  log: LoggedTodaySession,
): Workout | null {
  if (log.source !== "manual") return null;
  return {
    id: log.workoutId || log.id,
    date,
    name: log.workoutName || activityLabel(log.activity),
    type: log.activity,
    durationMin: log.durationMin,
    calories: log.calories,
    source: "manual",
    profileId,
    intensity: log.durationMin >= 75 ? "high" : log.durationMin <= 25 ? "low" : "moderate",
  };
}

export function mergeLoggedWorkouts(
  profileId: ProfileId,
  date: string,
  workouts: Workout[],
  logs = loadLoggedToday(profileId, date),
) {
  const existing = new Set(workouts.map((item) => item.id));
  const extras: Workout[] = [];
  for (const log of logs) {
    const synthetic = loggedToWorkout(profileId, date, log);
    if (!synthetic || existing.has(synthetic.id)) continue;
    extras.push(synthetic);
    existing.add(synthetic.id);
  }
  return extras.length === 0 ? workouts : [...workouts, ...extras];
}

export function todayActivityHeadline(
  activity: SportActivity,
  effort: SportEffort,
  elevationM?: number,
) {
  if (activity === "muscu") {
    return `${activityLabel(activity)} · ${effortLabel(effort)}`;
  }
  const meters = Math.max(0, Math.round(elevationM ?? 0));
  return `${activityLabel(activity)} · Dénivelé ${meters} m`;
}

export function validationLabel(log: LoggedTodaySession) {
  if (log.source === "strava") return log.workoutName || "Strava";
  if (log.source === "apple-health") return log.workoutName || "Santé";
  return log.workoutName || "Manuel";
}

export function applyLoggedValidation(
  profileId: ProfileId,
  log: LoggedTodaySession,
  date = todayISO(),
) {
  const targetId = log.plannedId;
  if (!targetId) return;
  markSessionsValidated(profileId, [targetId], validationLabel(log), date);
}

export function clearLoggedValidation(
  profileId: ProfileId,
  plannedId: string | null,
  date = todayISO(),
) {
  if (!plannedId) return;
  unvalidateSession(profileId, plannedId, date);
}

export function newExtraId() {
  return `extra-${crypto.randomUUID()}`;
}

export function draftFromPlanned(opts: {
  plannedId: string;
  activity: SportActivity;
  effort: SportEffort;
  durationMin: number;
  elevationM?: number;
}): LoggedTodaySession {
  return {
    id: opts.plannedId,
    plannedId: opts.plannedId,
    activity: opts.activity,
    effort: effortAllowed(opts.activity, opts.effort) ? opts.effort : defaultEffort(opts.activity),
    durationMin: opts.durationMin,
    calories: 0,
    elevationM: opts.elevationM,
    source: "manual",
  };
}

export function draftFromWorkout(
  workout: Workout,
  plannedId: string | null,
): LoggedTodaySession | null {
  const activity =
    workout.type === "course" || workout.type === "velo" || workout.type === "muscu"
      ? workout.type
      : null;
  const inferred = activity ?? sportActivityFromText(`${workout.type} ${workout.name}`);
  if (!inferred) return null;
  return {
    id: plannedId ?? newExtraId(),
    plannedId,
    activity: inferred,
    effort: defaultEffort(inferred),
    durationMin: Math.max(1, workout.durationMin),
    calories: Math.max(0, workout.calories),
    source: workout.source,
    workoutId: workout.id,
    workoutName: workout.name,
  };
}

export function upsertLoggedList(list: LoggedTodaySession[], next: LoggedTodaySession) {
  return [
    ...list.filter((item) => {
      if (item.id === next.id) return false;
      if (next.plannedId && (item.plannedId === next.plannedId || item.id === next.plannedId)) {
        return false;
      }
      return true;
    }),
    next,
  ];
}

export async function saveTodaySport(
  profileId: ProfileId,
  draft: LoggedTodaySession,
  date = todayISO(),
  opts?: { validate?: boolean },
): Promise<{ log: LoggedTodaySession; error?: string }> {
  let next = { ...draft };
  if (next.source === "manual") {
    const saved = await upsertManualWorkout({
      profileId,
      date,
      overlayId: next.id,
      activity: next.activity,
      durationMin: next.durationMin,
      calories: next.calories,
      workoutId: next.workoutId,
    });
    next = { ...next, workoutId: saved.id, workoutName: next.workoutName || activityLabel(next.activity) };
    persistLoggedToday(profileId, upsertLoggedList(loadLoggedToday(profileId, date), next), date);
    if (opts?.validate) applyLoggedValidation(profileId, next, date);
    return { log: next, error: saved.error };
  }
  persistLoggedToday(profileId, upsertLoggedList(loadLoggedToday(profileId, date), next), date);
  if (opts?.validate) applyLoggedValidation(profileId, next, date);
  return { log: next };
}

export async function removeTodaySport(
  profileId: ProfileId,
  log: LoggedTodaySession,
  date = todayISO(),
) {
  const next = loadLoggedToday(profileId, date).filter((item) => item.id !== log.id);
  persistLoggedToday(profileId, next, date);
  clearLoggedValidation(profileId, log.plannedId, date);
  if (log.source === "manual") {
    return deleteManualWorkout(log.workoutId);
  }
  return {};
}
