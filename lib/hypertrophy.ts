import { parseGeminiJson } from "@/lib/gemini/meals";
import { generateGeminiFlash } from "@/lib/gemini/flash";
import type { HypertrophyPrefs, MuscleGroup, SportExercise, SportSession, Weekday } from "@/lib/types";

export const MUSCLE_GROUPS: { id: MuscleGroup; label: string }[] = [
  { id: "pecs", label: "Pecs" },
  { id: "dos", label: "Dos" },
  { id: "jambes", label: "Jambes" },
  { id: "epaules", label: "Épaules" },
  { id: "bras", label: "Bras" },
  { id: "fessiers", label: "Fessiers" },
  { id: "abdos", label: "Abdos" },
];

const DAY_LABEL: Record<Weekday, string> = {
  1: "Lun",
  2: "Mar",
  3: "Mer",
  4: "Jeu",
  5: "Ven",
  6: "Sam",
  7: "Dim",
};

export type HypertrophyProposal = {
  warning: string | null;
  recommendedMinutesPerWeek: number;
  recommendedDays: number;
  sessions: SportSession[];
};

export const DEFAULT_HYPERTROPHY: HypertrophyPrefs = {
  focus: ["pecs", "dos", "jambes"],
  minutesPerSession: 45,
  weekdays: [1, 3, 5],
};

const MIN_DAYS = 3;
const MIN_MINUTES = 45;
const MIN_WEEKLY = 135;

const CATALOG: Record<MuscleGroup, Array<{ name: string; sets: number; reps: number }>> = {
  pecs: [
    { name: "Développé haltères", sets: 4, reps: 8 },
    { name: "Écarté poulie", sets: 3, reps: 12 },
    { name: "Pompes lestées", sets: 3, reps: 10 },
  ],
  dos: [
    { name: "Tractions / rowing", sets: 4, reps: 8 },
    { name: "Tirage horizontal", sets: 3, reps: 10 },
    { name: "Oiseau haltères", sets: 3, reps: 12 },
  ],
  jambes: [
    { name: "Squat gobelet", sets: 4, reps: 8 },
    { name: "Fentes marchées", sets: 3, reps: 10 },
    { name: "Soulevé de terre roumain", sets: 3, reps: 8 },
  ],
  epaules: [
    { name: "Développé militaire", sets: 4, reps: 8 },
    { name: "Élévations latérales", sets: 3, reps: 12 },
    { name: "Face pull", sets: 3, reps: 12 },
  ],
  bras: [
    { name: "Curl haltères", sets: 3, reps: 10 },
    { name: "Extension triceps", sets: 3, reps: 12 },
    { name: "Curl marteau", sets: 3, reps: 10 },
  ],
  fessiers: [
    { name: "Hip thrust", sets: 4, reps: 10 },
    { name: "Fentes arrière", sets: 3, reps: 10 },
    { name: "Abduction hanche", sets: 3, reps: 12 },
  ],
  abdos: [
    { name: "Gainage", sets: 3, reps: 40 },
    { name: "Crunch contrôlé", sets: 3, reps: 12 },
    { name: "Dead bug", sets: 3, reps: 10 },
  ],
};

export function muscleLabel(id: MuscleGroup) {
  return MUSCLE_GROUPS.find((item) => item.id === id)?.label ?? id;
}

export function parseHypertrophy(raw: unknown): HypertrophyPrefs | undefined {
  if (raw == null || typeof raw !== "object") return undefined;
  const rec = raw as Record<string, unknown>;
  const focus = Array.isArray(rec.focus)
    ? rec.focus.filter((item): item is MuscleGroup => MUSCLE_GROUPS.some((g) => g.id === item))
    : DEFAULT_HYPERTROPHY.focus;
  const weekdays = Array.isArray(rec.weekdays)
    ? rec.weekdays
        .map((item) => Number(item))
        .filter((item): item is Weekday => item >= 1 && item <= 7)
    : DEFAULT_HYPERTROPHY.weekdays;
  const minutes = Number(rec.minutesPerSession);
  return {
    focus: focus.length ? [...new Set(focus)] : [...DEFAULT_HYPERTROPHY.focus],
    minutesPerSession: Number.isFinite(minutes)
      ? Math.min(90, Math.max(20, Math.round(minutes / 5) * 5))
      : DEFAULT_HYPERTROPHY.minutesPerSession,
    weekdays: weekdays.length ? [...new Set(weekdays)].sort((a, b) => a - b) : [...DEFAULT_HYPERTROPHY.weekdays],
  };
}

