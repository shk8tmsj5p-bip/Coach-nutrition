"use client";

import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import {
  CARDIO_ACTIVITIES,
  allCardioSlots,
  applyCardioSessions,
  defaultDuration,
  defaultElevation,
  elevationOptions,
  initialCardioPrefs,
  minutesFor,
  volumeAdvice,
  type CardioProposal,
} from "@/lib/cardio";
import { WEEKDAYS, activityLabel, deriveRoutine, effortLabel, formatExercises, formatWeekdays } from "@/lib/sport-routine";
import { goalLabel } from "@/lib/goals";
import type { CardioActivity, CardioPrefs, CardioSlot, Profile, SportRoutine, Weekday } from "@/lib/types";
import { cn } from "@/lib/utils";
import { withGeminiWait } from "@/lib/gemini/wait";

export function CardioPlanner({
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
  const [prefs, setPrefs] = useState<CardioPrefs>(() => initialCardioPrefs(routine));
  const [proposal, setProposal] = useState<CardioProposal | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const liveAdvice = useMemo(() => volumeAdvice(prefs, profile.primaryGoal), [prefs, profile.primaryGoal]);
  const slots = allCardioSlots(prefs);
  const weekly = slots.reduce((sum, slot) => sum + slot.durationMin, 0);

  function updatePrefs(next: CardioPrefs) {
    setPrefs(next);
    setProposal(null);
    setError(null);
  }

  function slotOn(day: Weekday) {
    return prefs.slots.find((slot) => slot.weekday === day);
  }

  function setDay(day: Weekday, activity: CardioActivity | null) {
    const current = slotOn(day);
    if (activity == null || current?.activity === activity) {
      updatePrefs({ slots: prefs.slots.filter((slot) => slot.weekday !== day) });
      return;
    }
    const durationMin = current?.activity === activity ? current.durationMin : defaultDuration(activity);
    const next: CardioSlot = {
      id: current?.id ?? `${activity}-${day}`,
      weekday: day,
      activity,
      durationMin,
      elevationM: defaultElevation(activity, durationMin),
    };
    updatePrefs({
      slots: [...prefs.slots.filter((slot) => slot.weekday !== day), next].sort((a, b) => a.weekday - b.weekday),
    });
  }

  function patchDay(day: Weekday, patch: Partial<Pick<CardioSlot, "durationMin" | "elevationM">>) {
    updatePrefs({
      slots: prefs.slots.map((slot) => {
        if (slot.weekday !== day) return slot;
        const durationMin = patch.durationMin ?? slot.durationMin;
        const elevationM =
          patch.elevationM ??
          (patch.durationMin != null ? defaultElevation(slot.activity, durationMin) : slot.elevationM);
        return { ...slot, durationMin, elevationM };
      }),
    });
  }

  async function propose() {
    setBusy(true);
    setError(null);
    try {
      const res = await withGeminiWait("Le coach prépare tes sorties…", () =>
        fetch("/api/coach-cardio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: profile.name,
            profileId: profile.id,
            goal: profile.primaryGoal,
            weeklyRateKg: profile.weeklyRateKg,
            prefs,
          }),
        }),
      );
      const data = (await res.json()) as { proposal?: CardioProposal; error?: string };
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
    const sessions = applyCardioSessions(routine.sessions, proposal.sessions);
    await onApply(deriveRoutine(sessions, undefined, routine.hypertrophy, prefs));
  }

  return (
    <div className="mt-3 rounded-2xl bg-health-bg px-3 py-3">
      <p className="text-[13px] font-semibold">Course & vélo · coach</p>
      <p className="mt-0.5 text-[11px] leading-snug text-health-muted">
        Coche tes jours : sport, durée, D+. Le coach choisit le type de sortie ({goalLabel(profile.primaryGoal).toLowerCase()}).
      </p>

      <div className="mt-3 space-y-2">
        {WEEKDAYS.map((day) => {
          const slot = slotOn(day.id);
          return (
            <DayRow
              key={day.id}
              label={day.label}
              slot={slot}
              onPick={(activity) => setDay(day.id, activity)}
              onPatch={(patch) => patchDay(day.id, patch)}
            />
          );
        })}
      </div>

      {liveAdvice.warning ? (
        <p className="mt-2 text-[12px] leading-snug text-amber-700 dark:text-amber-400">{liveAdvice.warning}</p>
      ) : (
        <p className="mt-2 text-[11px] text-health-muted">
          {slots.length} sortie{slots.length > 1 ? "s" : ""} · {weekly} min / sem
        </p>
      )}

      <button
        type="button"
        disabled={busy || slots.length === 0}
        onClick={() => void propose()}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-health-ink py-2.5 text-[13px] font-semibold text-health-on-fill disabled:opacity-40"
      >
        <Sparkles size={14} />
        {busy ? "Le coach prépare…" : "Proposer le programme"}
      </button>
      {error ? <p className="mt-2 text-[12px] text-coral">{error}</p> : null}

      {proposal ? (
        <div className="mt-3 space-y-2">
          {proposal.warning ? (
            <p className="text-[12px] leading-snug text-amber-700 dark:text-amber-400">{proposal.warning}</p>
          ) : null}
          <p className="text-[12px] leading-snug text-health-muted">{proposal.progression}</p>
          {proposal.sessions.map((session) => (
            <div key={session.id} className="rounded-xl bg-health-card px-2.5 py-2">
              <p className="text-[13px] font-semibold">
                {formatWeekdays(session.weekdays)} · {activityLabel(session.activity)} · {effortLabel(session.effort)} ·{" "}
                {session.durationMin} min
              </p>
              <p className="mt-0.5 text-[11px] text-health-muted">D+ {session.elevationM} m</p>
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

function DayRow({
  label,
  slot,
  onPick,
  onPatch,
}: {
  label: string;
  slot: CardioSlot | undefined;
  onPick: (activity: CardioActivity | null) => void;
  onPatch: (patch: Partial<Pick<CardioSlot, "durationMin" | "elevationM">>) => void;
}) {
  return (
    <div className="rounded-xl bg-health-card px-2.5 py-2">
      <div className="flex items-center gap-2">
        <p className="w-8 shrink-0 text-[12px] font-semibold">{label}</p>
        <div className="flex flex-1 gap-1">
          {CARDIO_ACTIVITIES.map((sport) => {
            const on = slot?.activity === sport.id;
            return (
              <button
                key={sport.id}
                type="button"
                onClick={() => onPick(sport.id)}
                className={cn(
                  "flex-1 rounded-full py-1.5 text-[11px] font-semibold",
                  on ? "bg-health-ink text-health-on-fill" : "bg-health-bg text-health-muted",
                )}
              >
                {sport.label}
              </button>
            );
          })}
        </div>
      </div>
      {slot ? (
        <>
          <p className="mb-1 mt-2 text-[10px] font-medium text-health-muted">Durée</p>
          <div className="flex flex-wrap gap-1">
            {[...new Set([...minutesFor(slot.activity), slot.durationMin])].sort((a, b) => a - b).map((min) => (
              <button
                key={min}
                type="button"
                onClick={() => onPatch({ durationMin: min })}
                className={cn(
                  "rounded-full px-2 py-1 text-[10px] font-semibold",
                  slot.durationMin === min ? "bg-health-ink text-health-on-fill" : "bg-health-bg text-health-muted",
                )}
              >
                {formatDurationChip(min)}
              </button>
            ))}
          </div>
          <p className="mb-1 mt-2 text-[10px] font-medium text-health-muted">Dénivelé</p>
          <div className="flex flex-wrap gap-1">
            {[...new Set([...elevationOptions(slot.activity), slot.elevationM])].sort((a, b) => a - b).map((meters) => (
              <button
                key={meters}
                type="button"
                onClick={() => onPatch({ elevationM: meters })}
                className={cn(
                  "rounded-full px-2 py-1 text-[10px] font-semibold",
                  slot.elevationM === meters ? "bg-health-ink text-health-on-fill" : "bg-health-bg text-health-muted",
                )}
              >
                {meters === 0 ? "Plat" : `${meters} m`}
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-1.5 text-[10px] text-health-muted">Repos</p>
      )}
    </div>
  );
}

function formatDurationChip(min: number) {
  if (min === 60) return "1 h";
  if (min === 90) return "1 h 30";
  if (min === 120) return "2 h";
  return `${min} min`;
}
