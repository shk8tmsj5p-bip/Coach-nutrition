import type { Json } from "@/lib/supabase/database.types";
import type {
  ProfileId,
  SportActivity,
  SportEffort,
  SportExercise,
  SportRoutine,
  SportSession,
  Weekday,
} from "@/lib/types";

export const WEEKDAYS: { id: Weekday; label: string }[] = [
  { id: 1, label: "Lun" },
  { id: 2, label: "Mar" },
  { id: 3, label: "Mer" },
  { id: 4, label: "Jeu" },
  { id: 5, label: "Ven" },
  { id: 6, label: "Sam" },
  { id: 7, label: "Dim" },
];

export const SPORT_ACTIVITIES: { id: SportActivity; label: string }[] = [
  { id: "course", label: "Course" },
  { id: "velo", label: "Vélo" },
  { id: "muscu", label: "Muscu" },
];

export const SPORT_EFFORTS: Record<SportActivity, { id: SportEffort; label: string }[]> = {
  course: [
    { id: "fractionne", label: "Fractionné" },
    { id: "sortie-longue", label: "Sortie longue" },
    { id: "endurance", label: "Endurance" },
    { id: "zone-2", label: "Récupération / Zone 2" },
  ],
  velo: [
    { id: "fractionne", label: "Fractionné" },
    { id: "sortie-longue", label: "Sortie longue" },
    { id: "endurance", label: "Endurance" },
    { id: "zone-2", label: "Récupération / Zone 2" },
  ],
  muscu: [
    { id: "circuit-hiit", label: "Circuit HIIT" },
    { id: "force", label: "Force" },
  ],
};

export const DEFAULT_SPORT_ROUTINE: SportRoutine = {
  runsPerWeek: 0,
  ridesPerWeek: 0,
  strengthDays: 0,
  targetMinutesPerWeek: 0,
  sessions: [],
};

export function activityLabel(activity: SportActivity) {
  return SPORT_ACTIVITIES.find((item) => item.id === activity)?.label ?? activity;
}

export function effortLabel(effort: SportEffort) {
  for (const options of Object.values(SPORT_EFFORTS)) {
    const match = options.find((item) => item.id === effort);
    if (match) return match.label;
  }
  return effort;
}

export function defaultEffort(activity: SportActivity): SportEffort {
  return SPORT_EFFORTS[activity][0].id;
}

export function effortAllowed(activity: SportActivity, effort: SportEffort) {
  return SPORT_EFFORTS[activity].some((item) => item.id === effort);
}

export function deriveRoutine(
  sessions: SportSession[],
  targetMinutesPerWeek?: number,
): SportRoutine {
  const planned = sessions.reduce((sum, session) => sum + session.durationMin, 0);
  return {
    sessions,
    runsPerWeek: sessions.filter((session) => session.activity === "course").length,
    ridesPerWeek: sessions.filter((session) => session.activity === "velo").length,
    strengthDays: sessions.filter((session) => session.activity === "muscu").length,
    targetMinutesPerWeek: targetMinutesPerWeek ?? planned,
  };
}

export function parseSportRoutine(value: unknown): SportRoutine {
  const rec = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const parsedSessions = Array.isArray(rec.sessions)
    ? rec.sessions
        .map((item, index) => parseSession(item, index))
        .filter((session): session is SportSession => session != null)
    : [];
  const runsPerWeek = clampCount(rec.runsPerWeek ?? rec.runs_per_week, 0);
  const ridesPerWeek = clampCount(rec.ridesPerWeek ?? rec.rides_per_week, 0);
  const strengthDays = clampCount(rec.strengthDays ?? rec.strength_days, 0);
  const targetMinutesPerWeek = clampCount(
    rec.targetMinutesPerWeek ?? rec.target_minutes_per_week,
    0,
    1200,
  );
  const sessions =
    parsedSessions.length > 0
      ? parsedSessions
      : synthesizeSessions({ runsPerWeek, ridesPerWeek, strengthDays, targetMinutesPerWeek });
  return deriveRoutine(sessions, targetMinutesPerWeek || undefined);
}

function parseSession(value: unknown, index: number): SportSession | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  const activity = parseActivity(rec.activity);
  const effortRaw = String(rec.effort ?? rec.effortType ?? "");
  const effort = effortAllowed(activity, effortRaw as SportEffort)
    ? (effortRaw as SportEffort)
    : defaultEffort(activity);
  return {
    id: String(rec.id ?? `session-${activity}-${index}`),
    activity,
    effort,
    durationMin: clampCount(rec.durationMin ?? rec.duration_min, 45, 480),
    elevationM: clampCount(rec.elevationM ?? rec.elevation_m ?? rec.dPlus, 0, 8000),
    exercises: Array.isArray(rec.exercises)
      ? rec.exercises.map((item, exerciseIndex) => parseExercise(item, exerciseIndex))
      : [],
    shared: Boolean(rec.shared ?? rec.duo),
    weekdays: parseWeekdays(rec.weekdays ?? rec.days),
  };
}

