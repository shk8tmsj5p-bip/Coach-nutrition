import { formatWeeklyRate, goalLabel } from "@/lib/goals";
import { SLOT_KCAL_SHARE } from "@/lib/macro-status";
import {
  classifyIngredient,
  declinationFromIngredients,
  envelopeCapGrams,
  envelopePieceGrams,
  estimateIngredientMacros,
  isEnvelopeIngredient,
  type IngredientKind,
} from "@/lib/recipe-macros";
import { equalizeSharedSauce, isDressingIngredient, sharedSauceGrams } from "@/lib/ingredient-groups";
import { parseVisualQuantity, visualForIngredient } from "@/lib/visual-quantity";
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
    return "densité : plus de féculent / protéine déjà dans le plat. Extra kcal = le plat, pas une 2e sauce ni une 2e protéine.";
  }
  if (person.goal === "perte") {
    return "volume : un peu plus de légumes. Huile serrée. JAMAIS couper la protéine.";
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
  return `COACH NUTRITION (cibles kcal par profil — MÊME plat. L'app recale les grammes Alexis / Élodie.)

${personBlock(coach.alexis)}

${personBlock(coach.elodie)}

RÈGLES PORTIONS
- UN seul plat. Protéine vegan / omni (la même si le titre EST la protéine). INTERDIT deux recettes.
- JSON = 1 assiette / pers., weight_g d'un cuisinier. Coller aux cibles ci-dessus. Extra kcal = ce qui est déjà dans le plat, pas une 2e protéine ni un 2e féculent.
- Dîner : coller aux cibles soir.
- N'inclus PAS de dessert (templates Paramètres).`;
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
  if (isDressingIngredient(item, meal)) {
    const g = sharedSauceGrams(item.gramsAlexis, item.gramsElodie);
    return { ...item, gramsAlexis: g, gramsElodie: g };
  }

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
    if (isEnvelopeIngredient(item.name)) {
      const cap = envelopeCapGrams(item.name, dinner, wrapCount(item));
      a = Math.min(base || envelopePieceGrams(item.name), cap);
      e = a;
    } else {
      const refCarbs = Math.max(1, (aSlot.carbs + eSlot.carbs) / 2);
      a = base * (aSlot.carbs / refCarbs);
      e = base * (eSlot.carbs / refCarbs);
      const dinnerCut = (goal: PrimaryGoal) =>
        goal === "perte" ? 0.55 : goal === "prise" ? 0.85 : 0.7;
      if (dinner) {
        a *= dinnerCut(coach.alexis.goal);
        e *= dinnerCut(coach.elodie.goal);
      }
    }
  } else if (kind === "veg") {
    const vol = (goal: PrimaryGoal) => (goal === "perte" ? 1.1 : 1);
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
  meal: PlannedMeal,
) {
  return ingredients.map((item) => {
    if (item.role !== "shared" && item.role !== profile) return item;
    if (isDressingIngredient(item, meal)) return item;
    if (isEnvelopeIngredient(item.name)) return item;
    const kind = classifyIngredient(item.name);
    if (!kinds.includes(kind)) return item;
    const grams = gramsOf(item, profile);
    if (grams <= 0) return item;
    return setGrams(item, profile, roundGrams(grams * factor, kind));
  });
}

function mealHasEnvelope(ingredients: RecipeIngredient[], meal: PlannedMeal) {
  if (/wrap|tortilla|burrito|pita|galette|naan/i.test(`${meal.baseName} ${meal.theme}`)) return true;
  return ingredients.some((item) => isEnvelopeIngredient(item.name));
}

