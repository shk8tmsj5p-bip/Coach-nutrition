import type { Pesee, Profile, ProfileId, SportRoutine, SundayJournalFields } from "@/lib/types";
import { mondayOf, todayISO } from "@/lib/dates";
import { journalsFromPesees } from "@/lib/gemini/coach";
import { emptyJournal, seriesOf, sliceLastNDays, withMovingAverages } from "@/lib/pesees";
import { storage } from "@/lib/storage";

export const COACH_PAYLOAD_KEY = "coach-week-payload";

export type CoachTrendPoint = { date: string; value: number; ma7: number; ma14: number };

export type CoachWeekPayload = {
  status: "ready";
  destination: "tab-4-metabolique";
  profileId: ProfileId;
  profileName: string;
  weekStart: string;
  generatedAt: string;
  weightTrend7d: CoachTrendPoint[];
  /** Legacy alias — same 7-day window. Kept so older localStorage payloads still parse. */
  weightTrend14d?: CoachTrendPoint[];
  latestMa7: number | null;
  latestMa14: number | null;
  plateau: boolean;
  journal: { date: string; notes: SundayJournalFields };
  recentJournals: Array<{ date: string; notes: SundayJournalFields }>;
  sportRoutine: SportRoutine;
  goals: {
    primaryGoal: Profile["primaryGoal"];
    weeklyRateKg: number;
    startWeightKg: number;
    targetWeightKg: number;
    currentWeightKg: number;
  };
};

export function coachWeightTrend(payload: CoachWeekPayload): CoachTrendPoint[] {
  if (payload.weightTrend7d?.length) return payload.weightTrend7d;
  return payload.weightTrend14d ?? [];
}

export function buildCoachWeekPayload(
  profile: Profile,
  rows: Pesee[],
  journalDate: string,
  notes: SundayJournalFields,
): CoachWeekPayload {
  const full = withMovingAverages(seriesOf(rows, "poids"));
  const trend = sliceLastNDays(full, 7);
  const last = trend[trend.length - 1] ?? full[full.length - 1];
  const ma7 = last?.ma7 ?? null;
  const ma14 = last?.ma14 ?? null;
  const prev = trend[0];
  const plateau = ma7 != null && prev?.ma7 != null && Math.abs(ma7 - prev.ma7) < 0.15;
  const recent = journalsFromPesees(rows).filter((entry) => entry.date !== journalDate);

  return {
    status: "ready",
    destination: "tab-4-metabolique",
    profileId: profile.id,
    profileName: profile.name,
    weekStart: mondayOf(journalDate),
    generatedAt: todayISO(),
    weightTrend7d: trend,
    weightTrend14d: trend,
    latestMa7: ma7,
    latestMa14: ma14,
    plateau,
    journal: { date: journalDate, notes },
    recentJournals: recent.slice(0, 4),
    sportRoutine: profile.sportRoutine,
    goals: {
      primaryGoal: profile.primaryGoal,
      weeklyRateKg: profile.weeklyRateKg,
      startWeightKg: profile.startWeightKg,
      targetWeightKg: profile.targetWeightKg,
      currentWeightKg: last?.value ?? profile.currentWeightKg,
    },
  };
}

export function buildCoachContextFromRows(profile: Profile, rows: Pesee[]): CoachWeekPayload {
  const queued = loadCoachWeekPayload(profile.id);
  const journals = journalsFromPesees(rows);
  const latest = journals[0];
  const date = latest?.date ?? queued?.journal.date ?? todayISO();
  const notes = latest?.notes ?? queued?.journal.notes ?? emptyJournal();
  return buildCoachWeekPayload(profile, rows, date, notes);
}

export function persistCoachWeekPayload(payload: CoachWeekPayload) {
  const all = storage.getJSON<Partial<Record<ProfileId, CoachWeekPayload>>>(COACH_PAYLOAD_KEY, {});
  storage.setJSON(COACH_PAYLOAD_KEY, { ...all, [payload.profileId]: payload });
}

export function loadCoachWeekPayload(profileId: ProfileId): CoachWeekPayload | null {
  const all = storage.getJSON<Partial<Record<ProfileId, CoachWeekPayload>>>(COACH_PAYLOAD_KEY, {});
  return all[profileId] ?? null;
}
