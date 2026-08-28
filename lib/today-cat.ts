import { isStressedDaily, type DailyFeelScores } from "@/lib/daily-feel";
import { dayPeriod, isoWeekday, parisHour, todayISO } from "@/lib/dates";
import { isAccountedMeal, isFilledMeal, slotOfProfile } from "@/lib/meal-slot";
import { type Season, type WeatherKind } from "@/lib/season";
import { plannedMealForDay } from "@/lib/serve-week-plan";
import { parseSportRoutine, sessionsForWeekday } from "@/lib/sport-routine";
import { isSessionValidated, loadSessionValidations, matchWorkoutsToPlanned } from "@/lib/strava-match";
import type {
  DailyMovement,
  MealEntry,
  MealType,
  PlannedMeal,
  Profile,
  ProfileId,
  ViewMode,
  Workout,
} from "@/lib/types";

const SLOTS: MealType[] = ["petit-dejeuner", "dejeuner", "diner", "collation"];

export type CatSignal =
  | "stressed"
  | "duplicate"
  | "session-nudge"
  | "session-done"
  | "week-plat"
  | "next-meal"
  | "all-meals"
  | "weather"
  | "season"
  | "hello";

export type TodayCatSnapshot = {
  couple: boolean;
  name: string;
  otherName: string | null;
  period: "matin" | "midi" | "soir";
  season: Season;
  weather: WeatherKind;
  nextEmpty: MealType | null;
  weekPlatWaiting: boolean;
  duplicateWho: "alexis" | "elodie" | null;
  duplicateSlot: "dejeuner" | "diner" | null;
  stressed: boolean;
  allMeals: boolean;
  plannedSession: boolean;
  sessionDone: boolean;
  stepsBusy: boolean;
};

export function todaySessionFlags(profile: Profile, workouts: Workout[], date = todayISO()) {
  const planned = sessionsForWeekday(
    parseSportRoutine(profile.sportRoutine).sessions,
    isoWeekday(date),
  );
  if (planned.length === 0) return { planned: false, done: false };
  const vals = loadSessionValidations(profile.id, date);
  const hits = matchWorkoutsToPlanned(workouts, planned, date);
  const done = planned.some((session) => isSessionValidated(vals[session.id]) || hits.has(session.id));
  return { planned: true, done };
}

export function mealsAccountedToday(meals: MealEntry[], profileId: ProfileId) {
  return SLOTS.every((type) => isAccountedMeal(slotOfProfile(meals, profileId, type)));
}

function firstEmpty(meals: MealEntry[], profileId: ProfileId, period: TodayCatSnapshot["period"]) {
  const order: MealType[] =
    period === "matin"
      ? ["petit-dejeuner", "dejeuner", "diner", "collation"]
      : period === "midi"
        ? ["dejeuner", "petit-dejeuner", "collation", "diner"]
        : ["diner", "dejeuner", "collation", "petit-dejeuner"];
  return order.find((type) => !isAccountedMeal(slotOfProfile(meals, profileId, type))) ?? null;
}

function duplicateGap(meals: MealEntry[]): { who: ProfileId; slot: "dejeuner" | "diner" } | null {
  for (const slot of ["dejeuner", "diner"] as const) {
    const alexis = isFilledMeal(slotOfProfile(meals, "alexis", slot));
    const elodie = isFilledMeal(slotOfProfile(meals, "elodie", slot));
    if (alexis && !elodie) return { who: "elodie", slot };
    if (elodie && !alexis) return { who: "alexis", slot };
  }
  return null;
}

function pick<T>(seed: string, items: T[]) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return items[Math.abs(h) % items.length];
}

