"use client";

import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import {
  DEFAULT_HYPERTROPHY,
  MUSCLE_GROUPS,
  applyHypertrophySessions,
  volumeAdvice,
  type HypertrophyProposal,
} from "@/lib/hypertrophy";
import { WEEKDAYS, deriveRoutine, formatExercises, formatWeekdays } from "@/lib/sport-routine";
import type { HypertrophyPrefs, MuscleGroup, Profile, SportRoutine, Weekday } from "@/lib/types";
import { cn } from "@/lib/utils";
import { withGeminiWait } from "@/lib/gemini/wait";

function toggleFocus(current: MuscleGroup[], id: MuscleGroup) {
  return current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
}

function toggleDay(current: Weekday[], id: Weekday) {
  const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
  return next.sort((a, b) => a - b);
}

export function HypertrophyPlanner({
  profile,
  routine,
  saving,
  onApply,
}: {
  profile: Profile;
  routine: SportRoutine;
  saving: boolean;
  onApply: (routine: SportRoutine) => Promise<void>;
}) {
  const [prefs, setPrefs] = useState<HypertrophyPrefs>(
    () => routine.hypertrophy ?? DEFAULT_HYPERTROPHY,
  );
  const [proposal, setProposal] = useState<HypertrophyProposal | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const liveAdvice = useMemo(() => volumeAdvice(prefs), [prefs]);

  function updatePrefs(patch: (current: HypertrophyPrefs) => HypertrophyPrefs) {
    setPrefs(patch);
    setProposal(null);
    setError(null);
  }

  async function propose() {
    setBusy(true);
    setError(null);
    try {
      const res = await withGeminiWait("Le coach prépare tes séances…", () =>
        fetch("/api/coach-hypertrophy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: profile.name,
            diet: profile.diet,
            profileId: profile.id,
            prefs,
            currentMuscuDays: routine.strengthDays,
          }),
        }),
      );
      const data = (await res.json()) as { proposal?: HypertrophyProposal; error?: string };
      if (!data.proposal) {
        setError(data.error ?? "Programme indisponible");
        return;
      }
      setProposal(data.proposal);
    } catch {
      setError("Programme indisponible. Réessaie.");
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!proposal) return;
    const sessions = applyHypertrophySessions(routine.sessions, proposal.sessions);
    await onApply(deriveRoutine(sessions, undefined, prefs, routine.cardio));
  }

  return (
    <div className="mt-3 rounded-2xl bg-health-bg px-3 py-3">
      <p className="text-[13px] font-semibold">Prise de masse · muscu</p>
      <p className="mt-0.5 text-[11px] leading-snug text-health-muted">
        Propose les séances. Tu valides → ça devient ta routine. Zones à muscler, jours et durée. Le coach propose les exercices.
      </p>

      <p className="mb-1.5 mt-3 text-[11px] font-medium text-health-muted">Je veux muscler</p>
      <div className="flex flex-wrap gap-1.5">
        {MUSCLE_GROUPS.map((group) => {
          const on = prefs.focus.includes(group.id);
          return (
            <button
              key={group.id}
              type="button"
              onClick={() => updatePrefs((current) => ({ ...current, focus: toggleFocus(current.focus, group.id) }))}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                on ? "bg-health-ink text-health-on-fill" : "bg-health-card text-health-muted",
              )}
            >
              {group.label}
            </button>
          );
        })}
      </div>

      <p className="mb-1.5 mt-3 text-[11px] font-medium text-health-muted">Jours disponibles</p>
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((day) => {
          const on = prefs.weekdays.includes(day.id);
          return (
            <button
              key={day.id}
              type="button"
              onClick={() => updatePrefs((current) => ({ ...current, weekdays: toggleDay(current.weekdays, day.id) }))}
              className={cn(
                "rounded-full py-1.5 text-[11px] font-semibold",
                on ? "bg-health-ink text-health-on-fill" : "bg-health-card text-health-muted",
              )}
            >
              {day.label}
            </button>
          );
        })}
      </div>

      <p className="mb-1.5 mt-3 text-[11px] font-medium text-health-muted">Temps par séance</p>
      <div className="flex flex-wrap gap-1.5">
        {[30, 45, 60, 75].map((min) => (
          <button
            key={min}
            type="button"
            onClick={() => updatePrefs((current) => ({ ...current, minutesPerSession: min }))}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-semibold",
              prefs.minutesPerSession === min
                ? "bg-health-ink text-health-on-fill"
                : "bg-health-card text-health-muted",
            )}
          >
            {min} min
          </button>
        ))}
      </div>

      {liveAdvice.warning ? (
        <p className="mt-2 text-[12px] leading-snug text-amber-700 dark:text-amber-400">
          {liveAdvice.warning}
        </p>
      ) : (
        <p className="mt-2 text-[11px] text-health-muted">
          Volume : {prefs.weekdays.length} × {prefs.minutesPerSession} min ={" "}
          {prefs.weekdays.length * prefs.minutesPerSession} min / sem
        </p>
      )}

      <button
        type="button"
        disabled={busy || prefs.weekdays.length === 0 || prefs.focus.length === 0}
        onClick={() => void propose()}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-health-ink py-2.5 text-[13px] font-semibold text-health-on-fill disabled:opacity-40"
      >
        <Sparkles size={14} />
        {busy ? "Le coach prépare…" : "Proposer les exercices"}
      </button>
      {error ? <p className="mt-2 text-[12px] text-coral">{error}</p> : null}

      {proposal ? (
        <div className="mt-3 space-y-2">
          {proposal.warning ? (
            <p className="text-[12px] leading-snug text-amber-700 dark:text-amber-400">{proposal.warning}</p>
          ) : null}
          {proposal.sessions.map((session) => (
            <div key={session.id} className="rounded-xl bg-health-card px-2.5 py-2">
              <p className="text-[13px] font-semibold">
                {formatWeekdays(session.weekdays)} · {session.durationMin} min
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-health-muted">
                {formatExercises(session.exercises) ?? "—"}
              </p>
            </div>
          ))}
          <button
            type="button"
            disabled={saving}
            onClick={() => void apply()}
            className="w-full rounded-xl bg-health-card py-2.5 text-[13px] font-semibold disabled:opacity-50"
          >
            {saving ? "Enregistrement…" : "Mettre dans ma routine"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

