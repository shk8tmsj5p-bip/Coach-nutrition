import { parseGeminiJson } from "@/lib/gemini/meals";
import { generateGeminiFlash } from "@/lib/gemini/flash";
import { goalLabel } from "@/lib/goals";
import type {
  CardioActivity,
  CardioPrefs,
  CardioSlot,
  PrimaryGoal,
  SportEffort,
  SportExercise,
  SportSession,
  Weekday,
} from "@/lib/types";

export const CARDIO_ACTIVITIES: { id: CardioActivity; label: string }[] = [
  { id: "course", label: "Course" },
  { id: "velo", label: "Vélo" },
];

export const CARDIO_EFFORTS: { id: SportEffort; label: string }[] = [
  { id: "fractionne", label: "Fractionné" },
  { id: "sortie-longue", label: "Sortie longue" },
  { id: "endurance", label: "Endurance" },
  { id: "zone-2", label: "Récup / Z2" },
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

const ALL_DAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7];
const CARDIO_EFFORT_IDS: SportEffort[] = CARDIO_EFFORTS.map((item) => item.id);

export const COURSE_MINUTES = [30, 40, 45, 50, 60, 75];
export const VELO_MINUTES = [45, 60, 75, 90, 120];
export const COURSE_ELEVATION = [0, 40, 80, 120, 200, 300, 500];
export const VELO_ELEVATION = [0, 150, 300, 500, 800, 1000, 1500, 2000];

export type CardioProposal = {
  warning: string | null;
  progression: string;
  recommendedMinutesPerWeek: number;
  sessions: SportSession[];
};

export function minutesFor(activity: CardioActivity) {
  return activity === "velo" ? VELO_MINUTES : COURSE_MINUTES;
}

export function elevationOptions(activity: CardioActivity) {
  return activity === "velo" ? VELO_ELEVATION : COURSE_ELEVATION;
}

export function defaultDuration(activity: CardioActivity) {
  return activity === "velo" ? 60 : 40;
}

export function defaultElevation(activity: CardioActivity, durationMin: number) {
  const perMin = activity === "velo" ? 8 : 2;
  const target = durationMin * perMin;
  const options = elevationOptions(activity);
  return options.reduce((best, value) => (Math.abs(value - target) < Math.abs(best - target) ? value : best));
}

function clampMin(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value / 5) * 5));
}

function clampElevation(activity: CardioActivity, value: unknown, durationMin: number) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return defaultElevation(activity, durationMin);
  return Math.min(activity === "velo" ? 4000 : 1200, Math.round(n / 10) * 10);
}

function parseEffort(value: unknown): SportEffort {
  const raw = String(value ?? "");
  return CARDIO_EFFORT_IDS.includes(raw as SportEffort) ? (raw as SportEffort) : "endurance";
}

function parseActivity(value: unknown): CardioActivity {
  return value === "velo" || value === "ride" ? "velo" : "course";
}

function parseSlot(value: unknown, fallbackActivity: CardioActivity, index: number): CardioSlot | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  const weekday = Number(rec.weekday);
  if (weekday < 1 || weekday > 7) return null;
  const activity = rec.activity != null ? parseActivity(rec.activity) : fallbackActivity;
  const duration = Number(rec.durationMin ?? rec.duration_min);
  const durationMin = Number.isFinite(duration) ? clampMin(duration, 20, 180) : defaultDuration(activity);
  return {
    id: String(rec.id ?? `${activity}-${weekday}-${index}`),
    weekday: weekday as Weekday,
    activity,
    durationMin,
    elevationM: clampElevation(activity, rec.elevationM ?? rec.elevation_m ?? rec.dPlus, durationMin),
  };
}

function flattenLegacy(rec: Record<string, unknown>): CardioSlot[] {
  const course = Array.isArray(rec.course) ? rec.course : [];
  const velo = Array.isArray(rec.velo) ? rec.velo : [];
  const merged: CardioSlot[] = [];
  course.forEach((item, index) => {
    const slot = parseSlot(item, "course", index);
    if (slot) merged.push({ ...slot, activity: "course" });
  });
  velo.forEach((item, index) => {
    const slot = parseSlot(item, "velo", index);
    if (slot) merged.push({ ...slot, activity: "velo" });
  });
  return dedupeDays(merged);
}