export function volumeAdvice(prefs: HypertrophyPrefs): { warning: string | null; recommendedDays: number; recommendedMinutesPerWeek: number } {
  const days = prefs.weekdays.length;
  const weekly = days * prefs.minutesPerSession;
  const recommendedDays = Math.max(MIN_DAYS, days);
  const recommendedMinutesPerWeek = Math.max(MIN_WEEKLY, weekly, recommendedDays * MIN_MINUTES);
  if (days === 0) {
    return {
      warning: "Choisis au moins un jour, sinon aucune séance n’apparaît.",
      recommendedDays: MIN_DAYS,
      recommendedMinutesPerWeek,
    };
  }
  if (days < MIN_DAYS || prefs.minutesPerSession < MIN_MINUTES) {
    const extraDays = MIN_DAYS - days;
    const dayHint =
      extraDays > 0
        ? `Ajoute ${extraDays} jour${extraDays > 1 ? "s" : ""} (idéalement ${([1, 2, 3, 4, 5, 6, 7] as Weekday[]).filter((d) => !prefs.weekdays.includes(d)).slice(0, extraDays).map((d) => DAY_LABEL[d]).join(", ")}).`
        : "";
    const timeHint =
      prefs.minutesPerSession < MIN_MINUTES
        ? ` Passe à ${MIN_MINUTES} min par séance.`
        : "";
    return {
      warning: `Pour une prise de masse, vise au moins ${MIN_DAYS} séances de ${MIN_MINUTES} min (${MIN_WEEKLY} min / sem). ${dayHint}${timeHint}`.trim(),
      recommendedDays,
      recommendedMinutesPerWeek,
    };
  }
  return { warning: null, recommendedDays, recommendedMinutesPerWeek };
}

function exercisesFor(groups: MuscleGroup[], index: number): SportExercise[] {
  const picks = groups.length ? groups : (["pecs", "dos"] as MuscleGroup[]);
  const group = picks[index % picks.length];
  const extra = picks[(index + 1) % picks.length];
  const main = CATALOG[group] ?? CATALOG.pecs;
  const accessory = group === extra ? CATALOG.abdos : (CATALOG[extra] ?? []).slice(0, 1);
  const rows = [...main.slice(0, 3), ...accessory.slice(0, 1)];
  return rows.map((row, i) => ({
    id: `hyp-ex-${group}-${index}-${i}`,
    name: row.name,
    sets: row.sets,
    target: group === "abdos" && row.name === "Gainage" ? "temps" : "reps",
    reps: row.reps,
    workSec: row.name === "Gainage" ? 40 : 30,
    restSec: 45,
  }));
}

export function localHypertrophyProgram(prefs: HypertrophyPrefs, profileId: string): HypertrophyProposal {
  const advice = volumeAdvice(prefs);
  const days = prefs.weekdays.length ? prefs.weekdays : DEFAULT_HYPERTROPHY.weekdays;
  const focus = prefs.focus.length ? prefs.focus : DEFAULT_HYPERTROPHY.focus;
  const sessions: SportSession[] = days.map((day, index) => ({
    id: `hyp-${profileId}-${day}`,
    activity: "muscu",
    effort: "force",
    durationMin: prefs.minutesPerSession || MIN_MINUTES,
    elevationM: 0,
    shared: false,
    weekdays: [day],
    exercises: exercisesFor(focus, index),
  }));
  return {
    warning: advice.warning,
    recommendedDays: advice.recommendedDays,
    recommendedMinutesPerWeek: advice.recommendedMinutesPerWeek,
    sessions,
  };
}

