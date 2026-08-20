import { isStressedDaily, type DailyFeelScores } from "@/lib/daily-feel";
import { templateForSlot } from "@/lib/meal-templates";
import { macrosFromPlanned, plannedMealForDay } from "@/lib/serve-week-plan";
import { loadSessionValidations } from "@/lib/strava-match";
import { parseSportRoutine, sessionsForWeekday } from "@/lib/sport-routine";
import type {
  MealEntry,
  MealType,
  PlannedMeal,
  Profile,
  SlotTemplateKind,
  Workout,
} from "@/lib/types";
import { isoWeekday, todayISO } from "@/lib/dates";

export type TodayCoachRemark = {
  title: string;
  message: string;
  tone: "ok" | "warn" | "go";
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
}) {
  const meal = slotOf(opts.meals, opts.type);
  if (meal && !meal.isSkipped) return 0;
  if (meal?.isSkipped) return 0;

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
) {
  return SLOTS.reduce(
    (sum, type) => sum + remainingSlotKcal({ meals, type, profile, weekPlan, date }),
    0,
  );
}

function isHardEffort(effort: string) {
  return effort === "fractionne" || effort === "circuit-hiit";
}

export function todayCoachRemark(opts: {
  validated: boolean;
  profile: Profile;
  meals: MealEntry[];
  weekPlan: PlannedMeal[];
  workouts: Workout[];
  steps: number;
  feels: DailyFeelScores;
  date?: string;
}): TodayCoachRemark | null {
  if (!opts.validated) return null;

  const date = opts.date ?? todayISO();
  const goal = opts.profile.primaryGoal;
  const target = opts.profile.targets.calories;
  const eaten = opts.meals
    .filter((meal) => !meal.isSkipped)
    .reduce((sum, meal) => sum + meal.macros.calories, 0);
  const remaining = remainingPlannedKcal(opts.meals, opts.profile, opts.weekPlan, date);
  const projected = eaten + remaining;
  const sportKcal = opts.workouts.reduce((sum, workout) => sum + workout.calories, 0);
  const doneMin = opts.workouts.reduce((sum, workout) => sum + workout.durationMin, 0);
  const planned = sessionsForWeekday(
    parseSportRoutine(opts.profile.sportRoutine).sessions,
    isoWeekday(date),
  );
  const validations = loadSessionValidations(opts.profile.id, date);
  const pending = planned.filter((session) => !validations[session.id]);
  const plannedMin = planned.reduce((sum, session) => sum + session.durationMin, 0);
  const pendingMin = pending.reduce((sum, session) => sum + session.durationMin, 0);
  const pendingHard = pending.some((session) => isHardEffort(session.effort));
  const extraSport =
    (plannedMin === 0 && (sportKcal >= 180 || doneMin >= 35)) ||
    (plannedMin > 0 && doneMin >= plannedMin + 25);
  const underFuel = projected < target * 0.92;
  const overFuel = projected > target * 1.08;
  const stressed = isStressedDaily([
    { ...opts.feels, date, profileId: opts.profile.id },
  ]);
  const sportLine =
    sportKcal > 0
      ? `${kcal(sportKcal)} kcal sport`
      : doneMin > 0
        ? `${doneMin} min d’activité`
        : "pas encore de séance loggée";
  const plateLine = `${kcal(eaten)} mangées` + (remaining > 0 ? ` · encore ~${kcal(remaining)} prévues` : "");
  const feelBits: string[] = [];
  if (opts.feels.hunger != null) feelBits.push(`faim ${opts.feels.hunger}/5`);
  if (opts.feels.energy != null) feelBits.push(`énergie ${opts.feels.energy}/5`);
  if (opts.feels.fatigue != null) feelBits.push(`fatigue ${opts.feels.fatigue}/5`);
  const feelLine = feelBits.join(" · ");

  if (stressed) {
    return {
      title: "Récup d’abord",
      message: `${feelLine}. ${plateLine}. ${sportLine}. On ne coupe pas aujourd’hui — tiens l’assiette et allège si le fractionné est encore prévu.`,
      tone: "warn",
    };
  }

  if (extraSport && underFuel) {
    return {
      title: "Plus de sport que d’assiette",
      message: `${sportLine}, et la journée vise encore ~${kcal(projected)} kcal (cible ${kcal(target)}). Recharge un peu au prochain repas — féculent, pas de coupe.`,
      tone: "go",
    };
  }

  if (extraSport && goal !== "prise") {
    return {
      title: "Sortie bonus",
      message: `${sportLine} alors que ${plannedMin === 0 ? "rien n’était prévu" : `le plan visait ${plannedMin} min`}. ${plateLine}. Si les jambes le sentent, un peu plus de glucides au prochain repas.`,
      tone: "go",
    };
  }

  if (pending.length > 0 && goal === "perte" && eaten > target * 1.05) {
    return {
      title: "Séance encore prévue",
      message: `${kcal(eaten)} déjà mangées (cible ${kcal(target)}). Il reste ${pendingMin} min prévues — c’est elles qui rattrapent, pas une coupe. ${feelLine}.`,
      tone: "warn",
    };
  }

  if (pending.length > 0 && goal === "prise" && eaten < target * 0.9) {
    return {
      title: "Mange d’abord",
      message: `${kcal(eaten)} / ${kcal(target)} kcal. La séance (${pendingMin} min) peut attendre : l’assiette est le sujet aujourd’hui. ${feelLine}.`,
      tone: "warn",
    };
  }

  if (pendingHard && pending.length > 0) {
    return {
      title: "Fractionné encore prévu",
      message: `${plateLine}. ${sportLine}. Si l’énergie tient (${feelLine}), tu peux y aller. Sinon, passe en Zone 2.`,
      tone: "go",
    };
  }

  if (pending.length > 0) {
    return {
      title: "Séance du jour",
      message: `Encore ${pendingMin} min prévues. ${plateLine}. ${sportLine}. ${feelLine}. Rien d’urgent : le plan tient.`,
      tone: "ok",
    };
  }

  if (overFuel && goal === "perte") {
    return {
      title: "Au-dessus de la cible",
      message: `~${kcal(projected)} kcal visées (cible ${kcal(target)}). ${sportLine}. Pas de punition : le prochain repas plus léger suffit. ${feelLine}.`,
      tone: "warn",
    };
  }

  if (underFuel && goal === "prise") {
    return {
      title: "Sous la cible",
      message: `${plateLine} pour ${kcal(target)} kcal. ${sportLine}. Ajoute au prochain repas, surtout des protéines. ${feelLine}.`,
      tone: "warn",
    };
  }

  const onTrack = Math.abs(projected - target) / Math.max(target, 1) <= 0.08;
  if (onTrack) {
    return {
      title: "Dans le plan",
      message: `${plateLine} (cible ${kcal(target)}). ${sportLine}${opts.steps > 0 ? ` · ${opts.steps.toLocaleString("fr-FR")} pas` : ""}. ${feelLine}. T’es aligné, continue comme ça.`,
      tone: "ok",
    };
  }

  return {
    title: "Regard du jour",
    message: `${plateLine} (cible ${kcal(target)}). ${sportLine}. ${feelLine}.`,
    tone: "ok",
  };
}