function dedupeDays(slots: CardioSlot[]): CardioSlot[] {
  const byDay = new Map<Weekday, CardioSlot>();
  for (const slot of [...slots].sort((a, b) => b.durationMin - a.durationMin)) {
    if (!byDay.has(slot.weekday)) byDay.set(slot.weekday, slot);
  }
  return [...byDay.values()].sort((a, b) => a.weekday - b.weekday);
}

export function parseCardio(raw: unknown): CardioPrefs | undefined {
  if (raw == null || typeof raw !== "object") return undefined;
  const rec = raw as Record<string, unknown>;
  if (Array.isArray(rec.slots)) {
    const slots = rec.slots
      .map((item, index) => parseSlot(item, "course", index))
      .filter((slot): slot is CardioSlot => slot != null);
    return { slots: dedupeDays(slots) };
  }
  const legacy = flattenLegacy(rec);
  if (!legacy.length) return { slots: [] };
  return { slots: legacy };
}

export function slotsFromSessions(sessions: SportSession[]): CardioPrefs {
  const slots: CardioSlot[] = [];
  for (const session of sessions) {
    if (session.activity !== "course" && session.activity !== "velo") continue;
    const days = session.weekdays.length ? session.weekdays : ([1] as Weekday[]);
    for (const weekday of days) {
      slots.push({
        id: `${session.activity}-${session.id}-${weekday}`,
        weekday,
        activity: session.activity,
        durationMin: clampMin(session.durationMin, 20, 180),
        elevationM: clampElevation(session.activity, session.elevationM, session.durationMin),
      });
    }
  }
  return { slots: dedupeDays(slots) };
}

export const DEFAULT_CARDIO: CardioPrefs = {
  slots: [
    {
      id: "def-1",
      weekday: 1,
      activity: "course",
      durationMin: 40,
      elevationM: defaultElevation("course", 40),
    },
    {
      id: "def-2",
      weekday: 2,
      activity: "course",
      durationMin: 40,
      elevationM: defaultElevation("course", 40),
    },
    {
      id: "def-4",
      weekday: 4,
      activity: "velo",
      durationMin: 60,
      elevationM: defaultElevation("velo", 60),
    },
  ],
};

export function initialCardioPrefs(routine: { cardio?: CardioPrefs; sessions: SportSession[] }): CardioPrefs {
  const stored = routine.cardio ? parseCardio(routine.cardio) : undefined;
  if (stored && stored.slots.length) return stored;
  const fromSessions = slotsFromSessions(routine.sessions);
  if (fromSessions.slots.length) return fromSessions;
  return { slots: DEFAULT_CARDIO.slots.map((slot) => ({ ...slot })) };
}

export function allCardioSlots(prefs: CardioPrefs): CardioSlot[] {
  return [...prefs.slots].sort((a, b) => a.weekday - b.weekday);
}

export function cardioEffortLabel(effort: SportEffort) {
  return CARDIO_EFFORTS.find((item) => item.id === effort)?.label ?? effort;
}

function timed(
  id: string,
  name: string,
  sets: number,
  workSec: number,
  restSec: number,
): SportExercise {
  return {
    id,
    name,
    sets,
    target: "temps",
    reps: 10,
    workSec: Math.min(300, Math.max(20, workSec)),
    restSec: Math.min(180, Math.max(0, restSec)),
  };
}