export function buildTodayCatSnapshot(opts: {
  view: ViewMode;
  profiles: Profile[];
  meals: MealEntry[];
  ratings: Record<ProfileId, DailyFeelScores>;
  workouts: Workout[];
  movement: Record<ProfileId, DailyMovement>;
  weekPlan: PlannedMeal[];
  season: Season;
  weather: WeatherKind;
  date?: string;
}): TodayCatSnapshot {
  const date = opts.date ?? todayISO();
  const period = dayPeriod(parisHour());
  const couple = opts.view === "couple";
  const focus = couple ? opts.profiles[0] : (opts.profiles[0] ?? null);
  const name = couple ? "Vous deux" : (focus?.name ?? "Toi");
  const otherName = couple ? null : opts.profiles[0]?.id === "alexis" ? "Élodie" : "Alexis";

  const ids = couple ? (["alexis", "elodie"] as ProfileId[]) : focus ? [focus.id] : [];
  const allMeals = ids.length > 0 && ids.every((id) => mealsAccountedToday(opts.meals, id));

  const nextEmpty = couple
    ? firstEmpty(opts.meals, "alexis", period) ?? firstEmpty(opts.meals, "elodie", period)
    : focus
      ? firstEmpty(opts.meals, focus.id, period)
      : null;

  const weekPlatWaiting = (["dejeuner", "diner"] as const).some((slot) => {
    if (!plannedMealForDay(opts.weekPlan, date, slot)) return false;
    if (couple) {
      return !isFilledMeal(slotOfProfile(opts.meals, "alexis", slot)) ||
        !isFilledMeal(slotOfProfile(opts.meals, "elodie", slot));
    }
    return focus ? !isFilledMeal(slotOfProfile(opts.meals, focus.id, slot)) : false;
  });

  const gap = duplicateGap(opts.meals);
  const stressed = ids.some((id) => {
    const feel = opts.ratings[id];
    if (!feel || (!feel.validated && feel.hunger == null && feel.energy == null && feel.fatigue == null)) {
      return false;
    }
    return isStressedDaily([{ ...feel, date, profileId: id }]);
  });

  const sessions = opts.profiles.map((profile) =>
    todaySessionFlags(
      profile,
      opts.workouts.filter((w) => w.profileId === profile.id),
      date,
    ),
  );
  const plannedSession = sessions.some((s) => s.planned);
  const sessionDone = plannedSession && sessions.filter((s) => s.planned).every((s) => s.done);

  const stepsBusy = ids.some((id) => (opts.movement[id]?.steps ?? 0) >= 8000);

  return {
    couple,
    name,
    otherName,
    period,
    season: opts.season,
    weather: opts.weather,
    nextEmpty,
    weekPlatWaiting,
    duplicateWho: gap?.who ?? null,
    duplicateSlot: gap?.slot ?? null,
    stressed,
    allMeals,
    plannedSession,
    sessionDone,
    stepsBusy,
  };
}

function mealCue(type: MealType, period: TodayCatSnapshot["period"]) {
  if (type === "petit-dejeuner") {
    return pick(period, [
      "Un petit-déj, et le chat est déjà content.",
      "On pose le matin d’abord. Doucement.",
      "Petit-déj quand tu veux — le reste suivra.",
    ]);
  }
  if (type === "dejeuner") {
    return pick(period, [
      "C’est l’heure du plat. Tu le poses quand tu es prêt.",
      "Le déjeuner t’attend, sans chrono.",
      "Un plat posé, et la journée se calme.",
    ]);
  }
  if (type === "diner") {
    return pick(period, [
      "Le dîner light t’attend. Sans pression.",
      "Soirée : on pose le dîner, et on se range.",
      "Encore le dîner, et la journée est ronde.",
    ]);
  }
  return pick(period, [
    "Une collation si tu as faim. Sinon, on saute.",
    "La collation n’est pas obligatoire. À toi de voir.",
    "Petit creux ? Une collation, et c’est bon.",
  ]);
}

