import type { DailyFeelScores } from "@/lib/daily-feel";
import type { CatFeelMood } from "@/lib/cat-feel";
import { dayPeriod, isoWeekday, parisHour, todayISO } from "@/lib/dates";
import { burnedKcalFromHealth } from "@/lib/health-energy";
import { templateForSlot } from "@/lib/meal-templates";
import { macrosFromPlanned, plannedMealForDay } from "@/lib/serve-week-plan";
import { isSessionValidated, loadSessionValidations, matchWorkoutsToPlanned } from "@/lib/strava-match";
import { activityLabel, effortLabel, parseSportRoutine, sessionsForWeekday } from "@/lib/sport-routine";
import { loggedForPlanned, loadLoggedToday } from "@/lib/today-sport";
import type {
  DailyMovement,
  MealEntry,
  MealType,
  PlannedMeal,
  Profile,
  SlotTemplateKind,
  Workout,
} from "@/lib/types";
import { mealTypeLabel } from "@/lib/utils";

export type TodayCoachRemark = {
  title: string;
  message: string;
  tone: "ok" | "warn" | "go";
};

export type CoachTodayAction = {
  label: string;
  detail: string;
};

export type CoachTodaySnapshot = {
  name: string;
  diet: Profile["diet"];
  goal: Profile["primaryGoal"];
  hour: number;
  period: "matin" | "midi" | "soir";
  hunger: CatFeelMood;
  energy: CatFeelMood;
  fatigue: CatFeelMood;
  eaten: number;
  remaining: number;
  target: number;
  burned: number;
  live: boolean;
  steps: number;
  activeKcal: number;
  sportKcal: number;
  doneMin: number;
  plannedMin: number;
  pendingMin: number;
  pendingLabel: string;
  extraSport: boolean;
  nextSlot: MealType | null;
  meals: Array<{ type: MealType; name: string; skipped: boolean; kcal: number }>;
  workouts: Array<{ name: string; durationMin: number; kcal: number }>;
};

const SLOTS: MealType[] = ["petit-dejeuner", "dejeuner", "diner", "collation"];

function kcal(n: number) {
  return Math.round(n).toLocaleString("fr-FR");
}

function slotOf(meals: MealEntry[], type: MealType) {
  const rows = meals.filter((meal) => meal.type === type);
  if (rows.length === 0) return null;
  return [...rows].sort((a, b) => {
    if (Boolean(a.isSkipped) !== Boolean(b.isSkipped)) return a.isSkipped ? 1 : -1;
    return b.macros.calories - a.macros.calories;
  })[0];
}

function remainingSlotKcal(opts: {
  meals: MealEntry[];
  type: MealType;
  profile: Profile;
  weekPlan: PlannedMeal[];
  date: string;
  hour: number;
}) {
  const meal = slotOf(opts.meals, opts.type);
  if (meal?.isSkipped) return 0;
  if (meal && !meal.isSkipped) return 0;
  if (opts.hour >= 11 && opts.type === "petit-dejeuner") return 0;
  if (opts.hour >= 16 && opts.type === "dejeuner") return 0;

  const weekday = isoWeekday(opts.date);
  const templates = opts.profile.mealTemplates ?? [];
  if (opts.type === "petit-dejeuner" || opts.type === "collation") {
    return templateForSlot(templates, opts.type, weekday)?.macros.calories ?? 0;
  }

  const planned = plannedMealForDay(opts.weekPlan, opts.date, opts.type);
  const plat = planned ? macrosFromPlanned(planned, opts.profile.id).calories : 0;
  const dessertSlot: SlotTemplateKind = opts.type === "dejeuner" ? "dessert-midi" : "dessert-soir";
  const dessert = templateForSlot(templates, dessertSlot, weekday);
  return plat + (dessert?.macros.calories ?? 0);
}

export function remainingPlannedKcal(
  meals: MealEntry[],
  profile: Profile,
  weekPlan: PlannedMeal[],
  date = todayISO(),
  hour = parisHour(),
) {
  return SLOTS.reduce(
    (sum, type) => sum + remainingSlotKcal({ meals, type, profile, weekPlan, date, hour }),
    0,
  );
}

function isHardEffort(effort: string) {
  return effort === "fractionne" || effort === "circuit-hiit";
}

function nextOpenSlot(meals: MealEntry[], hour: number): MealType | null {
  const order: MealType[] =
    hour < 11
      ? ["petit-dejeuner", "dejeuner", "collation", "diner"]
      : hour < 16
        ? ["dejeuner", "collation", "diner"]
        : ["collation", "diner"];
  for (const type of order) {
    const meal = slotOf(meals, type);
    if (meal?.isSkipped) continue;
    if (meal && !meal.isSkipped) continue;
    return type;
  }
  return null;
}

