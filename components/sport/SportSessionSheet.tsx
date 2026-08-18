"use client";

import { X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  SPORT_ACTIVITIES,
  SPORT_EFFORTS,
  WEEKDAYS,
  defaultEffort,
  effortAllowed,
  emptyExercise,
  toggleWeekday,
} from "@/lib/sport-routine";
import type { SportActivity, SportExercise, SportSession } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SportSessionSheet({
  session,
  saving,
  onClose,
  onSave,
}: {
  session: SportSession;
  saving: boolean;
  onClose: () => void;
  onSave: (session: SportSession) => void;
}) {
  const [draft, setDraft] = useState<SportSession>(session);
  const efforts = SPORT_EFFORTS[draft.activity];
  const isMuscu = draft.activity === "muscu";
  const title = session.id.startsWith("new-") ? "Nouvelle séance" : "Éditer la séance";
  const canSave = useMemo(() => draft.durationMin >= 5, [draft.durationMin]);

  function setActivity(activity: SportActivity) {
    setDraft((current) => ({
      ...current,
      activity,
      effort: effortAllowed(activity, current.effort) ? current.effort : defaultEffort(activity),
      elevationM: activity === "muscu" ? 0 : current.elevationM || (activity === "velo" ? 500 : 80),
      exercises:
        activity === "muscu" && current.exercises.length === 0
          ? [emptyExercise()]
          : current.exercises,
    }));
  }

  function patchExercise(id: string, patch: Partial<SportExercise>) {
    setDraft((current) => ({
      ...current,
      exercises: current.exercises.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/30">
      <div className="max-h-[88vh] w-full max-w-[430px] overflow-y-auto rounded-t-[24px] bg-white p-4 pb-8 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[17px] font-semibold">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-full bg-health-bg p-1.5">
            <X size={16} />
          </button>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={Boolean(draft.shared)}
          onClick={() => setDraft((current) => ({ ...current, shared: !current.shared }))}
          className="mb-4 flex w-full items-center justify-between gap-3 rounded-2xl bg-health-bg px-3 py-3 text-left"
        >
          <span>
            <span className="block text-[13px] font-semibold">Séance en duo (Alexis & Élodie)</span>
            <span className="mt-0.5 block text-[11px] leading-relaxed text-health-muted">
              Enregistrée sur les deux routines, avec un badge Duo.
            </span>
          </span>
          <span
            className={cn(
              "relative h-7 w-11 shrink-0 rounded-full transition-colors",
              draft.shared ? "bg-health-ink" : "bg-health-line",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform",
                draft.shared ? "translate-x-[18px]" : "translate-x-0.5",
              )}
            />
          </span>
        </button>

        <p className="mb-2 text-[12px] font-medium text-health-muted">Activité</p>
        <div className="mb-3 grid grid-cols-3 gap-1.5">
          {SPORT_ACTIVITIES.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setActivity(option.id)}
              className={cn(
                "rounded-full px-2 py-2 text-[12px] font-semibold",
                draft.activity === option.id
                  ? "bg-health-ink text-white"
                  : "bg-health-bg text-health-muted",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <p className="mb-2 text-[12px] font-medium text-health-muted">Type d’effort</p>
        <div className="mb-1.5 grid grid-cols-2 gap-1.5">
          {efforts.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setDraft((current) => ({ ...current, effort: option.id }))}
              className={cn(
                "rounded-full px-2 py-2 text-[11px] font-semibold leading-tight",
                draft.effort === option.id
                  ? "bg-health-ink text-white"
                  : "bg-health-bg text-health-muted",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        {draft.effort === "zone-2" && (
          <p className="mb-3 text-[11px] leading-relaxed text-health-muted">
            Endurance fondamentale · rythme conversation facile.
          </p>
        )}
        {draft.effort !== "zone-2" && <div className="mb-2" />}

        <p className="mb-2 text-[12px] font-medium text-health-muted">Jours prévus</p>
        <div className="mb-3 grid grid-cols-7 gap-1">
          {WEEKDAYS.map((day) => {
            const active = (draft.weekdays ?? []).includes(day.id);
            return (
              <button
                key={day.id}
                type="button"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    weekdays: toggleWeekday(current.weekdays ?? [], day.id),
                  }))
                }
                className={cn(
                  "rounded-full py-2 text-[11px] font-semibold",
                  active ? "bg-health-ink text-white" : "bg-health-bg text-health-muted",
                )}
              >
                {day.label}
              </button>
            );
          })}
        </div>
        {(draft.weekdays ?? []).length === 0 && (
          <p className="mb-3 text-[11px] leading-relaxed text-health-muted">
            Sans jour, la séance n’apparaît pas dans Aujourd’hui.
          </p>
        )}

        <div className="space-y-1.5">
          <Stepper
            label="Durée de la séance"
            value={draft.durationMin}
            onChange={(durationMin) => setDraft((current) => ({ ...current, durationMin }))}
            step={5}
            min={5}
            max={480}
            suffix=" min"
          />
          {!isMuscu && (
            <Stepper
              label="Dénivelé positif (D+)"
              value={draft.elevationM}
              onChange={(elevationM) => setDraft((current) => ({ ...current, elevationM }))}
              step={50}
              min={0}
              max={8000}
              suffix=" m"
            />
          )}
        </div>

        <p className="mb-1 mt-4 text-[12px] font-medium text-health-muted">Découpage des exercices</p>
        <p className="mb-2 text-[11px] leading-relaxed text-health-muted">
          {isMuscu
            ? "Répétitions, ou temps / isométrie pour le HIIT et le gainage."
            : "Optionnel pour le cardio."}
        </p>
        <div className="space-y-2">
          {draft.exercises.map((exercise) => (
            <ExerciseEditor
              key={exercise.id}
              exercise={exercise}
              onChange={(patch) => patchExercise(exercise.id, patch)}
              onRemove={() =>
                setDraft((current) => ({
                  ...current,
                  exercises: current.exercises.filter((item) => item.id !== exercise.id),
                }))
              }
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            setDraft((current) => ({ ...current, exercises: [...current.exercises, emptyExercise()] }))
          }
          className="mt-2 w-full rounded-card bg-health-bg py-2.5 text-[13px] font-semibold"
        >
          Ajouter un exercice
        </button>

        <button
          type="button"
          disabled={saving || !canSave}
          onClick={() => onSave(draft)}
          className="mt-4 w-full rounded-card bg-health-ink py-3 text-[15px] font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Enregistrement…" : "Enregistrer la séance"}
        </button>
      </div>
    </div>
  );
}

function ExerciseEditor({
  exercise,
  onChange,
  onRemove,
}: {
  exercise: SportExercise;
  onChange: (patch: Partial<SportExercise>) => void;
  onRemove: () => void;
}) {
  const target = exercise.target ?? "reps";
  return (
    <div className="rounded-2xl bg-health-bg px-3 py-2.5">
      <input
        value={exercise.name}
        onChange={(e) => onChange({ name: e.target.value })}
        placeholder="Nom de l’exercice"
        className="w-full bg-transparent text-[14px] outline-none"
      />
      <p className="mb-1.5 mt-2 text-[11px] font-medium text-health-muted">Répétitions / Durée</p>
      <div className="grid grid-cols-2 gap-1.5">
        <TargetChip
          active={target === "reps"}
          label="Répétitions"
          onClick={() => onChange({ target: "reps" })}
        />
        <TargetChip
          active={target === "temps"}
          label="Temps / Isométrie"
          onClick={() => onChange({ target: "temps" })}
        />
      </div>
      <div className="mt-2 space-y-1.5">
        <MiniStepper
          label="Séries"
          value={exercise.sets}
          onChange={(sets) => onChange({ sets })}
          min={1}
          max={12}
        />
        {target === "reps" ? (
          <MiniStepper
            label="Répétitions"
            value={exercise.reps}
            onChange={(reps) => onChange({ reps })}
            min={1}
            max={50}
          />
        ) : (
          <>
            <MiniStepper
              label="Effort"
              value={exercise.workSec}
              onChange={(workSec) => onChange({ workSec })}
              min={5}
              max={300}
              step={5}
              suffix=" s"
            />
            <MiniStepper
              label="Repos"
              value={exercise.restSec}
              onChange={(restSec) => onChange({ restSec })}
              min={0}
              max={180}
              step={5}
              suffix=" s"
            />
          </>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="mt-2 text-[12px] font-semibold text-health-muted"
      >
        Retirer l’exercice
      </button>
    </div>
  );
}

function TargetChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-2 py-1.5 text-[11px] font-semibold",
        active ? "bg-health-ink text-white" : "bg-white text-health-muted",
      )}
    >
      {label}
    </button>
  );
}

function Stepper({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  max = 14,
  suffix = "",
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-health-bg px-3 py-2.5">
      <span className="text-[13px] font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - step))}
          className="h-8 w-8 rounded-full bg-white text-lg leading-none"
        >
          −
        </button>
        <span className="min-w-[3.5rem] text-center text-[14px] font-semibold tabular-nums">
          {value}
          {suffix}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + step))}
          className="h-8 w-8 rounded-full bg-white text-lg leading-none"
        >
          +
        </button>
      </div>
    </div>
  );
}

function MiniStepper({
  label,
  value,
  onChange,
  min = 1,
  max,
  step = 1,
  suffix = "",
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-health-muted">{label}</span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - step))}
          className="h-7 w-7 rounded-full bg-white text-[15px] leading-none"
        >
          −
        </button>
        <span className="min-w-[2.25rem] text-center text-[13px] font-semibold tabular-nums">
          {value}
          {suffix}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + step))}
          className="h-7 w-7 rounded-full bg-white text-[15px] leading-none"
        >
          +
        </button>
      </div>
    </div>
  );
}