function fitProfile(
  ingredients: RecipeIngredient[],
  profile: ProfileId,
  person: PersonMealCoach,
  meal: PlannedMeal,
) {
  const target = slotFor(person, meal.mealType);
  const decl = declinationFromIngredients(ingredients, profile);
  const kcalRatio = decl.calories / Math.max(target.calories, 1);
  let next = ingredients;
  if (person.goal === "prise" && kcalRatio < 0.88) {
    const bump = mealHasEnvelope(ingredients, meal)
      ? (["oil", "protein"] as IngredientKind[])
      : (["starch", "oil", "legume"] as IngredientKind[]);
    next = scaleKinds(next, profile, bump, clamp(target.calories / Math.max(decl.calories, 1), 1.05, 1.4), meal);
  } else if (person.goal === "perte" && kcalRatio > 1.12) {
    next = scaleKinds(next, profile, ["starch", "oil"], clamp(target.calories / Math.max(decl.calories, 1), 0.55, 0.95), meal);
  } else if (person.goal === "maintien" && (kcalRatio < 0.85 || kcalRatio > 1.15)) {
    next = scaleKinds(
      next,
      profile,
      ["starch", "oil"],
      clamp(target.calories / Math.max(decl.calories, 1), 0.7, 1.25),
      meal,
    );
  }
  const proteinNow = declinationFromIngredients(next, profile).proteinG;
  if (proteinNow < target.protein * 0.75) {
    next = scaleKinds(
      next,
      profile,
      ["protein", "legume"],
      clamp((target.protein * 0.9) / Math.max(proteinNow, 1), 1.05, 1.45),
      meal,
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

function vegItemCap(name: string, dinner: boolean) {
  const n = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const base = dinner ? 100 : 130;
  if (/carotte|oignon|poivron|radis|betterave/.test(n)) return Math.round(base * 0.85);
  if (/concombre|salade|laitue|courgette|tomate|chou/.test(n)) return Math.round(base * 1.1);
  return base;
}

function wrapCount(item: RecipeIngredient) {
  const parsed = parseVisualQuantity(item.visualQuantity);
  if (
    parsed &&
    parsed.amount >= 1.6 &&
    /piece|galette|wrap|pita|naan|tortilla|chapati/i.test(parsed.unit)
  ) {
    return Math.min(2, Math.round(parsed.amount));
  }
  return 1;
}

function capEnvelopePortions(meal: PlannedMeal): PlannedMeal {
  const dinner = meal.lowCalorie || meal.mealType === "diner";
  const ingredients = meal.ingredients.map((item) => {
    if (!isEnvelopeIngredient(item.name)) return item;
    const cap = envelopeCapGrams(item.name, dinner, wrapCount(item));
    const a = item.gramsAlexis > 0 ? Math.min(item.gramsAlexis, cap) : 0;
    const e = item.gramsElodie > 0 ? Math.min(item.gramsElodie, cap) : 0;
    const visual = visualForIngredient(item.name, Math.max(a, e), item.visualQuantity);
    return { ...item, gramsAlexis: a, gramsElodie: e, visualQuantity: visual };
  });
  return { ...meal, ingredients };
}

function profileHasPlateProtein(meal: PlannedMeal, profile: "alexis" | "elodie") {
  return meal.ingredients.some((item) => {
    if (classifyIngredient(item.name) !== "protein") return false;
    if (isDressingIngredient(item, meal)) return false;
    return profile === "alexis" ? item.gramsAlexis > 0 : item.gramsElodie > 0;
  });
}

function legumeItemCap(dinner: boolean, wrap: boolean, hasProtein: boolean) {
  if (wrap) return hasProtein ? 90 : 130;
  if (dinner) return hasProtein ? 80 : 110;
  return hasProtein ? 110 : 140;
}

/** Haricots / pois chiches : une garniture, pas 520 g sur un wrap. */
function capLegumePortions(meal: PlannedMeal): PlannedMeal {
  const dinner = meal.lowCalorie || meal.mealType === "diner";
  const wrap = mealHasEnvelope(meal.ingredients, meal);
  let ingredients = meal.ingredients.map((item) => {
    if (classifyIngredient(item.name) !== "legume") return item;
    if (isDressingIngredient(item, meal)) return item;
    const capA = legumeItemCap(dinner, wrap, profileHasPlateProtein(meal, "alexis"));
    const capE = legumeItemCap(dinner, wrap, profileHasPlateProtein(meal, "elodie"));
    const a = item.gramsAlexis > 0 ? Math.min(item.gramsAlexis, capA) : 0;
    const e = item.gramsElodie > 0 ? Math.min(item.gramsElodie, capE) : 0;
    const visual = visualForIngredient(item.name, Math.max(a, e), item.visualQuantity);
    return { ...item, gramsAlexis: a, gramsElodie: e, visualQuantity: visual };
  });
  for (const profile of ["alexis", "elodie"] as const) {
    const gramsOf = (item: RecipeIngredient) => (profile === "alexis" ? item.gramsAlexis : item.gramsElodie);
    const itemCap = legumeItemCap(dinner, wrap, profileHasPlateProtein(meal, profile));
    const maxTotal = wrap ? itemCap : dinner ? Math.round(itemCap * 1.15) : Math.round(itemCap * 1.25);
    const legumes = ingredients.filter(
      (item) =>
        classifyIngredient(item.name) === "legume" &&
        !isDressingIngredient(item, meal) &&
        gramsOf(item) > 0,
    );
    const total = legumes.reduce((sum, item) => sum + gramsOf(item), 0);
    if (total <= maxTotal) continue;
    const factor = maxTotal / total;
    ingredients = ingredients.map((item) => {
      if (!legumes.some((row) => row.id === item.id)) return item;
      const grams = Math.max(40, roundGrams(gramsOf(item) * factor, "legume"));
      const next = profile === "alexis" ? { ...item, gramsAlexis: grams } : { ...item, gramsElodie: grams };
      return {
        ...next,
        visualQuantity: visualForIngredient(
          next.name,
          Math.max(next.gramsAlexis, next.gramsElodie),
          next.visualQuantity,
        ),
      };
    });
  }
  return { ...meal, ingredients };
}

/** Assiette réelle : ~1–2 légumes, pas des kilos. Appliqué au load et après scale. */
export function capVegetablePortions(meal: PlannedMeal): PlannedMeal {
  if (!meal.ingredients.length || meal.baseName === "Aucun repas") return meal;
  const vegged = capVegetablePortionsInner(meal);
  const legumed = capLegumePortions(vegged);
  const wrapped = capEnvelopePortions(legumed);
  const plated = capPlatedPortions(wrapped);
  return withMacros(plated, plated.ingredients);
}

function capVegetablePortionsInner(meal: PlannedMeal): PlannedMeal {
  const dinner = meal.lowCalorie || meal.mealType === "diner";
  const maxTotal = dinner ? 220 : 280;
  let ingredients = meal.ingredients.map((item) => {
    if (classifyIngredient(item.name) !== "veg") return item;
    if (isDressingIngredient(item, meal)) return item;
    const cap = vegItemCap(item.name, dinner);
    return {
      ...item,
      gramsAlexis: item.gramsAlexis > 0 ? Math.min(item.gramsAlexis, cap) : 0,
      gramsElodie: item.gramsElodie > 0 ? Math.min(item.gramsElodie, cap) : 0,
    };
  });
  for (const profile of ["alexis", "elodie"] as const) {
    const gramsOf = (item: RecipeIngredient) => (profile === "alexis" ? item.gramsAlexis : item.gramsElodie);
    const vegs = ingredients.filter(
      (item) => classifyIngredient(item.name) === "veg" && !isDressingIngredient(item, meal) && gramsOf(item) > 0,
    );
    const total = vegs.reduce((sum, item) => sum + gramsOf(item), 0);
    if (total <= maxTotal) continue;
    const factor = maxTotal / total;
    ingredients = ingredients.map((item) => {
      if (!vegs.some((veg) => veg.id === item.id)) return item;
      const grams = Math.max(20, roundGrams(gramsOf(item) * factor, "veg"));
      return profile === "alexis" ? { ...item, gramsAlexis: grams } : { ...item, gramsElodie: grams };
    });
  }
  return { ...meal, ingredients };
}

function isPlateVolume(item: RecipeIngredient, meal: PlannedMeal) {
  if (/^eau$/i.test(item.name.trim())) return false;
  if (isDressingIngredient(item, meal)) return false;
  if (isEnvelopeIngredient(item.name)) return false;
  const kind = classifyIngredient(item.name);
  return kind === "veg" || kind === "starch" || kind === "legume" || kind === "other";
}

function isPlateProtein(item: RecipeIngredient, meal: PlannedMeal) {
  if (isDressingIngredient(item, meal)) return false;
  return classifyIngredient(item.name) === "protein";
}

/** Un plat midi ≈ 500 g / pers., pas 750 g. Hors sauce / herbes / wrap. */
function capPlatedPortions(meal: PlannedMeal): PlannedMeal {
  const dinner = meal.lowCalorie || meal.mealType === "diner";
  const maxTotal = dinner ? 400 : 520;
  let ingredients = meal.ingredients;
  for (const profile of ["alexis", "elodie"] as const) {
    const gramsOf = (item: RecipeIngredient) =>
      profile === "alexis" ? item.gramsAlexis : item.gramsElodie;
    const setG = (item: RecipeIngredient, grams: number) =>
      profile === "alexis" ? { ...item, gramsAlexis: grams } : { ...item, gramsElodie: grams };
    const sumWhere = (pred: (item: RecipeIngredient) => boolean) =>
      ingredients.filter(pred).reduce((sum, item) => sum + gramsOf(item), 0);

    let vol = sumWhere((item) => isPlateVolume(item, meal) && gramsOf(item) > 0);
    let prot = sumWhere((item) => isPlateProtein(item, meal) && gramsOf(item) > 0);
    if (vol + prot <= maxTotal) continue;

    if (vol > 0) {
      const keep = Math.max(vol * 0.4, Math.min(vol, maxTotal - Math.min(prot, dinner ? 160 : 220)));
      if (keep < vol - 1) {
        const factor = keep / vol;
        ingredients = ingredients.map((item) => {
          if (!isPlateVolume(item, meal) || gramsOf(item) <= 0) return item;
          const kind = classifyIngredient(item.name);
          const floor = kind === "starch" ? 40 : 20;
          return setG(item, Math.max(floor, roundGrams(gramsOf(item) * factor, kind)));
        });
      }
    }

    vol = sumWhere((item) => isPlateVolume(item, meal) && gramsOf(item) > 0);
    prot = sumWhere((item) => isPlateProtein(item, meal) && gramsOf(item) > 0);
    if (vol + prot <= maxTotal) continue;

    const protCap = Math.max(90, maxTotal - vol);
    if (prot > protCap && prot > 0) {
      const factor = protCap / prot;
      ingredients = ingredients.map((item) => {
        if (!isPlateProtein(item, meal) || gramsOf(item) <= 0) return item;
        return setG(item, Math.max(80, roundGrams(gramsOf(item) * factor, "protein")));
      });
    }
  }
  return { ...meal, ingredients };
}

export function scaleMealToGoals(meal: PlannedMeal, coach: MealCoachHousehold): PlannedMeal {
  if (!meal.ingredients.length || meal.baseName === "Aucun repas") return meal;
  let ingredients = meal.ingredients.map((item) => {
    if (item.role === "shared") return scaleSharedItem(item, meal, coach);
    if (item.role === "alexis" || item.role === "elodie") return scaleSoloProtein(item, meal, coach);
    return item;
  });
  ingredients = fitProfile(ingredients, "alexis", coach.alexis, meal);
  ingredients = fitProfile(ingredients, "elodie", coach.elodie, meal);
  const equalized = equalizeSharedSauce({ ...meal, ingredients });
  return capVegetablePortions(equalized);
}

export function scalePlanToGoals(plan: PlannedMeal[], coach: MealCoachHousehold | null | undefined) {
  if (!coach) return plan;
  return plan.map((meal) => scaleMealToGoals(meal, coach));
}