function structureFor(
  activity: CardioActivity,
  weekday: Weekday,
  effort: SportEffort,
  durationMin: number,
): SportExercise[] {
  const prefix = `${activity}-${weekday}`;
  const run = activity === "course";
  if (effort === "fractionne") {
    const reps = durationMin >= 55 ? 8 : durationMin >= 40 ? 6 : 5;
    return [
      timed(`${prefix}-wu`, run ? "Échauffement trot souple" : "Échauffement braquet léger", 1, 300, 0),
      timed(
        `${prefix}-int`,
        run ? "Répétitions rapides" : "Intervalles (gros braquet / souple)",
        reps,
        60,
        75,
      ),
      timed(`${prefix}-cd`, "Retour au calme", 1, 240, 0),
    ];
  }
  if (effort === "sortie-longue") {
    return [
      timed(
        `${prefix}-l`,
        run ? "Footing long, parler facilement" : "Sortie continue, braquet confortable",
        1,
        300,
        0,
      ),
    ];
  }
  if (effort === "zone-2") {
    return [
      timed(`${prefix}-z2`, run ? "Z2 nasale, jamais essoufflé" : "Z2 endurance fondamentale", 1, 300, 0),
    ];
  }
  return [
    timed(`${prefix}-end`, run ? "Allure endurance, rythme régulier" : "Endurance, cadence stable", 1, 300, 0),
  ];
}

/** Le coach choisit le type : longue = plus longue / plus de D+, 1 qualité si assez de jours. */
export function assignEfforts(slots: CardioSlot[], goal: PrimaryGoal): Map<string, SportEffort> {
  const map = new Map<string, SportEffort>();
  if (slots.length === 0) return map;

  const ranked = [...slots].sort(
    (a, b) => b.durationMin - a.durationMin || b.elevationM - a.elevationM || a.weekday - b.weekday,
  );
  const longest = ranked[0];
  const longCut = longest.activity === "velo" ? 70 : 45;

  if (slots.length === 1) {
    const only = slots[0];
    map.set(
      only.id,
      goal === "prise" ? "zone-2" : only.durationMin >= longCut ? "sortie-longue" : "endurance",
    );
    return map;
  }

  map.set(
    longest.id,
    goal === "prise" && longest.durationMin < 80 ? "endurance" : "sortie-longue",
  );

  if (goal !== "prise" && slots.length >= 3) {
    const quality = ranked.find((slot) => slot.id !== longest.id && Math.abs(slot.weekday - longest.weekday) !== 1) ??
      ranked.find((slot) => slot.id !== longest.id);
    if (quality) map.set(quality.id, "fractionne");
  }

  for (const slot of slots) {
    if (map.has(slot.id)) continue;
    map.set(slot.id, goal === "prise" || slot.durationMin <= 40 ? "zone-2" : "endurance");
  }
  return map;
}

export function volumeAdvice(
  prefs: CardioPrefs,
  goal: PrimaryGoal,
): { warning: string | null; recommendedMinutesPerWeek: number; progression: string } {
  const slots = allCardioSlots(prefs);
  const weekly = slots.reduce((sum, slot) => sum + slot.durationMin, 0);
  const days = slots.length;
  const freeDays = ALL_DAYS.filter((day) => !slots.some((slot) => slot.weekday === day));
  const dayHint =
    freeDays.length > 0 ? `Idéal à ajouter : ${freeDays.slice(0, 2).map((day) => DAY_LABEL[day]).join(", ")}.` : "";
  const longest = slots.reduce((max, slot) => Math.max(max, slot.durationMin), 0);

  if (days === 0) {
    return {
      warning: "Coche au moins un jour (course ou vélo).",
      recommendedMinutesPerWeek: goal === "prise" ? 90 : 150,
      progression: "Pose 2 jours faciles, puis une sortie un peu plus longue.",
    };
  }

  if (goal === "perte") {
    if (days < 3 || weekly < 150) {
      const extraDays = Math.max(0, 3 - days);
      return {
        warning: `Pour une perte de poids et progresser, vise au moins 3 sorties et ~150 min / sem (là : ${days} j · ${weekly} min). ${
          extraDays > 0 ? `Ajoute ${extraDays} jour${extraDays > 1 ? "s" : ""}. ` : ""
        }${weekly < 150 ? `Allonge une sortie de ${Math.min(30, 150 - weekly)} min. ` : ""}${dayHint}`.trim(),
        recommendedMinutesPerWeek: Math.max(150, weekly),
        progression: "Tiens ce volume 2 semaines, puis +10 min sur la sortie la plus longue, même D+.",
      };
    }
    return {
      warning: null,
      recommendedMinutesPerWeek: weekly,
      progression: `Dans 2 semaines, passe la sortie la plus longue à ${longest + 10} min, sans augmenter le D+.`,
    };
  }

  if (goal === "prise") {
    if (weekly > 240) {
      return {
        warning: `En prise de masse, ${weekly} min de cardio, c’est beaucoup : vise 2–3 sorties faciles (30–60 min) pour garder de la récup muscu.`,
        recommendedMinutesPerWeek: 180,
        progression: "Garde le D+ modéré. La muscu reste prioritaire.",
      };
    }
    if (weekly < 60) {
      return {
        warning: "Un peu de Z2 (2 × 30–45 min) aide le cœur et la récup, sans freiner la masse.",
        recommendedMinutesPerWeek: 90,
        progression: "Ajoute une sortie facile en semaine, loin de la muscu jambes.",
      };
    }
    return {
      warning: null,
      recommendedMinutesPerWeek: weekly,
      progression: "Garde ce volume. N’allonge que de 5–10 min toutes les 3 semaines, en endurance facile.",
    };
  }

  if (days < 2 || weekly < 90) {
    return {
      warning: `Pour progresser en maintien, vise au moins 2 sorties (~90 min) dont une un peu plus longue (là : ${days} j · ${weekly} min). ${dayHint}`.trim(),
      recommendedMinutesPerWeek: 120,
      progression: "Tiens 2 semaines, puis allonge la sortie la plus longue de 10 min.",
    };
  }
  return {
    warning: null,
    recommendedMinutesPerWeek: weekly,
    progression: `Dans 2 semaines, +10 min sur la sortie la plus longue (${longest} → ${longest + 10} min).`,
  };
}