function feelOf(feels: DailyFeelScores) {
  const hunger = feels.hunger ?? "bof";
  const energy = feels.energy ?? "bof";
  const fatigue = feels.fatigue ?? "bof";
  return {
    hunger,
    energy,
    fatigue,
    hungry: hunger === "creve",
    lowEnergy: energy === "creve",
    tired: fatigue === "creve",
    fresh: energy === "ok" && fatigue === "ok" && hunger !== "creve",
  };
}

export function buildTodayCoachSnapshot(opts: {
  profile: Profile;
  meals: MealEntry[];
  weekPlan: PlannedMeal[];
  workouts: Workout[];
  movement: DailyMovement;
  feels: DailyFeelScores;
  date?: string;
  hour?: number;
}): CoachTodaySnapshot {
  const date = opts.date ?? todayISO();
  const hour = opts.hour ?? parisHour();
  const eaten = opts.meals
    .filter((meal) => !meal.isSkipped)
    .reduce((sum, meal) => sum + meal.macros.calories, 0);
  const remaining = remainingPlannedKcal(opts.meals, opts.profile, opts.weekPlan, date, hour);
  const health = burnedKcalFromHealth(opts.movement, {
    bmr: opts.profile.bmr,
    tdee: opts.profile.tdee,
  });
  const sportKcal = opts.workouts.reduce((sum, workout) => sum + workout.calories, 0);
  const doneMin = opts.workouts.reduce((sum, workout) => sum + workout.durationMin, 0);
  const planned = sessionsForWeekday(
    parseSportRoutine(opts.profile.sportRoutine).sessions,
    isoWeekday(date),
  );
  const validations = loadSessionValidations(opts.profile.id, date);
  const logs = loadLoggedToday(opts.profile.id, date);
  const healthHits = matchWorkoutsToPlanned(opts.workouts, planned, date);
  const pending = planned.filter(
    (session) =>
      !loggedForPlanned(logs, session.id) &&
      !isSessionValidated(validations[session.id]) &&
      !healthHits.has(session.id),
  );
  const feel = feelOf(opts.feels);
  return {
    name: opts.profile.name,
    diet: opts.profile.diet,
    goal: opts.profile.primaryGoal,
    hour,
    period: dayPeriod(hour),
    hunger: feel.hunger,
    energy: feel.energy,
    fatigue: feel.fatigue,
    eaten,
    remaining,
    target: opts.profile.targets.calories,
    burned: health.burned,
    live: health.live,
    steps: opts.movement.steps,
    activeKcal: opts.movement.activeEnergyKcal,
    sportKcal,
    doneMin,
    plannedMin: planned.reduce((sum, session) => sum + session.durationMin, 0),
    pendingMin: pending.reduce((sum, session) => sum + session.durationMin, 0),
    pendingLabel: pending
      .map((session) => `${activityLabel(session.activity)} ${effortLabel(session.effort)}`)
      .join(", "),
    extraSport:
      (planned.length === 0 && (sportKcal >= 180 || doneMin >= 35)) ||
      (planned.length > 0 && doneMin >= planned.reduce((sum, session) => sum + session.durationMin, 0) + 25),
    nextSlot: nextOpenSlot(opts.meals, hour),
    meals: SLOTS.map((type) => {
      const meal = slotOf(opts.meals, type);
      return {
        type,
        name: meal?.name || mealTypeLabel(type),
        skipped: Boolean(meal?.isSkipped),
        kcal: meal && !meal.isSkipped ? meal.macros.calories : 0,
      };
    }),
    workouts: opts.workouts.map((workout) => ({
      name: workout.name,
      durationMin: workout.durationMin,
      kcal: workout.calories,
    })),
  };
}

function nextMealLine(snapshot: CoachTodaySnapshot) {
  if (!snapshot.nextSlot) return "Plus de repas prévu d’ici ce soir (les créneaux sautés restent sautés).";
  return `Prochain levier : ${mealTypeLabel(snapshot.nextSlot)} (pas un repas sauté).`;
}

function plateLine(snapshot: CoachTodaySnapshot) {
  return `${kcal(snapshot.eaten)} mangées` + (snapshot.remaining > 0 ? ` · encore ~${kcal(snapshot.remaining)} devant toi` : "");
}

