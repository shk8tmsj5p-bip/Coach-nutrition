"use client";

import { X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  SPORT_ACTIVITIES,
  SPORT_EFFORTS,
  defaultEffort,
  effortAllowed,
} from "@/lib/sport-routine";
import type { LoggedTodaySession } from "@/lib/today-sport";
import type { SportActivity } from "@/lib/types";
import { cn } from "@/lib/utils";

export function LogTodaySessionSheet({
  draft,
  plannedLabel,
  saving,
  onClose,
  onSave,
}: {
  draft: LoggedTodaySession;
  plannedLabel?: string;
  saving: boolean;
  onClose: () => void;
  onSave: (next: LoggedTodaySession) => void;
}) {
  const [next, setNext] = useState<LoggedTodaySession>(draft);
  const efforts = SPORT_EFFORTS[next.activity];
  const canSave = useMemo(() => next.durationMin >= 1, [next.durationMin]);
  const title = draft.plannedId ? "Ce que j’ai fait" : "Noter une séance";

  function setActivity(activity: SportActivity) {
    setNext((current) => ({
      ...current,
      activity,
      effort: effortAllowed(activity, current.effort) ? current.effort : defaultEffort(activity),
      source: current.source === "manual" ? "manual" : current.source,
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
        <p className="mb-3 text-[12px] leading-relaxed text-health-muted">
          {plannedLabel
            ? `Prévu : ${plannedLabel}. Ça ne change pas ta routine Suivi — seulement aujourd’hui.`
            : "Rien n’était prévu, ou tu as fait un extra. Ça ne change pas ta routine Suivi."}
        </p>

        <p className="mb-2 text-[12px] font-medium text-health-muted">Activité</p>
        <div className="mb-3 grid grid-cols-3 gap-1.5">
          {SPORT_ACTIVITIES.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setActivity(option.id)}
              className={cn(
                "rounded-full px-2 py-2 text-[12px] font-semibold",
                next.activity === option.id
                  ? "bg-health-ink text-white"
                  : "bg-health-bg text-health-muted",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <p className="mb-2 text-[12px] font-medium text-health-muted">Type d’effort</p>
        <div className="mb-3 grid grid-cols-2 gap-1.5">
          {efforts.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setNext((current) => ({ ...current, effort: option.id }))}
              className={cn(
                "rounded-full px-2 py-2 text-[11px] font-semibold leading-tight",
                next.effort === option.id
                  ? "bg-health-ink text-white"
                  : "bg-health-bg text-health-muted",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <Stepper
          label="Durée"
          value={next.durationMin}
          onChange={(durationMin) => setNext((current) => ({ ...current, durationMin }))}
          step={5}
          min={5}
          max={480}
          suffix=" min"
        />
        <div className="mt-1.5">
          <Stepper
            label="Kcal (optionnel)"
            value={next.calories}
            onChange={(calories) => setNext((current) => ({ ...current, calories }))}
            step={10}
            min={0}
            max={2500}
            suffix=""
          />
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-health-muted">
          La tuile Active (Santé) reste la dépense du jour. Les kcal ici décrivent la séance.
        </p>

        <button
          type="button"
          disabled={saving || !canSave}
          onClick={() => onSave({ ...next, source: next.source === "strava" || next.source === "apple-health" ? next.source : "manual" })}
          className="mt-4 w-full rounded-card bg-health-ink py-3 text-[15px] font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}

function Stepper({
  label,
  value,
  onChange,
  step,
  min,
  max,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step: number;
  min: number;
  max: number;
  suffix: string;
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
