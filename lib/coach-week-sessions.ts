import { addDaysISO, isoWeekday, todayISO } from "@/lib/dates";
import { loadSessionValidations } from "@/lib/strava-match";
import { activityLabel, effortLabel, sessionsForWeekday } from "@/lib/sport-routine";
import type { ProfileId, SportActivity, SportEffort, SportSession } from "@/lib/types";

export type CoachSessionSnapshot = {
  date: string;
  weekday: number;
  activity: SportActivity;
  effort: SportEffort;
  durationMin: number;
  completed: boolean;
  label: string;
};

export function sessionsLast7Days(
  profileId: ProfileId,
  sessions: SportSession[],
  today = todayISO(),
): CoachSessionSnapshot[] {
  const out: CoachSessionSnapshot[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = addDaysISO(today, -offset);
    const weekday = isoWeekday(date);
    const validations = loadSessionValidations(profileId, date);
    for (const session of sessionsForWeekday(sessions, weekday)) {
      out.push({
        date,
        weekday,
        activity: session.activity,
        effort: session.effort,
        durationMin: session.durationMin,
        completed: Boolean(validations[session.id]),
        label: `${activityLabel(session.activity)} · ${effortLabel(session.effort)} · ${session.durationMin} min`,
      });
    }
  }
  return out;
}
