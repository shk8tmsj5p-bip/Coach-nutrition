import { formatWeeklyRate, goalLabel } from "@/lib/goals";
import { SLOT_KCAL_SHARE } from "@/lib/macro-status";
import {
  classifyIngredient,
  declinationFromIngredients,
  estimateIngredientMacros,
  type IngredientKind,
} from "@/lib/recipe-macros";
import type {
  DietType,
  Macros,
  MealType,
  PlannedMeal,
  PrimaryGoal,
  Profile,
  ProfileId,
  RecipeIngredient,
  SlotTemplate,
} from "@/lib/types";

export type PersonMealCoach = {
  id: ProfileId;
  name: string;
  diet: DietType;
  goal: PrimaryGoal;
  weeklyRateKg: number;
  daily: Macros;
  lunch: Macros;
  dinner: Macros;
  dessertLunchKcal: number;
  dessertDinnerKcal: number;
};

export type MealCoachHousehold = {
  alexis: PersonMealCoach;
  elodie: PersonMealCoach;
};

const ZERO: Macros = { calories: 0, protein: 0, carbs: 0, fat: 0 };

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function roundGrams(n: number, kind: IngredientKind) {
  if (n <= 0) return 0;
  if (kind === "oil" || kind === "herb" || kind === "sauce") return Math.max(1, Math.round(n));
  return Math.max(5, Math.round(n / 5) * 5);
}

function shareMacros(daily: Macros, type: MealType): Macros {
  const share = SLOT_KCAL_SHARE[type];
  return {
    calories: Math.round(daily.calories * share),
    protein: Math.round(daily.protein * share),
    carbs: Math.round(daily.carbs * share),
    fat: Math.round(daily.fat * share),
  };
}

function subMacros(base: Macros, dessert: Macros, floor: Macros): Macros {
  return {
    calories: Math.max(floor.calories, base.calories - dessert.calories),
    protein: Math.max(floor.protein, base.protein - dessert.protein),
    carbs: Math.max(floor.carbs, base.carbs - dessert.carbs),
    fat: Math.max(floor.fat, base.fat - dessert.fat),
  };
}

function avgTemplateMacros(templates: SlotTemplate[], slot: SlotTemplate["slot"]): Macros {
  const hits = templates.filter((item) => item.slot === slot);
  if (!hits.length) return ZERO;
  const n = hits.length;
  return {
    calories: Math.round(hits.reduce((sum, item) => sum + item.macros.calories, 0) / n),
    protein: Math.round(hits.reduce((sum, item) => sum + item.macros.protein, 0) / n),
    carbs: Math.round(hits.reduce((sum, item) => sum + item.macros.carbs, 0) / n),
    fat: Math.round(hits.reduce((sum, item) => sum + item.macros.fat, 0) / n),
  };
}

function personFromProfile(profile: Profile): PersonMealCoach {
  const dessertLunch = avgTemplateMacros(profile.mealTemplates, "dessert-midi");
  const dessertDinner = avgTemplateMacros(profile.mealTemplates, "dessert-soir");
  const lunchFloor: Macros = { calories: 420, protein: 28, carbs: 35, fat: 10 };
  const dinnerFloor: Macros = { calories: 280, protein: 24, carbs: 20, fat: 8 };
  return {
    id: profile.id,
    name: profile.name,
    diet: profile.diet,
    goal: profile.primaryGoal,
    weeklyRateKg: profile.weeklyRateKg,
    daily: profile.targets,
    lunch: subMacros(shareMacros(profile.targets, "dejeuner"), dessertLunch, lunchFloor),
    dinner: subMacros(shareMacros(profile.targets, "diner"), dessertDinner, dinnerFloor),
    dessertLunchKcal: dessertLunch.calories,
    dessertDinnerKcal: dessertDinner.calories,
  };
}

export function buildMealCoachFromProfiles(alexis: Profile, elodie: Profile): MealCoachHousehold {
  return {
    alexis: personFromProfile(alexis),
    elodie: personFromProfile(elodie),
  };
}

function asMacros(raw: unknown, fallback: Macros): Macros {
  if (!raw || typeof raw !== "object") return fallback;
  const rec = raw as Record<string, unknown>;
  const n = (key: string, alt?: string) => {
    const value = rec[key] ?? (alt ? rec[alt] : undefined);
    const num = typeof value === "number" ? value : Number(value);
    return Number.isFinite(num) ? Math.max(0, Math.round(num)) : fallback[key as keyof Macros];
  };
  return {
    calories: n("calories", "kcal"),
    protein: n("protein"),
    carbs: n("carbs"),
    fat: n("fat"),
  };
}