function burnLine(snapshot: CoachTodaySnapshot) {
  if (!snapshot.live) return `cible ${kcal(snapshot.target)} kcal`;
  return `dépense ~${kcal(snapshot.burned)} (Santé) · cible ${kcal(snapshot.target)}`;
}

function sportLine(snapshot: CoachTodaySnapshot) {
  if (snapshot.sportKcal > 0) return `${kcal(snapshot.sportKcal)} kcal séance · ${snapshot.doneMin} min`;
  if (snapshot.doneMin > 0) return `${snapshot.doneMin} min d’activité`;
  if (snapshot.pendingMin > 0) return `encore ${snapshot.pendingMin} min prévues (${snapshot.pendingLabel})`;
  return "pas de séance loggée";
}

export function todayCoachRemark(opts: {
  validated: boolean;
  profile: Profile;
  meals: MealEntry[];
  weekPlan: PlannedMeal[];
  workouts: Workout[];
  movement: DailyMovement;
  feels: DailyFeelScores;
  date?: string;
}): TodayCoachRemark | null {
  if (!opts.validated) return null;

  const snapshot = buildTodayCoachSnapshot(opts);
  const feel = feelOf(opts.feels);
  const stressed = feel.hungry || feel.tired || feel.lowEnergy;
  const gap = snapshot.burned - snapshot.eaten;
  const underFuel = snapshot.eaten + snapshot.remaining < snapshot.target * 0.92;
  const overFuel = snapshot.eaten + snapshot.remaining > snapshot.target * 1.08;
  const pendingHard =
    snapshot.pendingMin > 0 &&
    /fractionné|hiit/i.test(snapshot.pendingLabel);

  if (feel.hungry && (feel.tired || feel.lowEnergy)) {
    return {
      title: "Faim et fatigue — on protège",
      message: `${nextMealLine(snapshot)} On ne coupe pas. Si ${snapshot.pendingLabel || "une séance"} est encore prévue, passe en Zone 2 ou raccourcis.`,
      tone: "warn",
    };
  }

  if (feel.hungry) {
    const evening = snapshot.period === "soir" && !snapshot.nextSlot;
    return {
      title: "Faim haute",
      message: evening
        ? "Le plan du jour est clos : ajoute volume (légumes, protéines) sur ce qui reste dans l’assiette, pas une coupe."
        : `${nextMealLine(snapshot)} Avance-le un peu, volume et protéines — pas de déficit aujourd’hui.`,
      tone: "warn",
    };
  }

  if (feel.lowEnergy) {
    return {
      title: "Motivation basse",
      message: `${
        gap > 200
          ? "Tu as plus dépensé que mangé : un féculent au prochain repas ouvert, pas un jeûne."
          : nextMealLine(snapshot)
      } ${
        pendingHard
          ? "Le fractionné / HIIT attend : Zone 2 ou on décale."
          : snapshot.pendingMin > 0
            ? "Séance OK si tu la gardes facile."
            : "Priorité récup, pas d’intensité bonus."
      }`,
      tone: "warn",
    };
  }

  if (feel.tired) {
    return {
      title: "Fatigue haute",
      message: `On ne coupe pas les kcal. ${
        snapshot.pendingMin > 0
          ? `Allège ${snapshot.pendingLabel || "la séance"} (−10 min ou Zone 2).`
          : "Rien à forcer côté sport."
      } ${nextMealLine(snapshot)}`,
      tone: "warn",
    };
  }

  if (feel.fresh && pendingHard) {
    return {
      title: "Fraîcheur — séance exigeante OK",
      message: `Tu as la marge pour ${snapshot.pendingLabel} (${snapshot.pendingMin} min). ${
        underFuel ? "Garde un peu de glucides avant / après." : nextMealLine(snapshot)
      }`,
      tone: "go",
    };
  }

  if (snapshot.extraSport && (underFuel || (snapshot.live && gap > 250))) {
    return {
      title: "Plus de sport que d’assiette",
      message: `Recharge au ${
        snapshot.nextSlot ? mealTypeLabel(snapshot.nextSlot) : "prochain repas ouvert"
      } — féculent, pas de coupe.`,
      tone: "go",
    };
  }

  if (snapshot.extraSport && snapshot.goal !== "prise" && !feel.hungry) {
    return {
      title: "Sortie bonus",
      message:
        "Si les jambes le sentent, un peu plus de glucides au repas encore ouvert.",
      tone: "go",
    };
  }

  if (snapshot.pendingMin > 0 && snapshot.goal === "perte" && snapshot.eaten > snapshot.target * 1.05 && !stressed) {
    return {
      title: "Séance encore prévue",
      message: `Il reste ${snapshot.pendingMin} min (${snapshot.pendingLabel}) — c’est elles qui rattrapent, pas une coupe. ${nextMealLine(snapshot)}`,
      tone: "warn",
    };
  }

  if (snapshot.pendingMin > 0 && snapshot.goal === "prise" && snapshot.eaten < snapshot.target * 0.9) {
    return {
      title: "Mange d’abord",
      message: `La séance (${snapshot.pendingMin} min) peut attendre : l’assiette est le sujet. ${nextMealLine(snapshot)}`,
      tone: "warn",
    };
  }

  if (snapshot.pendingMin > 0) {
    return {
      title: snapshot.period === "soir" ? "Séance encore là ce soir" : "Séance du jour",
      message: `Encore ${snapshot.pendingMin} min · ${snapshot.pendingLabel || "prévu"}. ${nextMealLine(snapshot)}`,
      tone: "ok",
    };
  }

  if (snapshot.live && gap < -250 && snapshot.goal === "perte" && feel.hunger === "ok" && feel.fatigue !== "creve") {
    return {
      title: "Dépense couverte, faim calme",
      message: snapshot.nextSlot
        ? `${mealTypeLabel(snapshot.nextSlot)} peut rester léger.`
        : "Rien à rattraper par une coupe punitive.",
      tone: "ok",
    };
  }

  if (overFuel && snapshot.goal === "perte" && !stressed) {
    return {
      title: "Au-dessus de la cible",
      message: `Pas de punition : ${
        snapshot.nextSlot ? `${mealTypeLabel(snapshot.nextSlot)} plus léger suffit` : "on arrête d’ajouter"
      }.`,
      tone: "warn",
    };
  }

  if (underFuel && snapshot.goal === "prise") {
    return {
      title: "Sous la cible",
      message: `Ajoute au ${
        snapshot.nextSlot ? mealTypeLabel(snapshot.nextSlot) : "prochain repas ouvert"
      }, surtout des protéines.`,
      tone: "warn",
    };
  }

  const onTrack =
    Math.abs(snapshot.eaten + snapshot.remaining - snapshot.target) / Math.max(snapshot.target, 1) <= 0.08;
  if (onTrack || (snapshot.live && Math.abs(gap) <= Math.max(120, snapshot.burned * 0.08))) {
    return {
      title: "Dans le plan",
      message: snapshot.nextSlot
        ? `${nextMealLine(snapshot)} Rien à forcer.`
        : "T’es aligné. Rien à forcer.",
      tone: "ok",
    };
  }

  return {
    title: snapshot.period === "soir" ? "Regard du soir" : "Regard du jour",
    message: nextMealLine(snapshot),
    tone: "ok",
  };
}

