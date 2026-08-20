"use client";

import { X } from "lucide-react";
import { defaultRateForGoal, formatWeeklyRate, GOAL_OPTIONS, RATE_OPTIONS } from "@/lib/goals";
import type { GoalPatch } from "@/lib/goals";
import type { PrimaryGoal, Profile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useState } from "react";

function asField(value: number) {
  return String(value).replace(".", ",");
}

function parseKg(raw: string) {
  const n = Number(raw.trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function EditGoalsSheet({
  profile,
  saving,
  onClose,
  onSave,
}: {
  profile: Profile;
  saving: boolean;
  onClose: () => void;
  onSave: (patch: GoalPatch) => void;
}) {
  const [start, setStart] = useState(asField(profile.startWeightKg));
  const [target, setTarget] = useState(asField(profile.targetWeightKg));
  const [goal, setGoal] = useState<PrimaryGoal>(profile.primaryGoal);
  const [rate, setRate] = useState(profile.weeklyRateKg);
  const [error, setError] = useState<string | null>(null);

  function pickGoal(next: PrimaryGoal) {
    setGoal(next);
    const options = RATE_OPTIONS[next];
    if (!options.includes(rate)) setRate(defaultRateForGoal(next));
  }

  function confirm() {
    const startWeightKg = parseKg(start);
    const targetWeightKg = parseKg(target);
    if (startWeightKg == null || targetWeightKg == null) {
      setError("Indique un poids de départ et une cible.");
      return;
    }
    if (goal === "perte" && targetWeightKg >= startWeightKg) {
      setError("En perte, la cible doit être inférieure au départ.");
      return;
    }
    if (goal === "prise" && targetWeightKg <= startWeightKg) {
      setError("En prise de masse, la cible doit être supérieure au départ.");
      return;
    }
    onSave({
      startWeightKg,
      targetWeightKg,
      primaryGoal: goal,
      weeklyRateKg: goal === "maintien" ? 0 : rate,
      sportRoutine: profile.sportRoutine,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
      <div className="max-h-[88vh] w-full max-w-[430px] overflow-y-auto rounded-t-[24px] bg-white p-4 pb-8 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[17px] font-semibold">Objectifs · {profile.name}</h3>
          <button type="button" onClick={onClose} className="rounded-full bg-health-bg p-1.5">
            <X size={16} />
          </button>
        </div>

        <label className="mb-2 block">
          <span className="text-[12px] font-medium text-health-muted">Poids de départ (kg)</span>
          <input
            inputMode="decimal"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="mt-1 w-full rounded-card bg-health-bg px-3 py-2.5 text-[15px] tabular-nums"
          />
        </label>
        <label className="mb-3 block">
          <span className="text-[12px] font-medium text-health-muted">Poids cible (kg)</span>
          <input
            inputMode="decimal"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="mt-1 w-full rounded-card bg-health-bg px-3 py-2.5 text-[15px] tabular-nums"
          />
        </label>

        <p className="mb-2 text-[12px] font-medium text-health-muted">Objectif principal</p>
        <div className="mb-3 grid grid-cols-3 gap-1.5">
          {GOAL_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => pickGoal(option.id)}
              className={cn(
                "rounded-full px-2 py-2 text-[11px] font-semibold leading-tight",
                goal === option.id ? "bg-health-ink text-white" : "bg-health-bg text-health-muted",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <p className="mb-2 text-[12px] font-medium text-health-muted">Rythme hebdo</p>
        <div className="flex flex-wrap gap-1.5">
          {RATE_OPTIONS[goal].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRate(value)}
              className={cn(
                "rounded-full px-3 py-2 text-[12px] font-semibold",
                rate === value ? "bg-health-ink text-white" : "bg-health-bg text-health-muted",
              )}
            >
              {formatWeeklyRate(value)}
            </button>
          ))}
        </div>

        <p className="mt-4 text-[12px] leading-relaxed text-health-muted">
          En bas, « Ma routine sport » : coche tes jours (course ou vélo, durée, D+), le coach propose le type de
          sortie pour {goal === "prise" ? "la prise de masse" : goal === "maintien" ? "le maintien" : "la perte de poids"} et
          pour progresser.
          {goal === "prise"
            ? " Tu peux aussi dire quelles zones muscler : il propose les exercices, et te prévient si le volume est trop juste."
            : ""}
        </p>

        {error && <p className="mt-3 text-[13px] text-coral">{error}</p>}

        <button
          type="button"
          disabled={saving}
          onClick={confirm}
          className="mt-4 w-full rounded-card bg-health-ink py-3 text-[15px] font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Enregistrement…" : "Enregistrer les objectifs"}
        </button>
      </div>
    </div>
  );
}