function sessionFromSlot(
  slot: CardioSlot,
  effort: SportEffort,
  profileId: string,
): SportSession {
  return {
    id: `crd-${slot.activity}-${profileId}-${slot.weekday}`,
    activity: slot.activity,
    effort,
    durationMin: slot.durationMin,
    elevationM: slot.elevationM,
    shared: false,
    weekdays: [slot.weekday],
    exercises: structureFor(slot.activity, slot.weekday, effort, slot.durationMin),
  };
}

export function localCardioProgram(
  prefs: CardioPrefs,
  goal: PrimaryGoal,
  profileId: string,
): CardioProposal {
  const advice = volumeAdvice(prefs, goal);
  const slots = allCardioSlots(prefs);
  const efforts = assignEfforts(slots, goal);
  return {
    warning: advice.warning,
    progression: advice.progression,
    recommendedMinutesPerWeek: advice.recommendedMinutesPerWeek,
    sessions: slots.map((slot) => sessionFromSlot(slot, efforts.get(slot.id) ?? "endurance", profileId)),
  };
}

function cardioPrompt(input: {
  name: string;
  goal: PrimaryGoal;
  weeklyRateKg: number;
  prefs: CardioPrefs;
}) {
  const slots = allCardioSlots(input.prefs);
  const lines = slots
    .map(
      (slot) =>
        `- ${DAY_LABEL[slot.weekday]} · ${slot.activity === "course" ? "Course" : "Vélo"} · ${slot.durationMin} min · D+ ${slot.elevationM} m`,
    )
    .join("\n");
  return `Tu es coach course / vélo. Objectif : ${goalLabel(input.goal)} (${input.weeklyRateKg} kg / sem). Profil : ${input.name}.
Le sportif donne UNIQUEMENT sa dispo : jour, sport (course ou vélo), durée, dénivelé. C'est TOI qui choisis le type de chaque sortie.

Disponibilité (à respecter STRICTEMENT : jour, sport, minutes, D+) :
${lines || "(aucune)"}

Pour CHAQUE ligne, choisis un effort : fractionne | sortie-longue | endurance | zone-2.
Règles :
- 1 seule sortie longue (souvent la plus longue et/ou le plus de D+).
- Au plus 1 fractionné, pas la veille ni le lendemain de la longue.
- Le reste en endurance ou Z2.
- perte : beaucoup de Z2 / endurance, 1 qualité max.
- prise : presque tout facile, 0 ou 1 fractionné court.
- maintien : 1 qualité + 1 longue + le reste facile.

Remplis échauffement / bloc (intervalles concrets si fractionné) / retour au calme. Ne change PAS le D+ ni la durée.
Si le volume est trop bas pour progresser, "warning" avec un jour + minutes concrets. Sinon null.
"progression" : toujours une phrase pour les 2 semaines suivantes.

JSON strict :
{
  "warning": "…" | null,
  "progression": "…",
  "sessions": [
    {
      "weekday": 1,
      "effort": "endurance",
      "exercises": [{ "name": "Allure endurance", "sets": 1, "target": "temps", "workSec": 300, "restSec": 0 }]
    }
  ]
}`;
}