export function pickTodayCatLine(snap: TodayCatSnapshot, date = todayISO()) {
  const seed = `${date}:${snap.period}:${snap.couple ? "c" : snap.name}`;

  if (snap.stressed) {
    return {
      signal: "stressed" as const,
      text: pick(seed + "st", [
        "On ne coupe rien aujourd’hui. Douceur d’abord.",
        "Fatigue notée. On garde le cap, sans forcer.",
        "Le chat se met en mode câlin. Rien d’exigeant.",
      ]),
    };
  }

  if (snap.duplicateWho && snap.duplicateSlot) {
    const who = snap.duplicateWho === "elodie" ? "Élodie" : "Alexis";
    const slot = snap.duplicateSlot === "dejeuner" ? "déjeuner" : "dîner";
    return {
      signal: "duplicate" as const,
      text: `${who} n’a pas encore le ${slot}. Tu lui copies le tien ?`,
    };
  }

  if (snap.plannedSession && !snap.sessionDone && snap.period === "soir") {
    return {
      signal: "session-nudge" as const,
      text: pick(seed + "sn", [
        "La séance est encore À faire. Même courte, ça compte.",
        "Un créneau sport t’attend. Le chat te file un coup d’épaule.",
        "Séance du jour : tu coches quand c’est fait. Pas de honte.",
      ]),
    };
  }

  if (snap.sessionDone && snap.allMeals) {
    return {
      signal: "session-done" as const,
      text: pick(seed + "sd", [
        "Repas rangés, séance cochée. Le chat ronronne.",
        "Journée pleine. Tu peux souffler.",
        "Tout est coché. Profite du reste de la soirée.",
      ]),
    };
  }

  if (snap.sessionDone) {
    return {
      signal: "session-done" as const,
      text: pick(seed + "sdo", [
        "Séance cochée. Le chat est fier.",
        "Sport du jour, c’est fait. Bien joué.",
        "La séance est dans la boîte.",
      ]),
    };
  }

  if (snap.weekPlatWaiting && (snap.nextEmpty === "dejeuner" || snap.nextEmpty === "diner")) {
    return {
      signal: "week-plat" as const,
      text: pick(seed + "wp", [
        "Le plat de la semaine est prêt. Un tap, et c’est dans la boîte.",
        "Le plat du jour t’attend dans Repas. Tu le sers quand tu veux.",
        "Semaine déjà cuisinée — il ne reste qu’à poser le plat.",
      ]),
    };
  }

  if (snap.allMeals) {
    return {
      signal: "all-meals" as const,
      text: pick(seed + "am", [
        "Les quatre repas sont là. Journée propre.",
        "Tout est rangé. Le chat s’étire.",
        "Journée posée. Tu peux passer à autre chose.",
      ]),
    };
  }

  if (snap.nextEmpty) {
    return { signal: "next-meal" as const, text: mealCue(snap.nextEmpty, snap.period) };
  }

  if (snap.weather === "heat") {
    return {
      signal: "weather" as const,
      text: pick(seed + "ht", [
        "Il fait chaud. On reste sur du frais, sans se prendre la tête.",
        "Canicule : hydratation, plat léger, et on ne force pas.",
        "Air lourd. Le chat cherche l’ombre — toi aussi.",
      ]),
    };
  }
  if (snap.weather === "rain") {
    return {
      signal: "weather" as const,
      text: pick(seed + "rn", [
        "Temps maussade. Un plat réconfort, et ça va.",
        "Il pleut. On se cale bien, sans se presser.",
        "Journée grise. Le chat reste au chaud avec toi.",
      ]),
    };
  }
  if (snap.weather === "snow") {
    return {
      signal: "weather" as const,
      text: pick(seed + "sw", [
        "Neige dehors. Dîner doux, et on se pose.",
        "Froid vif. On se nourrit bien, sans se prendre la tête.",
      ]),
    };
  }

  if (snap.stepsBusy && snap.period !== "matin") {
    return {
      signal: "hello" as const,
      text: pick(seed + "stps", [
        "Les jambes ont déjà travaillé. Le repas peut rester simple.",
        "Belle activité déjà. On mange selon l’appétit, pas le plan.",
      ]),
    };
  }

  const seasonal: Record<Season, string[]> = {
    spring: [
      "Ça sent le printemps. Légèreté bienvenue.",
      "Air plus doux. On avance sans se brusquer.",
    ],
    summer: [
      "Journée d’été. On garde ça simple et vivant.",
      "Chaleur de saison. Hydrate-toi, le chat aussi.",
    ],
    autumn: [
      "Air d’automne. On se cale bien.",
      "Feuilles dehors. Un plat qui réchauffe, et ça va.",
    ],
    winter: [
      "Soir d’hiver. Dîner doux, et on se pose.",
      "Froid dehors. On prend soin du foyer.",
    ],
  };

  if (snap.period === "matin") {
    return {
      signal: "hello" as const,
      text: pick(seed + "m", [
        "Le chat s’étire. On commence doucement.",
        "Belle matinée pour poser la journée.",
        "On y va, sans se précipiter.",
        ...seasonal[snap.season],
      ]),
    };
  }

  return {
    signal: "season" as const,
    text: pick(seed + "def", [
      ...seasonal[snap.season],
      "Le chat est là. Tu poses ce que tu peux.",
      "Une chose après l’autre. Ça suffit.",
    ]),
  };
}