export function hypertrophyPrompt(input: {
  name: string;
  diet: string;
  focus: MuscleGroup[];
  minutesPerSession: number;
  weekdays: Weekday[];
  currentMuscuDays: number;
}) {
  const days = input.weekdays.map((id) => DAY_LABEL[id] ?? id).join(", ");
  const focus = input.focus.map(muscleLabel).join(", ");
  return `Tu es coach muscu. Objectif : prise de masse (hypertrophie).
Profil : ${input.name}, ${input.diet}.
Zones à muscler : ${focus || "full body"}.
Disponibilité : ${input.weekdays.length} jour(s) (${days || "aucun"}) · ${input.minutesPerSession} min / séance.
Muscu actuelle : ${input.currentMuscuDays} séance(s) / sem.

Propose EXACTEMENT ${Math.max(1, input.weekdays.length)} séances, une par jour choisi, qui tiennent dans ${input.minutesPerSession} min.
Exercices d'hypertrophie (4–8 reps force ou 8–12), 3 à 5 mouvements par séance. Pas de machines introuvables : haltères, barre, poids du corps, banc OK.

Si le volume est trop bas pour une prise de masse (< 3×45 min / sem), remplis "warning" avec une préconisation concrète (jours et minutes en plus). Sinon warning = null.

JSON strict :
{
  "warning": "…" | null,
  "sessions": [
    {
      "weekday": 1,
      "title": "Pecs / Triceps",
      "durationMin": 45,
      "exercises": [{ "name": "Développé haltères", "sets": 4, "reps": 8, "target": "reps" }]
    }
  ]
}`;
}

export function parseHypertrophyProposal(
  raw: unknown,
  prefs: HypertrophyPrefs,
  profileId: string,
): HypertrophyProposal {
  const fallback = localHypertrophyProgram(prefs, profileId);
  const rec = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const list = Array.isArray(rec.sessions) ? rec.sessions : [];
  const sessions: SportSession[] = [];
  list.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const row = item as Record<string, unknown>;
    const weekday = Number(row.weekday) as Weekday;
    const day = weekday >= 1 && weekday <= 7 ? weekday : prefs.weekdays[index];
    if (!day) return;
    const exercisesRaw = Array.isArray(row.exercises) ? row.exercises : [];
    const exercises: SportExercise[] = exercisesRaw.slice(0, 6).map((ex, exIndex) => {
      const e = ex && typeof ex === "object" ? (ex as Record<string, unknown>) : {};
      const name = String(e.name ?? "").trim() || `Exercice ${exIndex + 1}`;
      const target = e.target === "temps" ? "temps" : "reps";
      return {
        id: `hyp-ex-${profileId}-${day}-${exIndex}`,
        name,
        sets: Math.min(6, Math.max(2, Math.round(Number(e.sets) || 3))),
        target,
        reps: Math.min(20, Math.max(5, Math.round(Number(e.reps) || 10))),
        workSec: Math.min(90, Math.max(20, Math.round(Number(e.workSec) || 40))),
        restSec: Math.min(90, Math.max(20, Math.round(Number(e.restSec) || 45))),
      };
    });
    if (exercises.length === 0) return;
    sessions.push({
      id: `hyp-${profileId}-${day}`,
      activity: "muscu",
      effort: "force",
      durationMin: Math.min(90, Math.max(20, Math.round(Number(row.durationMin) || prefs.minutesPerSession))),
      elevationM: 0,
      shared: false,
      weekdays: [day],
      exercises,
    });
  });
  const advice = volumeAdvice(prefs);
  const warning =
    typeof rec.warning === "string" && rec.warning.trim()
      ? rec.warning.trim()
      : advice.warning;
  return {
    warning,
    recommendedDays: advice.recommendedDays,
    recommendedMinutesPerWeek: advice.recommendedMinutesPerWeek,
    sessions: sessions.length ? sessions : fallback.sessions,
  };
}

export async function proposeHypertrophyProgram(input: {
  name: string;
  diet: string;
  prefs: HypertrophyPrefs;
  currentMuscuDays: number;
  profileId: string;
}): Promise<HypertrophyProposal> {
  const fallback = localHypertrophyProgram(input.prefs, input.profileId);
  try {
    const raw = await generateGeminiFlash({
      parts: [
        {
          text: hypertrophyPrompt({
            name: input.name,
            diet: input.diet,
            focus: input.prefs.focus,
            minutesPerSession: input.prefs.minutesPerSession,
            weekdays: input.prefs.weekdays,
            currentMuscuDays: input.currentMuscuDays,
          }),
        },
      ],
      temperature: 0.4,
    });
    return parseHypertrophyProposal(parseGeminiJson(raw), input.prefs, input.profileId);
  } catch {
    return fallback;
  }
}

export function applyHypertrophySessions(
  existing: SportSession[],
  proposed: SportSession[],
): SportSession[] {
  const kept = existing.filter((session) => !session.id.startsWith("hyp-"));
  return [...kept, ...proposed];
}