export function parseCardioProposal(
  raw: unknown,
  prefs: CardioPrefs,
  goal: PrimaryGoal,
  profileId: string,
): CardioProposal {
  const fallback = localCardioProgram(prefs, goal, profileId);
  const rec = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const list = Array.isArray(rec.sessions) ? rec.sessions : [];
  const slots = allCardioSlots(prefs);
  const assigned = assignEfforts(slots, goal);
  const byDay = new Map<Weekday, Record<string, unknown>>();
  list.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const row = item as Record<string, unknown>;
    const weekday = Number(row.weekday) as Weekday;
    if (weekday >= 1 && weekday <= 7) byDay.set(weekday, row);
  });

  const sessions = slots.map((slot, index) => {
    const row = byDay.get(slot.weekday);
    const effort = row ? parseEffort(row.effort) : assigned.get(slot.id) ?? "endurance";
    const exercisesRaw = Array.isArray(row?.exercises) ? row.exercises : [];
    const exercises: SportExercise[] = exercisesRaw.slice(0, 6).map((ex, exIndex) => {
      const e = ex && typeof ex === "object" ? (ex as Record<string, unknown>) : {};
      return {
        id: `crd-ex-${profileId}-${slot.activity}-${slot.weekday}-${exIndex}`,
        name: String(e.name ?? "").trim() || `Bloc ${exIndex + 1}`,
        sets: Math.min(12, Math.max(1, Math.round(Number(e.sets) || 1))),
        target: "temps" as const,
        reps: 10,
        workSec: Math.min(300, Math.max(20, Math.round(Number(e.workSec) || 60))),
        restSec: Math.min(180, Math.max(0, Math.round(Number(e.restSec) || 0))),
      };
    });
    const local = fallback.sessions[index];
    return {
      id: `crd-${slot.activity}-${profileId}-${slot.weekday}`,
      activity: slot.activity,
      effort,
      durationMin: slot.durationMin,
      elevationM: slot.elevationM,
      shared: false,
      weekdays: [slot.weekday] as Weekday[],
      exercises: exercises.length ? exercises : local?.exercises ?? structureFor(slot.activity, slot.weekday, effort, slot.durationMin),
    };
  });

  const advice = volumeAdvice(prefs, goal);
  const warning =
    typeof rec.warning === "string" && rec.warning.trim() ? rec.warning.trim() : advice.warning;
  const progression =
    typeof rec.progression === "string" && rec.progression.trim()
      ? rec.progression.trim()
      : advice.progression;

  return {
    warning,
    progression,
    recommendedMinutesPerWeek: advice.recommendedMinutesPerWeek,
    sessions: sessions.length ? sessions : fallback.sessions,
  };
}

export async function proposeCardioProgram(input: {
  name: string;
  goal: PrimaryGoal;
  weeklyRateKg: number;
  prefs: CardioPrefs;
  profileId: string;
}): Promise<CardioProposal> {
  const fallback = localCardioProgram(input.prefs, input.goal, input.profileId);
  try {
    const raw = await generateGeminiFlash({
      parts: [{ text: cardioPrompt(input) }],
      temperature: 0.35,
    });
    return parseCardioProposal(parseGeminiJson(raw), input.prefs, input.goal, input.profileId);
  } catch {
    return fallback;
  }
}

export function applyCardioSessions(existing: SportSession[], proposed: SportSession[]): SportSession[] {
  const kept = existing.filter((session) => session.activity === "muscu");
  return [...kept, ...proposed];
}
