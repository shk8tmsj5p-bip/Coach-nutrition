"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { emptyExercise } from "@/lib/sport-routine";
import type { SportExercise } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ExerciseListEditor({
  exercises,
  onChange,
  hint,
}: {
  exercises: SportExercise[];
  onChange: (next: SportExercise[]) => void;
  hint?: string;
}) {
  function patch(id: string, update: Partial<SportExercise>) {
    onChange(exercises.map((item) => (item.id === id ? { ...item, ...update } : item)));
  }

  function move(id: string, dir: -1 | 1) {
    const index = exercises.findIndex((item) => item.id === id);
    const nextIndex = index + dir;
    if (index < 0 || nextIndex < 0 || nextIndex >= exercises.length) return;
    const next = [...exercises];
    const [row] = next.splice(index, 1);
    next.splice(nextIndex, 0, row);
    onChange(next);
  }

  return (
    <div>
      {hint ? <p className="mb-2 text-[11px] leading-relaxed text-health-muted">{hint}</p> : null}
      <div className="space-y-2">
        {exercises.map((exercise, index) => (
          <ExerciseEditor
            key={exercise.id}
            exercise={exercise}
            canUp={index > 0}
            canDown={index < exercises.length - 1}
            onChange={(update) => patch(exercise.id, update)}
            onRemove={() => onChange(exercises.filter((item) => item.id !== exercise.id))}
            onUp={() => move(exercise.id, -1)}
            onDown={() => move(exercise.id, 1)}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange([...exercises, emptyExercise()])}
        className="mt-2 w-full rounded-card bg-health-bg py-2.5 text-[13px] font-semibold"
      >
        Ajouter un exercice
      </button>
    </div>
  );
}

function ExerciseEditor({
  exercise,
  canUp,
  canDown,
  onChange,
  onRemove,
  onUp,
  onDown,
}: {
  exercise: SportExercise;
  canUp: boolean;
  canDown: boolean;
  onChange: (patch: Partial<SportExercise>) => void;
  onRemove: () => void;
  onUp: () => void;
  onDown: () => void;
}) {
  const target = exercise.target ?? "reps";
  return (
    <div className="rounded-2xl bg-health-bg px-3 py-2.5">
      <div className="flex items-start gap-1">
        <input
          value={exercise.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Nom : développé haltères, fentes…"
          className="min-w-0 flex-1 bg-transparent text-[14px] outline-none"
        />
        <div className="flex shrink-0 flex-col">
          <button
            type="button"
            aria-label="Monter"
            disabled={!canUp}
            onClick={onUp}
            className="rounded-full p-0.5 text-health-muted disabled:opacity-30"
          >
            <ChevronUp size={14} />
          </button>
          <button
            type="button"
            aria-label="Descendre"
            disabled={!canDown}
            onClick={onDown}
            className="rounded-full p-0.5 text-health-muted disabled:opacity-30"
          >
            <ChevronDown size={14} />
          </button>
        </div>
      </div>
      <input
        value={exercise.notes ?? ""}
        onChange={(e) => onChange({ notes: e.target.value.slice(0, 160) })}
        placeholder="Consigne (optionnel) : pause 1 s, pieds écartés…"
        className="mt-1 w-full bg-transparent text-[12px] text-health-muted outline-none"
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