function parseExercise(value: unknown, index: number): SportExercise {
  const rec = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const target: SportExercise["target"] =
    rec.target === "temps" || rec.target === "time" || rec.target === "isometrie" ? "temps" : "reps";
  return {
    id: String(rec.id ?? `ex-${index}`),
    name: String(rec.name ?? "").trim(),
    sets: clampCount(rec.sets, 3, 12),
    target,
    reps: clampCount(rec.reps, 10, 50),
    workSec: clampCount(rec.workSec ?? rec.work_sec, 30, 300),
    restSec: clampCount(rec.restSec ?? rec.rest_sec, 30, 180),
  };
}

function parseWeekdays(value: unknown): Weekday[] {
  if (!Array.isArray(value)) return [];
  const unique = new Set<Weekday>();
  for (const entry of value) {
    const n = Number(entry);
    if (n >= 1 && n <= 7) unique.add(n as Weekday);
  }
  return [...unique].sort((a, b) => a - b);
}

function parseActivity(value: unknown): SportActivity {
  if (value === "course" || value === "run") return "course";
  if (value === "muscu" || value === "strength") return "muscu";
  return "velo";
}

function synthesizeSessions(counts: {
  runsPerWeek: number;
  ridesPerWeek: number;
  strengthDays: number;
  targetMinutesPerWeek: number;
}): SportSession[] {
  const slots: SportActivity[] = [
    ...Array.from({ length: counts.ridesPerWeek }, () => "velo" as const),
    ...Array.from({ length: counts.runsPerWeek }, () => "course" as const),
    ...Array.from({ length: counts.strengthDays }, () => "muscu" as const),
  ];
  if (slots.length === 0) return [];
  const total = counts.targetMinutesPerWeek || slots.length * 45;
  const durations = splitMinutes(total, slots.length);
  const cardioEfforts: SportEffort[] = ["sortie-longue", "fractionne", "endurance"];
  return slots.map((activity, index) => {
    const effort =
      activity === "muscu"
        ? "circuit-hiit"
        : cardioEfforts[index % cardioEfforts.length];
    const durationMin = durations[index];
    return {
      id: `synth-${activity}-${index}`,
      activity,
      effort,
      durationMin,
      elevationM:
        activity === "muscu" ? 0 : Math.round(durationMin * (activity === "velo" ? 8 : 2)),
      shared: false,
      weekdays: [((index % 7) + 1) as Weekday],
      exercises:
        activity === "muscu"
          ? [
              { id: `synth-ex-${index}-0`, name: "Squat", sets: 3, target: "reps", reps: 10, workSec: 30, restSec: 30 },
              { id: `synth-ex-${index}-1`, name: "Développé", sets: 3, target: "reps", reps: 8, workSec: 30, restSec: 30 },
            ]
          : [],
    };
  });
}

function splitMinutes(total: number, count: number) {
  const base = Math.max(15, Math.round(total / count / 5) * 5);
  const minutes = Array.from({ length: count }, () => base);
  minutes[0] = Math.max(15, total - base * (count - 1));
  return minutes;
}

function clampCount(value: unknown, fallback: number, max = 14) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(0, Math.round(n)));
}

export function sportRoutineToJson(routine: SportRoutine): Json {
  const derived = deriveRoutine(routine.sessions, routine.targetMinutesPerWeek);
  return {
    runsPerWeek: derived.runsPerWeek,
    ridesPerWeek: derived.ridesPerWeek,
    strengthDays: derived.strengthDays,
    targetMinutesPerWeek: derived.targetMinutesPerWeek,
    sessions: derived.sessions.map((session) => ({
      id: session.id,
      activity: session.activity,
      effort: session.effort,
      durationMin: session.durationMin,
      elevationM: session.elevationM,
      shared: Boolean(session.shared),
      weekdays: session.weekdays ?? [],
      exercises: session.exercises.map((exercise) => ({
        id: exercise.id,
        name: exercise.name,
        sets: exercise.sets,
        target: exercise.target,
        reps: exercise.reps,
        workSec: exercise.workSec,
        restSec: exercise.restSec,
      })),
    })),
  };
}

export function formatHoursMinutes(minutes: number) {
  if (minutes <= 0) return "0 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) return `${hours} h`;
  return `${hours}h${String(rest).padStart(2, "0")}`;
}

export function formatSportRoutine(routine: SportRoutine | null | undefined) {
  const value = parseSportRoutine(routine);
  const parts = [
    value.ridesPerWeek ? `${value.ridesPerWeek} vélo` : null,
    value.runsPerWeek ? `${value.runsPerWeek} course` : null,
    value.strengthDays ? `${value.strengthDays} muscu` : null,
  ].filter(Boolean);
  const volume = value.targetMinutesPerWeek
    ? `${formatHoursMinutes(value.targetMinutesPerWeek)} / sem`
    : null;
  if (parts.length === 0 && !volume) return "Routine non définie";
  return [parts.join(" · "), volume].filter(Boolean).join(" · ");
}

export function formatExercises(exercises: SportExercise[]) {
  const named = exercises.filter((exercise) => exercise.name.trim());
  if (named.length === 0) return null;
  return named.map(formatExerciseLine).join(" · ");
}

