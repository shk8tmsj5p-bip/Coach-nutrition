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
  if (isEmulsionPart(ing)) return true;
  const dressingSteps = meal.steps.filter((line) =>
    /sauce|vinaigrette|marinade|pesto|pistou|houmous|satay|nuoc|thermomix|sec\s*\/\s*v/i.test(line),
  );
  const hay = dressingSteps.join(" ");
  if (!hay || !mentionedIn(ing, hay)) return false;
  return /citron|ail|gingembre|basilic|cumin|sésame|sesame|raifort/i.test(ing.name);
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
