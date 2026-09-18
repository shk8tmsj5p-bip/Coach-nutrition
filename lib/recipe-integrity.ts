import { declinationFromIngredients } from "@/lib/recipe-macros";
import { STEP_SECTION_PREFIX } from "@/lib/recipe-copy";
import type { Appliance, PlannedMeal, RecipeIngredient } from "@/lib/types";

const FALAFEL_COOK = "Falafels : Airfryer 180°C · 12 min, retourner à mi-cuisson.";

function stripFalafelMarinatedIng(ing: RecipeIngredient): RecipeIngredient {
  if (!/falafel/i.test(ing.name) && !/falafel/i.test(ing.notes ?? "")) return ing;
  const name = ing.name.replace(/\s*marin[ée]e?s?\b/gi, "").replace(/\s{2,}/g, " ").trim() || ing.name;
  const notes = (ing.notes ?? "").replace(/\s*marin[ée]e?s?\b/gi, "").replace(/\s{2,}/g, " ").trim();
  if (name === ing.name && notes === (ing.notes ?? "").trim()) return ing;
  return { ...ing, name, notes: notes || undefined };
}

/** Si Gem a mis des falafels, l'étape Airfryer doit exister — on n'ajoute pas de falafels. */
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

/** Le JSON de Gem est le plat. Pas d'ajout / suppression d'ingrédients. */
export function repairMealIntegrity(meal: PlannedMeal): PlannedMeal {
  if (!meal.ingredients.length) return meal;
  const ingredients = meal.ingredients.map(stripFalafelMarinatedIng);
  const next = {
    ...meal,
    ingredients,
    sharedBase:
      meal.sharedBase ||
      ingredients
        .filter((ing) => ing.role === "shared")
        .map((ing) => ing.name)
        .join(", "),
    alexis: declinationFromIngredients(ingredients, "alexis"),
    elodie: declinationFromIngredients(ingredients, "elodie"),
  };
  return ensureFalafelAirfryer(next);
}

export function sharedProteinThemeLine(theme: string) {
  if (/quiche|clafoutis|\bflan\b|\btarte\b/i.test(theme)) {
    return `PLAT UNIQUE : quiche / tarte. Tofu soyeux dans shared_ingredients + étape four (Alexis ET Élodie). INTERDIT tortillas / wrap / bowl à la place.`;
  }
  if (/wrap|tortilla|burrito/i.test(theme)) {
    return `PLAT UNIQUE : wrap / tortilla. La garniture que tu poses (tartinade, falafels, tofu…) fait partie du plat.`;
  }
  if (!/falafel/i.test(theme)) return "";
  return `PROTÉINE DU PLAT : falafels dans shared_ingredients ET dans les étapes (airfryer).`;
}
