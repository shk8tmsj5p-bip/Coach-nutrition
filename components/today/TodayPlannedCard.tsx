"use client";

import { Bike, Check, Dumbbell, Footprints, RefreshCw, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Card, SectionTitle } from "@/components/ui/Card";
import { CoachBadge, CoachDiffTags, coachHighlightClass } from "@/components/today/CoachDelta";
import { useProfile } from "@/context/ProfileContext";
import {
  dismissSport,
  dismissSportSession,
  hasSportHighlights,
  sportDiffTags,
  visibleSportDiff,
} from "@/lib/coach-adjustments";
import { isoWeekday, todayISO } from "@/lib/dates";
import {
  activityLabel,
  effortLabel,
  formatExercises,
  formatHoursMinutes,
  parseSportRoutine,
  sessionsForWeekday,
} from "@/lib/sport-routine";
import {
  buildSimulatedStravaActivity,
  loadSessionValidations,
  markSessionsValidated,
  matchPlannedSessions,
  matchWorkoutsToPlanned,
} from "@/lib/strava-match";
import type { Profile, SportActivity, SportSession, Workout } from "@/lib/types";
import { cn } from "@/lib/utils";

const ACTIVITY_ICON = {
  course: Footprints,
  velo: Bike,
  muscu: Dumbbell,
} as const;

export function TodayPlannedCard({
  profile,
  workouts = [],
}: {
  profile: Profile;
  workouts?: Workout[];
}) {
  const { updateAppliedAdjustments } = useProfile();
  const date = todayISO();
  const weekday = isoWeekday(date);
  const planned = useMemo(
    () => sessionsForWeekday(parseSportRoutine(profile.sportRoutine).sessions, weekday),
    [profile.sportRoutine, weekday],
  );
  const [validations, setValidations] = useState(() => loadSessionValidations(profile.id, date));
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setValidations(loadSessionValidations(profile.id, date));
    setNotice(null);
  }, [profile.id, date]);

  useEffect(() => {
    if (planned.length === 0 || workouts.length === 0) return;
    const hits = matchWorkoutsToPlanned(workouts, planned, date);
    const fresh = [...hits.entries()].filter(([id]) => !loadSessionValidations(profile.id, date)[id]);
    if (fresh.length === 0) return;
    setValidations(
      markSessionsValidated(
        profile.id,
        fresh.map(([id]) => id),
        fresh[0][1],
        date,
      ),
    );
  }, [workouts, planned, profile.id, date]);

  async function hideSport(sessionId: string) {
    if (!profile.appliedAdjustments) return;
    await updateAppliedAdjustments(
      profile.id,
      dismissSportSession(profile.appliedAdjustments, sessionId),
    );
  }

  function simulateStrava() {
    const pending = planned.find((session) => !validations[session.id]) ?? planned[0];
    if (!pending) return;
    const activity = buildSimulatedStravaActivity(pending, date);
    const matched = matchPlannedSessions(activity, planned, weekday);
    if (matched.length === 0) {
      setNotice(
        `Aucune séance prévue ne correspond à ${activity.name} (${activity.durationMin} min).`,
      );
      return;
    }
    const next = markSessionsValidated(
      profile.id,
      matched.map((session) => session.id),
      activity.name,
      date,
    );
    setValidations(next);
    setNotice(
      `Strava · ${activity.name} · ${activity.durationMin} min — ${matched.length} séance${matched.length > 1 ? "s" : ""} validée${matched.length > 1 ? "s" : ""}.`,
    );
  }

  async function hideAllSport() {
    if (!profile.appliedAdjustments) return;
    await updateAppliedAdjustments(profile.id, dismissSport(profile.appliedAdjustments));
  }

  const sportActive = hasSportHighlights(profile.appliedAdjustments);

  return (
    <>
      <SectionTitle>Prévu aujourd’hui</SectionTitle>
      <Card>
        {planned.length === 0 ? (
          <div>
            <p className="text-[14px] leading-relaxed text-health-muted">
              Rien de prévu aujourd’hui dans ta routine sport.
            </p>
            {sportActive && (
              <div className="mt-2">
                <CoachBadge onDismiss={() => void hideAllSport()} />
                <p className="mt-1.5 text-[12px] leading-relaxed text-health-muted">
                  Ajustement Coach actif sur la routine (pas de séance aujourd’hui).
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {planned.map((session) => (
              <PlannedRow
                key={session.id}
                session={session}
                validated={Boolean(validations[session.id])}
                stravaName={validations[session.id]?.activityName}
                coachDiff={
                  validations[session.id]
                    ? null
                    : visibleSportDiff(profile.appliedAdjustments, session.id, session.activity)
                }
                onDismissCoach={() => void hideSport(session.id)}
              />
            ))}
            <button
              type="button"
              onClick={simulateStrava}
              className="flex w-full items-center justify-center gap-2 rounded-card bg-health-bg py-2.5 text-[13px] font-semibold"
            >
              <RefreshCw size={14} />
              Simuler sync Strava
            </button>
            {notice && <p className="text-[12px] leading-relaxed text-health-muted">{notice}</p>}
          </div>
        )}
      </Card>
    </>
  );
}

function PlannedRow({
  session,
  validated,
  stravaName,
  coachDiff,
  onDismissCoach,
}: {
  session: SportSession;
  validated: boolean;
  stravaName?: string;
  coachDiff: ReturnType<typeof visibleSportDiff>;
  onDismissCoach: () => void;
}) {
  const Icon = ACTIVITY_ICON[session.activity as SportActivity];
  const breakdown = formatExercises(session.exercises);
  const tags = coachDiff ? sportDiffTags(coachDiff) : [];
  const highlighted = Boolean(coachDiff);
  return (
    <div className={cn("rounded-2xl bg-health-bg px-3 py-2.5", highlighted && "ring-1 ring-coral/35")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[14px] font-semibold">
            <Icon size={15} />
            {activityLabel(session.activity)} · {effortLabel(session.effort)}
          </p>
          <p className="mt-0.5 text-[13px] text-health-muted">
            {formatHoursMinutes(session.durationMin)}
            {session.activity !== "muscu" ? ` · D+ ${session.elevationM} m` : ""}
          </p>
        </div>
        <StatusPill validated={validated} />
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {highlighted && <CoachBadge onDismiss={onDismissCoach} />}
        {session.shared && (
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold">
            <Users size={11} />
            Duo
          </span>
        )}
        {validated && (
          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-health-ink">
            {stravaName?.toLowerCase().includes("strava") ? "Strava" : "Santé"}
          </span>
        )}
      </div>
      {highlighted && <CoachDiffTags tags={tags} />}
      {breakdown && <p className="mt-1.5 text-[12px] leading-relaxed text-health-muted">{breakdown}</p>}
      {validated && stravaName && (
        <p className="mt-1 text-[11px] text-health-muted">{stravaName}</p>
      )}
    </div>
  );
}

function StatusPill({ validated }: { validated: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        validated ? "bg-emerald-50 text-emerald-700" : "bg-white text-health-muted",
      )}
    >
      {validated ? <Check size={11} /> : null}
      {validated ? "Validé" : "À faire"}
    </span>
  );
}