function asPerson(raw: unknown, fallbackId: ProfileId): PersonMealCoach | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const goal = rec.goal === "prise" || rec.goal === "maintien" || rec.goal === "perte" ? rec.goal : null;
  if (!goal) return null;
  const daily = asMacros(rec.daily, { calories: 1800, protein: 120, carbs: 180, fat: 55 });
  return {
    id: rec.id === "elodie" || rec.id === "alexis" ? rec.id : fallbackId,
    name: typeof rec.name === "string" ? rec.name : fallbackId === "alexis" ? "Alexis" : "Élodie",
    diet: rec.diet === "omnivore" ? "omnivore" : "vegan",
    goal,
    weeklyRateKg: Number(rec.weeklyRateKg) || 0,
    daily,
    lunch: asMacros(rec.lunch, shareMacros(daily, "dejeuner")),
    dinner: asMacros(rec.dinner, shareMacros(daily, "diner")),
    dessertLunchKcal: Number(rec.dessertLunchKcal) || 0,
    dessertDinnerKcal: Number(rec.dessertDinnerKcal) || 0,
  };
}

export function parseMealCoach(raw: unknown): MealCoachHousehold | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const alexis = asPerson(rec.alexis, "alexis");
  const elodie = asPerson(rec.elodie, "elodie");
  if (!alexis || !elodie) return null;
  return { alexis, elodie };
}

function slotFor(person: PersonMealCoach, mealType: PlannedMeal["mealType"]): Macros {
  return mealType === "diner" ? person.dinner : person.lunch;
}

function leversFor(person: PersonMealCoach) {
  if (person.goal === "prise") {
    return person.diet === "vegan"
      ? "densité : + tofu / edamame / riz / tahini (jamais cacahuète). Extra sauce = ligne Alexis seule."
      : "densité : + féculent + protéine, un filet d'huile extra OK le midi. Extra sauce = ligne profil seule.";
  }
  if (person.goal === "perte") {
    return "volume : + crudités / herbes / agrumes / soja / moutarde. Huile serrée. JAMAIS couper la protéine.";
  }
  return "portions calées sur les cibles, même plat.";
}

function personBlock(person: PersonMealCoach) {
  const diet = person.diet === "vegan" ? "vegan" : "omnivore";
  const dessert =
    person.dessertLunchKcal || person.dessertDinnerKcal
      ? ` Desserts templates déjà comptés à part (midi ${person.dessertLunchKcal || 0} kcal, soir ${person.dessertDinnerKcal || 0} kcal) — ne PAS les recuisiner dans la recette.`
      : "";
  return `${person.name} — ${diet} · ${goalLabel(person.goal)} (${formatWeeklyRate(person.weeklyRateKg)}) · ${person.daily.calories} kcal/j · P ${person.daily.protein}g · G ${person.daily.carbs}g · L ${person.daily.fat}g
  Midi (hors dessert) : ~${person.lunch.calories} kcal · ${person.lunch.protein}g P · ${person.lunch.carbs}g G · ${person.lunch.fat}g L
  Soir low cal (hors dessert) : ~${person.dinner.calories} kcal · ${person.dinner.protein}g P · ${person.dinner.carbs}g G · ${person.dinner.fat}g L
  Leviers : ${leversFor(person)}${dessert}`;
}

