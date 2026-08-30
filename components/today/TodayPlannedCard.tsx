"use client";

import { Bike, Check, Dumbbell, Footprints, Pencil, Plus, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LogTodaySessionSheet } from "@/components/today/LogTodaySessionSheet";
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
  defaultEffort,
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
  unmatchedWorkouts,
} from "@/lib/strava-match";
import {
  claimedWorkoutIds,
  draftFromPlanned,
  draftFromWorkout,
  extrasLogged,
  loadLoggedToday,
  loggedForPlanned,
  newExtraId,
  removeTodaySport,
  saveTodaySport,
  type LoggedTodaySession,
} from "@/lib/today-sport";
import type { Profile, SportActivity, SportSession, Workout } from "@/lib/types";
import { cn } from "@/lib/utils";

const ACTIVITY_ICON = {
  course: Footprints,
  velo: Bike,
  muscu: Dumbbell,
} as const;

function sourceBadge(activityName?: string, source?: LoggedTodaySession["source"]) {
  if (source === "strava" || activityName?.toLowerCase().includes("strava")) return "Strava";
  if (source === "manual" || activityName?.toLowerCase() === "manuel") return "Manuel";
  if (source === "apple-health" || activityName) return "Santé";
  return null;
}

export function TodayPlannedCard({
  profile,
  workouts = [],
  onWorkoutsChanged,
}: {
  profile: Profile;
  workouts?: Workout[];
  onWorkoutsChanged?: () => void;
}) {
  const { updateAppliedAdjustments } = useProfile();
  const date = todayISO();
  const weekday = isoWeekday(date);
  const planned = useMemo(
    () => sessionsForWeekday(parseSportRoutine(profile.sportRoutine).sessions, weekday),
    [profile.sportRoutine, weekday],
  );
  const [validations, setValidations] = useState(() => loadSessionValidations(profile.id, date));
  const [logs, setLogs] = useState(() => loadLoggedToday(profile.id, date));
  const [editor, setEditor] = useState<LoggedTodaySession | null>(null);
  const [plannedHint, setPlannedHint] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  function refreshLogs() {
    setLogs(loadLoggedToday(profile.id, date));
    setValidations(loadSessionValidations(profile.id, date));
  }

  useEffect(() => {
    refreshLogs();
  }, [profile.id, date]);

  useEffect(() => {
    const bump = () => refreshLogs();
    window.addEventListener("cn-session-validations", bump);
    return () => window.removeEventListener("cn-session-validations", bump);
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

  const unmatched = useMemo(
    () => unmatchedWorkouts(workouts, planned, date, claimedWorkoutIds(logs)),
    [workouts, planned, date, logs],
  );
  const extras = extrasLogged(logs);
  const sportActive = hasSportHighlights(profile.appliedAdjustments);

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

  function openEdit(session: SportSession) {
    const existing = loggedForPlanned(logs, session.id);
    setPlannedHint(`${activityLabel(session.activity)} · ${effortLabel(session.effort)}`);
    setEditor(
      existing ??
        draftFromPlanned({
          plannedId: session.id,
          activity: session.activity,
          effort: session.effort,
          durationMin: session.durationMin,
          elevationM: session.elevationM,
        }),
    );
  }

  function openExtra(existing?: LoggedTodaySession) {
    setPlannedHint(undefined);
    setEditor(
      existing ?? {
        id: newExtraId(),
        plannedId: null,
        activity: "velo",
        effort: defaultEffort("velo"),
        durationMin: 45,
        calories: 0,
        source: "manual",
      },
    );
  }

  function attachWorkout(workout: Workout) {
    const freePlanned = planned.find((session) => !loggedForPlanned(logs, session.id));
    const draft = draftFromWorkout(workout, freePlanned?.id ?? null);
    if (!draft) {
      openExtra({
        id: newExtraId(),
        plannedId: freePlanned?.id ?? null,
        activity: "velo",
        effort: defaultEffort("velo"),
        durationMin: workout.durationMin,
        calories: workout.calories,
        source: workout.source,
        workoutId: workout.id,
        workoutName: workout.name,
      });
      return;
    }
    setPlannedHint(
      freePlanned
        ? `${activityLabel(freePlanned.activity)} · ${effortLabel(freePlanned.effort)}`
        : undefined,
    );
    setEditor(draft);
  }

  async function saveEditor(next: LoggedTodaySession) {
    setSaving(true);
    const result = await saveTodaySport(profile.id, next, date);
    setSaving(false);
    setEditor(null);
    refreshLogs();
    onWorkoutsChanged?.();
    if (result.error) {
      console.warn("[today-sport]", result.error);
    }
  }

  async function removeLog(log: LoggedTodaySession) {
    await removeTodaySport(profile.id, log, date);
    refreshLogs();
    onWorkoutsChanged?.();
  }

  return (
    <>
      <SectionTitle>Prévu aujourd’hui</SectionTitle>
      <Card>
        {planned.length === 0 && extras.length === 0 ? (
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
            {unmatched.length > 0 ? <UnmatchedBlock workouts={unmatched} onAttach={attachWorkout} /> : null}
            <AddDoneButton onClick={() => openExtra()} />
          </div>
        ) : (
          <div className="space-y-3">
            {planned.length === 0 ? (
              <p className="text-[14px] leading-relaxed text-health-muted">
                Rien de prévu dans ta routine — tu as noté ce que tu as fait.
              </p>
            ) : null}
            {planned.map((session) => {
              const entry = validations[session.id];
              const overlay = loggedForPlanned(logs, session.id);
              const validated = isSessionValidated(entry) || Boolean(overlay);
              return (
                <PlannedRow
                  key={session.id}
                  session={session}
                  overlay={overlay}
                  validated={validated}
                  sourceLabel={
                    validated
                      ? sourceBadge(overlay ? undefined : entry?.activityName, overlay?.source)
                      : null
                  }
                  sourceName={
                    overlay?.workoutName ??
                    (validated && sourceBadge(entry?.activityName) ? entry?.activityName : undefined)
                  }
                  coachDiff={
                    validated ? null : visibleSportDiff(profile.appliedAdjustments, session.id, session.activity)
                  }
                  onToggle={() => toggleDone(session.id)}
                  onEdit={() => openEdit(session)}
                  onDismissCoach={() => void hideSport(session.id)}
                />
              );
            })}
            {extras.map((log) => (
              <ExtraRow
                key={log.id}
                log={log}
                onEdit={() => openExtra(log)}
                onRemove={() => void removeLog(log)}
              />
            ))}
            {unmatched.length > 0 ? <UnmatchedBlock workouts={unmatched} onAttach={attachWorkout} /> : null}
            <AddDoneButton onClick={() => openExtra()} label={planned.length === 0 ? undefined : "Autre séance faite"} />
            <p className="text-[11px] leading-relaxed text-health-muted">
              Modifier si tu as fait autre chose. Une séance Watch ou Strava dans Santé valide toute
              seule si le type et la durée collent.
            </p>
          </div>
        )}
      </Card>
      {editor ? (
        <LogTodaySessionSheet
          draft={editor}
          plannedLabel={plannedHint}
          saving={saving}
          onClose={() => setEditor(null)}
          onSave={(next) => void saveEditor(next)}
        />
      ) : null}
    </>
  );
}

function UnmatchedBlock({
  workouts,
  onAttach,
}: {
  workouts: Workout[];
  onAttach: (workout: Workout) => void;
}) {
  return (
    <div className="mt-3 rounded-2xl bg-health-bg px-3 py-2.5">
      <p className="text-[12px] font-semibold">Santé / Strava aujourd’hui</p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-health-muted">
        Type ou durée différents du prévu — ou rien n’était planifié. Dis si c’est ta séance.
      </p>
      <ul className="mt-2 space-y-2">
        {workouts.map((workout) => (
          <li key={workout.id} className="flex items-center justify-between gap-2">
            <p className="min-w-0 text-[13px] leading-snug">
              <span className="font-semibold">{workout.name}</span>
              <span className="block text-[12px] text-health-muted">
                {formatHoursMinutes(workout.durationMin)}
                {workout.calories > 0 ? ` · ${workout.calories} kcal` : ""}
                {workout.source === "strava"
                  ? " · Strava"
                  : workout.source === "manual"
                    ? " · Manuel"
                    : " · Santé"}
              </span>
            </p>
            <button
              type="button"
              onClick={() => onAttach(workout)}
              className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold"
            >
              C’est ça
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AddDoneButton({ onClick, label }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-health-bg py-2.5 text-[13px] font-semibold"
    >
      <Plus size={14} />
      {label ?? "Noter une séance faite"}
    </button>
  );
}

function PlannedRow({
  session,
  overlay,
  validated,
  sourceLabel,
  sourceName,
  coachDiff,
  onToggle,
  onEdit,
  onDismissCoach,
}: {
  session: SportSession;
  overlay: LoggedTodaySession | null;
  validated: boolean;
  sourceLabel: string | null;
  sourceName?: string;
  coachDiff: ReturnType<typeof visibleSportDiff>;
  onToggle: () => void;
  onEdit: () => void;
  onDismissCoach: () => void;
}) {
  const shownActivity = overlay?.activity ?? session.activity;
  const Icon = ACTIVITY_ICON[shownActivity as SportActivity];
  const named = session.exercises.filter((exercise) => exercise.name.trim());
  const tags = coachDiff ? sportDiffTags(coachDiff) : [];
  const highlighted = Boolean(coachDiff);
  const changed =
    overlay &&
    (overlay.activity !== session.activity || overlay.durationMin !== session.durationMin);
  return (
    <div className={cn("rounded-2xl bg-health-bg px-3 py-2.5", highlighted && "ring-1 ring-coral/35")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[14px] font-semibold">
            <Icon size={15} />
            {overlay
              ? `${activityLabel(overlay.activity)} · ${effortLabel(overlay.effort)}`
              : `${activityLabel(session.activity)} · ${effortLabel(session.effort)}`}
          </p>
          <p className="mt-0.5 text-[13px] text-health-muted">
            {formatHoursMinutes(overlay?.durationMin ?? session.durationMin)}
            {(overlay?.activity ?? session.activity) !== "muscu"
              ? ` · D+ ${overlay?.elevationM ?? session.elevationM} m`
              : ""}
            {overlay && overlay.calories > 0 ? ` · ${overlay.calories} kcal` : ""}
          </p>
          {changed ? (
            <p className="mt-0.5 text-[11px] text-health-muted">
              Prévu : {activityLabel(session.activity)} · {formatHoursMinutes(session.durationMin)}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusPill validated={validated} onToggle={onToggle} />
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-health-muted"
          >
            <Pencil size={11} />
            Modifier
          </button>
        </div>
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
      {!overlay && named.length > 0 ? (
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

function ExtraRow({
  log,
  onEdit,
  onRemove,
}: {
  log: LoggedTodaySession;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const Icon = ACTIVITY_ICON[log.activity];
  return (
    <div className="rounded-2xl bg-health-bg px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[14px] font-semibold">
            <Icon size={15} />
            {activityLabel(log.activity)} · {effortLabel(log.effort)}
          </p>
          <p className="mt-0.5 text-[13px] text-health-muted">
            {formatHoursMinutes(log.durationMin)}
            {log.calories > 0 ? ` · ${log.calories} kcal` : ""}
            {" · extra"}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
          <Check size={11} />
          Fait
        </span>
      </div>
      <div className="mt-1.5 flex gap-1.5">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-health-muted"
        >
          Modifier
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-health-muted"
        >
          Retirer
        </button>
      </div>
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
