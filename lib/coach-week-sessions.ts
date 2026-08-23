import { addDaysISO, isoWeekday, todayISO } from "@/lib/dates";
import { isSessionValidated, loadSessionValidations, matchWorkoutsToPlanned } from "@/lib/strava-match";
import { activityLabel, effortLabel, sessionsForWeekday } from "@/lib/sport-routine";
import type { DailyMovement, ProfileId, SportActivity, SportEffort, SportSession, Workout } from "@/lib/types";

export type CoachSessionSnapshot = {
  date: string;
  weekday: number;
  activity: SportActivity;
  effort: SportEffort;
  durationMin: number;
  completed: boolean;
  label: string;
};

export type CoachActivityDay = {
  date: string;
  activeEnergyKcal: number;
  workoutMinutes: number;
  steps: number;
  plannedMinutes: number;
  completedMinutes: number;
};

export function activityWeekSummary(
  days: DailyMovement[],
  sessions: CoachSessionSnapshot[],
  today = todayISO(),
): CoachActivityDay[] {
  const byDate = new Map(days.map((day) => [day.date, day]));
  const out: CoachActivityDay[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = addDaysISO(today, -offset);
    const day = byDate.get(date);
    const planned = sessions.filter((session) => session.date === date);
    out.push({
      date,
      activeEnergyKcal: day?.activeEnergyKcal ?? 0,
      workoutMinutes: day?.workoutMinutes ?? 0,
      steps: day?.steps ?? 0,
      plannedMinutes: planned.reduce((sum, session) => sum + session.durationMin, 0),
      completedMinutes: planned
        .filter((session) => session.completed)
        .reduce((sum, session) => sum + session.durationMin, 0),
    });
  }
  return out;
}

export function sessionsLast7Days(
  profileId: ProfileId,
  sessions: SportSession[],
  today = todayISO(),
  workouts: Workout[] = [],
): CoachSessionSnapshot[] {
  const out: CoachSessionSnapshot[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = addDaysISO(today, -offset);
    const weekday = isoWeekday(date);
    const validations = loadSessionValidations(profileId, date);
    const daySessions = sessionsForWeekday(sessions, weekday);
    const hits = matchWorkoutsToPlanned(
      workouts.filter((workout) => workout.date === date),
      daySessions,
      date,
    );
    for (const session of daySessions) {
      out.push({
        date,
        weekday,
        activity: session.activity,
        effort: session.effort,
        durationMin: session.durationMin,
        completed: isSessionValidated(validations[session.id]) || hits.has(session.id),
        label: `${activityLabel(session.activity)} · ${effortLabel(session.effort)} · ${session.durationMin} min`,
      });
    }
  }
  return out;
}
