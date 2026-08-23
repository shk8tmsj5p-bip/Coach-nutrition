import type { PlannedMeal, RecipeIngredient } from "@/lib/types";

const DRESSING_LABELS: Array<{ test: RegExp; label: string }> = [
  { test: /vinaigrette/i, label: "Vinaigrette" },
  { test: /marinade/i, label: "Marinade" },
  { test: /\bpistou\b/i, label: "Pistou" },
  { test: /\bpesto\b/i, label: "Pesto" },
  { test: /houmous|hummus/i, label: "Houmous" },
  { test: /satay/i, label: "Sauce satay" },
  { test: /nuoc/i, label: "Nuoc" },
  { test: /tahini|tahin/i, label: "Sauce tahini" },
  { test: /\bsauce\b/i, label: "Sauce" },
];

function mealBlob(meal: PlannedMeal) {
  return `${meal.baseName} ${meal.sharedBase} ${meal.ingredients.map((ing) => ing.name).join(" ")} ${meal.steps.join(" ")}`;
}

export function dressingLabel(meal: PlannedMeal): string | null {
  const blob = mealBlob(meal);
  for (const row of DRESSING_LABELS) {
    if (row.test.test(blob)) return row.label;
  }
  const names = meal.ingredients.map((ing) => ing.name.toLowerCase());
  const hasMoutarde = names.some((name) => name.includes("moutarde"));
  const hasAcid = names.some((name) => /citron|vinaigre/.test(name));
  const hasOil = names.some((name) => name.includes("huile"));
  if (hasMoutarde && hasAcid && hasOil) return "Vinaigrette";
  return null;
}

function isNamedDressing(ing: RecipeIngredient) {
  return /sauce|vinaigrette|marinade|tahini|tahin|houmous|hummus|pesto|pistou|satay|nuoc/i.test(
    `${ing.name} ${ing.notes ?? ""}`,
  );
}

function isEmulsionPart(ing: RecipeIngredient) {
  return /moutarde|vinaigre|huile|soja|agave|sirop|tahini|tahin|sésame|sesame/i.test(ing.name);
}

function mentionedIn(ing: RecipeIngredient, text: string) {
  const hay = text.toLowerCase();
  const name = ing.name.toLowerCase().trim();
  if (name.length < 3) return false;
  if (hay.includes(name)) return true;
  const first = name.split(/[\s,(]/)[0] ?? "";
  return first.length >= 4 && hay.includes(first);
}

export function isDressingIngredient(ing: RecipeIngredient, meal: PlannedMeal) {
  if (isNamedDressing(ing)) return true;
  const label = dressingLabel(meal);
  if (!label) return false;
  if (/^eau$/i.test(ing.name.trim())) return false;
  const dressingSteps = meal.steps.filter((line) =>
    /sauce|vinaigrette|marinade|pesto|pistou|houmous|satay|nuoc|thermomix|sec\s*\/\s*v|fouetter/i.test(line),
  );
  const cookSteps = meal.steps.filter((line) =>
    /airfryer|plaque|four|rôti|rotir|poêle|poele|saisir/i.test(line),
  );
  const dressingHay = dressingSteps.join(" ");
  const cookHay = cookSteps.join(" ");
  if (/huile/i.test(ing.name) && cookHay && mentionedIn(ing, cookHay) && !mentionedIn(ing, dressingHay)) {
    return false;
  }
  if (isEmulsionPart(ing)) return true;
  if (!dressingHay || !mentionedIn(ing, dressingHay)) return false;
  return /citron|ail|gingembre|basilic|cumin|sésame|sesame|raifort/i.test(ing.name);
}

/** Un seul dosage foyer : sauce / vinaigrette / marinade jamais split Alexis vs Élodie. */
export function sharedSauceGrams(a: number, e: number) {
  if (a > 0 && e > 0) return Math.round((a + e) / 2);
  return Math.max(0, Math.round(a || e));
}

export function equalizeSharedSauce(meal: PlannedMeal): PlannedMeal {
  if (!meal.ingredients.length || meal.baseName === "Aucun repas") return meal;
  const ingredients = meal.ingredients.map((ing) => {
    if (ing.role !== "shared") return ing;
    if (!isDressingIngredient(ing, meal)) return ing;
    const g = sharedSauceGrams(ing.gramsAlexis, ing.gramsElodie);
    if (g <= 0 || (ing.gramsAlexis === g && ing.gramsElodie === g)) return ing;
    return { ...ing, gramsAlexis: g, gramsElodie: g };
  });
  return { ...meal, ingredients };
}

export function groupMealIngredients(ingredients: RecipeIngredient[], meal: PlannedMeal) {
  const label = dressingLabel(meal);
  const dressing = ingredients.filter((ing) => isDressingIngredient(ing, meal));
  const rest = ingredients.filter((ing) => !isDressingIngredient(ing, meal));
  const groups: Array<{ label: string | null; items: RecipeIngredient[] }> = [];
  if (rest.length) groups.push({ label: null, items: rest });
  if (dressing.length) groups.push({ label: label ?? "Sauce", items: dressing });
  return groups;
}
