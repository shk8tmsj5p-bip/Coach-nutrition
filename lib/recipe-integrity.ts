import { declinationFromIngredients } from "@/lib/recipe-macros";
import { STEP_SECTION_PREFIX } from "@/lib/recipe-copy";
import type { Appliance, PlannedMeal, RecipeIngredient } from "@/lib/types";

const FALAFEL_COOK = "Falafels : Airfryer 180°C · 12 min, retourner à mi-cuisson.";

const STAR_PROTEINS: Array<{
  title: RegExp;
  name: string;
  visual: string;
  grams: number;
  drop: RegExp;
}> = [
  {
    title: /falafel/i,
    name: "Falafels",
    visual: "6 pièces",
    grams: 140,
    drop: /crevette|poulet|dinde|saumon|cabillaud|truite|tofu/i,
  },
];

const PROTEIN_HINTS: Array<{
  test: RegExp;
  name: string;
  visual: string;
  grams: number;
  vegan: boolean;
}> = [
  { test: /falafel/i, name: "Falafels", visual: "6 pièces", grams: 140, vegan: true },
  { test: /crevette/i, name: "Crevettes", visual: "1 barquette", grams: 140, vegan: false },
  { test: /poulet/i, name: "Poulet", visual: "1 filet", grams: 150, vegan: false },
  { test: /dinde/i, name: "Dinde", visual: "1 filet", grams: 150, vegan: false },
  { test: /saumon/i, name: "Saumon", visual: "1 pavé", grams: 140, vegan: false },
  { test: /cabillaud/i, name: "Cabillaud", visual: "1 pavé", grams: 140, vegan: false },
  { test: /tofu/i, name: "Tofu ferme", visual: "1/2 bloc", grams: 150, vegan: true },
];