export function formatMealCoachForPrompt(coach: MealCoachHousehold) {
  return `COACH NUTRITION (source de vérité — portions par profil, MÊME plat)

${personBlock(coach.alexis)}

${personBlock(coach.elodie)}

RÈGLES PORTIONS
- UN seul plat pour les deux. Double déclinaison = protéine vegan / omni + GRAMMES différents. INTERDIT deux recettes, INTERDIT « bowl Alexis » vs « assiette Élodie ».
- shared_ingredients : grams_alexis ET grams_elodie OBLIGATOIRES sur féculents, huile, légumes, légumineuses. Herbes / épices / ail : grammes identiques OK.
- Perte = volume (légumes, herbes, agrume, soja, moutarde), densité calorique basse. Prise = densité (féculent + protéine + tahini / huile).
- Protéine plancher : ne JAMAIS réduire tofu / poulet / poisson / œufs / edamame pour « faire light ». Le dîner light coupe le riz et l'huile, pas la protéine.
- Dîner : light pour les deux, mais la prise garde sa protéine ; seule la perte coupe vraiment le féculent (≈ −45 %).
- Écart kcal > 250 : ajouter une ligne profil-only (riz cuit, tofu extra, 1 cs tahini) — jamais de beurre de cacahuète (aversion Élodie) ni fromage pour Alexis.
- Umami sans calories : soja, agrume, moutarde, herbes, gingembre, ail — surtout sur les dîners perte.
- N'inclus PAS de dessert, yaourt sucré, granola dessert (géré par les templates Paramètres).
- Satiété vegan prise : tofu + légumineuse + riz, pas un filet d'huile tout seul.
- Assemblage : même boîte / même ordre, justes portions différentes (ex. « riz : Alexis 180g · Élodie 100g »). Pas de discours diététique dans les étapes.
- Week-end : légèrement plus généreux, toujours split selon les cibles ci-dessus.`;
}

export function portionsDiffer(a: number, b: number, ratio = 0.12) {
  if (a <= 0 || b <= 0) return false;
  return Math.abs(a - b) / Math.max(a, b) >= ratio;
}

export function coupleGramsLabel(name: string, gramsA: number, gramsE: number, visual?: string) {
  const vis = visual?.trim();
  const head = vis ? `${name} : ${vis}` : `${name} :`;
  return `${head} Alexis ${Math.round(gramsA)}g · Élodie ${Math.round(gramsE)}g`;
}

function setGrams(item: RecipeIngredient, profile: ProfileId, grams: number): RecipeIngredient {
  if (profile === "alexis") return { ...item, gramsAlexis: grams };
  return { ...item, gramsElodie: grams };
}

function gramsOf(item: RecipeIngredient, profile: ProfileId) {
  return profile === "alexis" ? item.gramsAlexis : item.gramsElodie;
}

function oilCap(goal: PrimaryGoal, dinner: boolean) {
  if (goal === "perte") return dinner ? 8 : 12;
  if (goal === "prise") return dinner ? 12 : 18;
  return dinner ? 10 : 14;
}

function scaleSharedItem(
  item: RecipeIngredient,
  meal: PlannedMeal,
  coach: MealCoachHousehold,
): RecipeIngredient {
  const kind = classifyIngredient(item.name);
  if (kind === "herb") return item;

  const alreadySplit = portionsDiffer(item.gramsAlexis, item.gramsElodie);
  const aSlot = slotFor(coach.alexis, meal.mealType);
  const eSlot = slotFor(coach.elodie, meal.mealType);
  const refKcal = Math.max(1, (aSlot.calories + eSlot.calories) / 2);
  const dinner = meal.lowCalorie || meal.mealType === "diner";
  const base = (item.gramsAlexis + item.gramsElodie) / 2 || item.gramsAlexis || item.gramsElodie;

  let a = item.gramsAlexis;
  let e = item.gramsElodie;

  if (alreadySplit) {
    if (kind === "oil") {
      a = Math.min(a, oilCap(coach.alexis.goal, dinner));
      e = Math.min(e, oilCap(coach.elodie.goal, dinner));
      return { ...item, gramsAlexis: roundGrams(a, kind), gramsElodie: roundGrams(e, kind) };
    }
    return item;
  }

  if (kind === "starch") {
    const refCarbs = Math.max(1, (aSlot.carbs + eSlot.carbs) / 2);
    a = base * (aSlot.carbs / refCarbs);
    e = base * (eSlot.carbs / refCarbs);
    const dinnerCut = (goal: PrimaryGoal) =>
      goal === "perte" ? 0.55 : goal === "prise" ? 0.85 : 0.7;
    if (dinner) {
      a *= dinnerCut(coach.alexis.goal);
      e *= dinnerCut(coach.elodie.goal);
    }
  } else if (kind === "veg") {
    const vol = (goal: PrimaryGoal) => (goal === "perte" ? 1.25 : 1);
    a = base * vol(coach.alexis.goal) * clamp(aSlot.calories / refKcal, 0.9, 1.15);
    e = base * vol(coach.elodie.goal) * clamp(eSlot.calories / refKcal, 0.9, 1.15);
  } else if (kind === "oil") {
    a = Math.min(oilCap(coach.alexis.goal, dinner), base * (aSlot.calories / refKcal));
    e = Math.min(oilCap(coach.elodie.goal, dinner), base * (eSlot.calories / refKcal));
  } else if (kind === "legume" || kind === "protein") {
    const refP = Math.max(1, (aSlot.protein + eSlot.protein) / 2);
    a = base * (aSlot.protein / refP);
    e = base * (eSlot.protein / refP);
  } else {
    a = base * (aSlot.calories / refKcal);
    e = base * (eSlot.calories / refKcal);
  }

  return {
    ...item,
    gramsAlexis: roundGrams(a, kind),
    gramsElodie: roundGrams(e, kind),
  };
}