export function formatExerciseLine(exercise: SportExercise) {
  if (exercise.target === "temps") {
    const hold = `${exercise.sets} × ${exercise.workSec}s`;
    return exercise.restSec > 0
      ? `${exercise.name} ${hold} / ${exercise.restSec}s repos`
      : `${exercise.name} ${hold}`;
  }
  return `${exercise.name} ${exercise.sets}×${exercise.reps}`;
}

export function upsertSession(sessions: SportSession[], session: SportSession): SportSession[] {
  const exists = sessions.some((item) => item.id === session.id);
  return exists
    ? sessions.map((item) => (item.id === session.id ? session : item))
    : [...sessions, session];
}

export function removeSessionById(sessions: SportSession[], sessionId: string): SportSession[] {
  return sessions.filter((item) => item.id !== sessionId);
}

export function unshareById(sessions: SportSession[], sessionId: string): SportSession[] {
  return sessions.map((item) => (item.id === sessionId ? { ...item, shared: false } : item));
}

export function formatWeekdays(weekdays: Weekday[] | undefined) {
  if (!weekdays?.length) return null;
  const labels = WEEKDAYS.filter((day) => weekdays.includes(day.id)).map((day) => day.label);
  return labels.join(" · ");
}

export function sessionsForWeekday(sessions: SportSession[], weekday: Weekday) {
  return sessions.filter((session) => (session.weekdays ?? []).includes(weekday));
}

export function toggleWeekday(weekdays: Weekday[], day: Weekday): Weekday[] {
  const next = weekdays.includes(day)
    ? weekdays.filter((item) => item !== day)
    : [...weekdays, day];
  return next.sort((a, b) => a - b);
}

export function emptySession(activity: SportActivity = "velo"): SportSession {
  const effort = defaultEffort(activity);
  const durationMin = activity === "muscu" ? 40 : 60;
  return {
    id: `new-${crypto.randomUUID()}`,
    activity,
    effort,
    durationMin,
    elevationM: activity === "muscu" ? 0 : activity === "velo" ? 500 : 80,
    shared: false,
    weekdays: [],
    exercises: activity === "muscu" ? [emptyExercise()] : [],
  };
}

export function emptyExercise(): SportExercise {
  return {
    id: crypto.randomUUID(),
    name: "",
    sets: 3,
    target: "reps",
    reps: 10,
    workSec: 30,
    restSec: 30,
  };
}

function repsExercise(id: string, name: string, sets: number, reps: number): SportExercise {
  return { id, name, sets, target: "reps", reps, workSec: 30, restSec: 30 };
}

function timedExercise(
  id: string,
  name: string,
  sets: number,
  workSec: number,
  restSec: number,
): SportExercise {
  return { id, name, sets, target: "temps", reps: 10, workSec, restSec };
}

export function defaultRoutineFor(profileId: ProfileId): SportRoutine {
  if (profileId === "alexis") {
    return deriveRoutine([
      {
        id: "alexis-ride-longue",
        activity: "velo",
        effort: "sortie-longue",
        durationMin: 90,
        elevationM: 900,
        shared: false,
        weekdays: [7],
        exercises: [],
      },
      {
        id: "alexis-ride-fractionne",
        activity: "velo",
        effort: "fractionne",
        durationMin: 60,
        elevationM: 400,
        shared: false,
        weekdays: [2],
        exercises: [],
      },
      {
        id: "alexis-ride-endurance",
        activity: "velo",
        effort: "endurance",
        durationMin: 60,
        elevationM: 500,
        shared: false,
        weekdays: [5],
        exercises: [],
      },
      {
        id: "alexis-muscu",
        activity: "muscu",
        effort: "circuit-hiit",
        durationMin: 30,
        elevationM: 0,
        shared: false,
        weekdays: [4],
        exercises: [
          repsExercise("alexis-ex-1", "Squat gobelet", 3, 10),
          repsExercise("alexis-ex-2", "Tractions", 3, 6),
          timedExercise("alexis-ex-3", "Gainage", 3, 40, 20),
        ],
      },
    ]);
  }
  return deriveRoutine([
    {
      id: "elodie-run-longue",
      activity: "course",
      effort: "sortie-longue",
      durationMin: 50,
      elevationM: 180,
      shared: false,
      weekdays: [7],
      exercises: [],
    },
    {
      id: "elodie-run-fractionne",
      activity: "course",
      effort: "fractionne",
      durationMin: 35,
      elevationM: 40,
      shared: false,
      weekdays: [2],
      exercises: [],
    },
    {
      id: "elodie-run-endurance",
      activity: "course",
      effort: "endurance",
      durationMin: 30,
      elevationM: 60,
      shared: false,
      weekdays: [5],
      exercises: [],
    },
    {
      id: "elodie-muscu",
      activity: "muscu",
      effort: "circuit-hiit",
      durationMin: 35,
      elevationM: 0,
      shared: false,
      weekdays: [4],
      exercises: [
        repsExercise("elodie-ex-1", "Fentes", 3, 12),
        repsExercise("elodie-ex-2", "Rowing haltère", 3, 10),
        timedExercise("elodie-ex-3", "Planche", 3, 40, 20),
      ],
    },
  ]);
}
