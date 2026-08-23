"use client";

import { Bike, Check, Dumbbell, Footprints, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Card, SectionTitle } from "@/components/ui/Card";
import { CoachBadge, CoachDiffTags } from "@/components/today/CoachDelta";
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
  formatExerciseLine,
  formatHoursMinutes,
  parseSportRoutine,
  sessionsForWeekday,
} from "@/lib/sport-routine";
import {
  isSessionValidated,
  loadSessionValidations,
  markSessionsValidated,
  matchWorkoutsToPlanned,
  toggleSessionValidation,
} from "@/lib/strava-match";
import type { Profile, SportActivity, SportSession, Workout } from "@/lib/types";
import { cn } from "@/lib/utils";

const ACTIVITY_ICON = {
  course: Footprints,
  velo: Bike,
  muscu: Dumbbell,
} as const;

function sourceBadge(activityName?: string) {
  if (!activityName) return null;
  const n = activityName.toLowerCase();
  if (n === "manuel") return null;
  if (n.includes("strava")) return "Strava";
  return "Santé";
}

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

  useEffect(() => {
    setValidations(loadSessionValidations(profile.id, date));
  }, [profile.id, date]);

  useEffect(() => {
    if (planned.length === 0 || workouts.length === 0) return;
    const hits = matchWorkoutsToPlanned(workouts, planned, date);
    const current = loadSessionValidations(profile.id, date);
    const fresh = [...hits.entries()].filter(([id]) => current[id] == null);
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

  function toggleDone(sessionId: string) {
    setValidations(toggleSessionValidation(profile.id, sessionId, date));
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
            {planned.map((session) => {
              const entry = validations[session.id];
              const validated = isSessionValidated(entry);
              return (
                <PlannedRow
                  key={session.id}
                  session={session}
                  validated={validated}
                  sourceLabel={validated ? sourceBadge(entry?.activityName) : null}
                  sourceName={validated && sourceBadge(entry?.activityName) ? entry?.activityName : undefined}
                  coachDiff={
                    validated ? null : visibleSportDiff(profile.appliedAdjustments, session.id, session.activity)
                  }
                  onToggle={() => toggleDone(session.id)}
                  onDismissCoach={() => void hideSport(session.id)}
                />
              );
            })}
            <p className="text-[11px] leading-relaxed text-health-muted">
              Touche À faire / Validé pour marquer à la main. Une séance Watch ou Strava dans Santé
              valide toute seule si le type et la durée collent.
            </p>
          </div>
        )}
      </Card>
    </>
  );
}

function PlannedRow({
  session,
  validated,
  sourceLabel,
  sourceName,
  coachDiff,
  onToggle,
  onDismissCoach,
}: {
  session: SportSession;
  validated: boolean;
  sourceLabel: string | null;
  sourceName?: string;
  coachDiff: ReturnType<typeof visibleSportDiff>;
  onToggle: () => void;
  onDismissCoach: () => void;
}) {
  const Icon = ACTIVITY_ICON[session.activity as SportActivity];
  const named = session.exercises.filter((exercise) => exercise.name.trim());
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
        <StatusPill validated={validated} onToggle={onToggle} />
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {highlighted && <CoachBadge onDismiss={onDismissCoach} />}
        {session.shared && (
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold">
            <Users size={11} />
            Duo
          </span>
        )}
        {validated && sourceLabel ? (
          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-health-ink">
            {sourceLabel}
          </span>
        ) : null}
      </div>
      {highlighted && <CoachDiffTags tags={tags} />}
      {named.length > 0 ? (
        <ul className="mt-1.5 space-y-0.5">
          {named.map((exercise) => (
            <li key={exercise.id} className="text-[12px] leading-snug text-health-muted">
              {formatExerciseLine(exercise)}
            </li>
          ))}
        </ul>
      ) : null}
      {validated && sourceName ? <p className="mt-1 text-[11px] text-health-muted">{sourceName}</p> : null}
    </div>
  );
}

function StatusPill({ validated, onToggle }: { validated: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        validated ? "bg-emerald-50 text-emerald-700" : "bg-white text-health-muted",
      )}
    >
      {validated ? <Check size={11} /> : null}
      {validated ? "Validé" : "À faire"}
    </button>
  );
}