function slug(name: string, role: string) {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "ing"}-${role}`;
}

function makeIng(
  name: string,
  role: RecipeIngredient["role"],
  gramsA: number,
  gramsE: number,
  visual: string,
): RecipeIngredient {
  return {
    id: slug(name, role),
    name,
    role,
    gramsAlexis: gramsA,
    gramsElodie: gramsE,
    visualQuantity: visual,
  };
}

function hasProtein(ings: RecipeIngredient[], test: RegExp, role?: RecipeIngredient["role"]) {
  return ings.some((ing) => {
    if (!test.test(ing.name)) return false;
    if (role === "alexis") return ing.gramsAlexis > 0;
    if (role === "elodie") return ing.gramsElodie > 0;
    return ing.gramsAlexis > 0 || ing.gramsElodie > 0;
  });
}

function applySharedStar(meal: PlannedMeal, ingredients: RecipeIngredient[]) {
  const hay = `${meal.baseName} ${meal.theme}`;
  let next = ingredients;
  for (const star of STAR_PROTEINS) {
    if (!star.title.test(hay)) continue;
    next = next.filter((ing) => !star.drop.test(ing.name) || star.title.test(ing.name));
    if (!hasProtein(next, star.title)) {
      next.push(makeIng(star.name, "shared", star.grams, star.grams, star.visual));
    } else {
      next = next.map((ing) =>
        star.title.test(ing.name)
          ? {
              ...ing,
              role: "shared" as const,
              gramsAlexis: ing.gramsAlexis || star.grams,
              gramsElodie: ing.gramsElodie || star.grams,
            }
          : ing,
      );
    }
  }
  return next;
}

function isPlaceholderProtein(label: string) {
  const t = label.trim();
  return !t || t === "—" || /^prot[eé]ine/i.test(t);
}

function hydrateFromLabel(
  ingredients: RecipeIngredient[],
  label: string,
  role: "alexis" | "elodie",
) {
  if (isPlaceholderProtein(label)) return ingredients;
  const hint = PROTEIN_HINTS.find((row) => row.test.test(label));
  if (!hint) return ingredients;
  if (role === "alexis" && !hint.vegan) return ingredients;
  if (hasProtein(ingredients, hint.test, role)) return ingredients;
  const existing = ingredients.find((ing) => hint.test.test(ing.name));
  if (existing) {
    return ingredients.map((ing) => {
      if (ing !== existing) return ing;
      if (role === "alexis") {
        return { ...ing, role: ing.gramsElodie > 0 && ing.role !== "elodie" ? "shared" : ing.role, gramsAlexis: ing.gramsAlexis || hint.grams };
      }
      return { ...ing, role: ing.gramsAlexis > 0 && ing.role !== "alexis" ? "shared" : ing.role, gramsElodie: ing.gramsElodie || hint.grams };
    });
  }
  return [
    ...ingredients,
    makeIng(
      hint.name,
      role,
      role === "alexis" ? hint.grams : 0,
      role === "elodie" ? hint.grams : 0,
      hint.visual,
    ),
  ];
}

function isSharedStarMeal(meal: PlannedMeal) {
  const hay = `${meal.baseName} ${meal.theme}`;
  return STAR_PROTEINS.some((star) => star.title.test(hay));
}

function stripFalafelMarinatedIng(ing: RecipeIngredient): RecipeIngredient {
  if (!/falafel/i.test(ing.name) && !/falafel/i.test(ing.notes ?? "")) return ing;
  const name = ing.name.replace(/\s*marin[ée]e?s?\b/gi, "").replace(/\s{2,}/g, " ").trim() || ing.name;
  const notes = (ing.notes ?? "").replace(/\s*marin[ée]e?s?\b/gi, "").replace(/\s{2,}/g, " ").trim();
  if (name === ing.name && notes === (ing.notes ?? "").trim()) return ing;
  return { ...ing, name, notes: notes || undefined };
}

/** Falafels go in the Airfryer — never labelled marinated, never omitted from cook steps. */
export function ensureFalafelAirfryer(meal: PlannedMeal): PlannedMeal {
  const ingredients = meal.ingredients.map(stripFalafelMarinatedIng);
  if (!ingredients.some((ing) => /falafel/i.test(ing.name))) {
    return ingredients === meal.ingredients ? meal : { ...meal, ingredients };
  }
  const hasCook = meal.steps.some((line) => /falafel/i.test(line) && /\d+\s*°c|airfryer/i.test(line));
  let steps = meal.steps;
  if (!hasCook) {
    const idx = meal.steps.findIndex((line) => line.startsWith(STEP_SECTION_PREFIX) && /airfryer/i.test(line));
    steps =
      idx >= 0
        ? [...meal.steps.slice(0, idx + 1), FALAFEL_COOK, ...meal.steps.slice(idx + 1)]
        : [`${STEP_SECTION_PREFIX}Cuissons Airfryer`, FALAFEL_COOK, ...meal.steps];
  }
  const appliances: Appliance[] = meal.appliances.includes("Airfryer")
    ? meal.appliances
    : [...meal.appliances, "Airfryer"];
  return {
    ...meal,
    ingredients,
    steps,
    appliances,
    alexis: declinationFromIngredients(ingredients, "alexis"),
    elodie: declinationFromIngredients(ingredients, "elodie"),
  };
}

/** Titre « wrap falafels » ⇒ falafels partagés. Protéine affichée sans ligne d'ingrédient ⇒ on l'ajoute. */
export function repairMealIntegrity(meal: PlannedMeal): PlannedMeal {
  if (!meal.ingredients.length && isPlaceholderProtein(meal.alexis.protein) && isPlaceholderProtein(meal.elodie.protein)) {
    return meal;
  }
  let ingredients = applySharedStar(meal, meal.ingredients).map(stripFalafelMarinatedIng);
  if (!isSharedStarMeal(meal)) {
    ingredients = hydrateFromLabel(ingredients, meal.alexis.protein, "alexis");
    ingredients = hydrateFromLabel(ingredients, meal.elodie.protein, "elodie");
  }
  const next = {
    ...meal,
    ingredients,
    sharedBase: meal.sharedBase || ingredients.filter((ing) => ing.role === "shared").map((ing) => ing.name).join(", "),
    alexis: declinationFromIngredients(ingredients, "alexis"),
    elodie: declinationFromIngredients(ingredients, "elodie"),
  };
  return ensureFalafelAirfryer(next);
}

export function sharedProteinThemeLine(theme: string) {
  if (!/falafel/i.test(theme)) return "";
  return `PROTÉINE UNIQUE : falafels pour Alexis ET Élodie (shared_ingredients, grams_alexis et grams_elodie). INTERDIT crevettes / poulet / tofu à la place. Un wrap falafel SANS falafel dans les ingrédients est refusé.`;
}
