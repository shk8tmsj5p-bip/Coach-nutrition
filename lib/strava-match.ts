import { todayISO } from "@/lib/dates";
import { storage } from "@/lib/storage";
import type { ProfileId, SportActivity, SportSession, Workout } from "@/lib/types";

export type SimulatedStravaActivity = {
  name: string;
  type: SportActivity;
  durationMin: number;
  date: string;
};

export type SessionValidation = { activityName: string; dismissed?: boolean };
type DayValidations = Record<string, SessionValidation>;

export const SESSION_VALIDATIONS_EVENT = "cn-session-validations";

function storageKey(profileId: ProfileId, date: string) {
  return `strava-match:${profileId}:${date}`;
}

function persistValidations(profileId: ProfileId, date: string, next: DayValidations) {
  storage.setJSON(storageKey(profileId, date), next);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SESSION_VALIDATIONS_EVENT));
  }
  return next;
}

export function loadSessionValidations(profileId: ProfileId, date = todayISO()): DayValidations {
  return storage.getJSON<DayValidations>(storageKey(profileId, date), {});
}

export function isSessionValidated(entry: SessionValidation | undefined) {
  return Boolean(entry && !entry.dismissed);
}

export function markSessionsValidated(
  profileId: ProfileId,
  sessionIds: string[],
  activityName: string,
  date = todayISO(),
) {
  const current = loadSessionValidations(profileId, date);
  const next = { ...current };
  for (const id of sessionIds) {
    next[id] = { activityName };
  }
  return persistValidations(profileId, date, next);
}

/** Marque la séance non faite. Santé ne la revalide pas aujourd’hui. */
export function unvalidateSession(
  profileId: ProfileId,
  sessionId: string,
  date = todayISO(),
) {
  const current = loadSessionValidations(profileId, date);
  const next = {
    ...current,
    [sessionId]: { activityName: current[sessionId]?.activityName ?? "", dismissed: true },
  };
  return persistValidations(profileId, date, next);
}

export function toggleSessionValidation(
  profileId: ProfileId,
  sessionId: string,
  date = todayISO(),
) {
  if (isSessionValidated(loadSessionValidations(profileId, date)[sessionId])) {
    return unvalidateSession(profileId, sessionId, date);
  }
  return markSessionsValidated(profileId, [sessionId], "Manuel", date);
}

/** Type + durée (±15 min ou 25 %). */
export function activityMatchesSession(activity: SimulatedStravaActivity, session: SportSession) {
  if (activity.type !== session.activity) return false;
  const delta = Math.abs(activity.durationMin - session.durationMin);
  return delta <= 15 || (session.durationMin > 0 && delta / session.durationMin <= 0.25);
}

export function sportActivityFromText(text: string): SportActivity | null {
  const t = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (/run|course|foot|jog/.test(t)) return "course";
  if (/ride|cycl|velo|bike/.test(t)) return "velo";
  if (/strength|muscu|weight|force|hiit|gym|musculation/.test(t)) return "muscu";
  return null;
}

/** Associe les séances Santé / Watch aux séances prévues (type + durée). Une séance = un match. */
export function matchWorkoutsToPlanned(
  workouts: Array<Pick<Workout, "name" | "type" | "durationMin">>,
  sessions: SportSession[],
  date = todayISO(),
) {
  const hits = new Map<string, string>();
  const used = new Set<number>();
  for (const session of sessions) {
    const index = workouts.findIndex((workout, i) => {
      if (used.has(i)) return false;
      const type = sportActivityFromText(`${workout.type} ${workout.name}`);
      if (!type) return false;
      return activityMatchesSession(
        { name: workout.name, type, durationMin: workout.durationMin, date },
        session,
      );
    });
    if (index < 0) continue;
    used.add(index);
    hits.set(session.id, workouts[index].name);
  }
  return hits;
}