function scaleSoloProtein(item: RecipeIngredient, meal: PlannedMeal, coach: MealCoachHousehold) {
  const profile = item.role === "elodie" ? "elodie" : "alexis";
  const person = coach[profile];
  const grams = gramsOf(item, profile);
  if (grams <= 0) return item;
  const currentP = estimateIngredientMacros(item.name, grams).protein;
  if (currentP < 8) return item;
  const target = slotFor(person, meal.mealType).protein * 0.55;
  const factor = clamp(target / currentP, 0.8, 1.45);
  if (Math.abs(factor - 1) < 0.08) return item;
  return setGrams(item, profile, roundGrams(grams * factor, "protein"));
}

function scaleKinds(
  ingredients: RecipeIngredient[],
  profile: ProfileId,
  kinds: IngredientKind[],
  factor: number,
) {
  return ingredients.map((item) => {
    if (item.role !== "shared" && item.role !== profile) return item;
    const kind = classifyIngredient(item.name);
    if (!kinds.includes(kind)) return item;
    const grams = gramsOf(item, profile);
    if (grams <= 0) return item;
    return setGrams(item, profile, roundGrams(grams * factor, kind));
  });
}

function fitProfile(
  ingredients: RecipeIngredient[],
  profile: ProfileId,
  person: PersonMealCoach,
  mealType: PlannedMeal["mealType"],
) {
  const target = slotFor(person, mealType);
  const decl = declinationFromIngredients(ingredients, profile);
  const kcalRatio = decl.calories / Math.max(target.calories, 1);
  let next = ingredients;
  if (person.goal === "prise" && kcalRatio < 0.88) {
    next = scaleKinds(next, profile, ["starch", "oil", "legume"], clamp(target.calories / Math.max(decl.calories, 1), 1.05, 1.4));
  } else if (person.goal === "perte" && kcalRatio > 1.12) {
    next = scaleKinds(next, profile, ["starch", "oil"], clamp(target.calories / Math.max(decl.calories, 1), 0.55, 0.95));
  } else if (person.goal === "maintien" && (kcalRatio < 0.85 || kcalRatio > 1.15)) {
    next = scaleKinds(
      next,
      profile,
      ["starch", "oil"],
      clamp(target.calories / Math.max(decl.calories, 1), 0.7, 1.25),
    );
  }
  const proteinNow = declinationFromIngredients(next, profile).proteinG;
  if (proteinNow < target.protein * 0.75) {
    next = scaleKinds(
      next,
      profile,
      ["protein", "legume"],
      clamp((target.protein * 0.9) / Math.max(proteinNow, 1), 1.05, 1.45),
    );
  }
  return next;
}

function withMacros(meal: PlannedMeal, ingredients: RecipeIngredient[]): PlannedMeal {
  return {
    ...meal,
    ingredients,
    alexis: declinationFromIngredients(ingredients, "alexis"),
    elodie: declinationFromIngredients(ingredients, "elodie"),
  };
}

export function scaleMealToGoals(meal: PlannedMeal, coach: MealCoachHousehold): PlannedMeal {
  if (!meal.ingredients.length || meal.baseName === "Aucun repas") return meal;
  let ingredients = meal.ingredients.map((item) => {
    if (item.role === "shared") return scaleSharedItem(item, meal, coach);
    if (item.role === "alexis" || item.role === "elodie") return scaleSoloProtein(item, meal, coach);
    return item;
  });
  ingredients = fitProfile(ingredients, "alexis", coach.alexis, meal.mealType);
  ingredients = fitProfile(ingredients, "elodie", coach.elodie, meal.mealType);
  return withMacros(meal, ingredients);
}

export function scalePlanToGoals(plan: PlannedMeal[], coach: MealCoachHousehold | null | undefined) {
  if (!coach) return plan;
  return plan.map((meal) => scaleMealToGoals(meal, coach));
}