export function localCoachTodayActions(snapshot: CoachTodaySnapshot): CoachTodayAction[] {
  const actions: CoachTodayAction[] = [];
  if (snapshot.hunger === "creve") {
    actions.push({
      label: snapshot.nextSlot ? `Avancer ${mealTypeLabel(snapshot.nextSlot)}` : "Volume maintenant",
      detail: "Faim crevée : pas de coupe. Protéines + volume. Un repas sauté reste sauté.",
    });
  }
  if (snapshot.energy === "creve" || snapshot.fatigue === "creve") {
    actions.push({
      label: snapshot.pendingMin > 0 ? "Alléger la séance" : "Récup, pas d’intensité",
      detail: snapshot.pendingLabel
        ? `${snapshot.pendingLabel} → Zone 2 ou −10 min.`
        : "Motivation basse / fatigue haute : on ne force pas.",
    });
  }
  if (snapshot.live && snapshot.burned - snapshot.eaten > 250 && snapshot.hunger !== "ok") {
    actions.push({
      label: "Recharger l’assiette",
      detail: `${kcal(snapshot.eaten)} mangées vs ~${kcal(snapshot.burned)} dépensées. Féculent sur le prochain créneau ouvert.`,
    });
  }
  if (snapshot.nextSlot && actions.length < 3) {
    actions.push({
      label: `Levier : ${mealTypeLabel(snapshot.nextSlot)}`,
      detail: `${kcal(snapshot.eaten)} mangées · encore ~${kcal(snapshot.remaining)} sur les créneaux ouverts.`,
    });
  }
  if (actions.length === 0) {
    actions.push({
      label: "Tenir le plan",
      detail: `${kcal(snapshot.eaten)} mangées · ${burnLine(snapshot)}. ${sportLine(snapshot)}.`,
    });
  }
  return actions.slice(0, 3);
}
