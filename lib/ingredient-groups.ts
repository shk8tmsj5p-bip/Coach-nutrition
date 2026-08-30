import type { PlannedMeal, RecipeIngredient } from "@/lib/types";
import { isDessertRecipe } from "@/lib/recipe-kind";
import { classifyIngredient } from "@/lib/recipe-macros";

export type DressingGroupId =
  | "marinade"
  | "mayo"
  | "vinaigrette"
  | "pesto"
  | "houmous"
  | "satay"
  | "nuoc"
  | "tahini"
  | "sauce";

type GroupDef = {
  id: DressingGroupId;
  label: string;
  nameRx: RegExp;
  stepRx: RegExp;
};

export const DRESSING_GROUP_DEFS: GroupDef[] = [
  { id: "marinade", label: "Marinade", nameRx: /marinade/i, stepRx: /marinade|\bmariner\b|\bmarin[eé]e?s?\b/i },
  { id: "mayo", label: "Mayo", nameRx: /mayo|a[iï]oli|mayonnaise/i, stepRx: /mayo|a[iï]oli|mayonnaise/i },
  { id: "vinaigrette", label: "Vinaigrette", nameRx: /vinaigrette/i, stepRx: /vinaigrette/i },
  { id: "pesto", label: "Pesto", nameRx: /\bpesto\b|\bpistou\b/i, stepRx: /\bpesto\b|\bpistou\b/i },
  { id: "houmous", label: "Houmous", nameRx: /houmous|hummus/i, stepRx: /houmous|hummus/i },
  { id: "satay", label: "Sauce satay", nameRx: /satay/i, stepRx: /satay/i },
  { id: "nuoc", label: "Nuoc", nameRx: /nuoc/i, stepRx: /nuoc/i },
  { id: "tahini", label: "Sauce tahini", nameRx: /tahini|tahin/i, stepRx: /tahini|tahin/i },
  { id: "sauce", label: "Sauce", nameRx: /\bsauce\b(?!\s*soja)/i, stepRx: /\bsauce\b(?!\s*soja)/i },
];

export const DRESSING_GROUP_ORDER: DressingGroupId[] = DRESSING_GROUP_DEFS.map((row) => row.id);

function fold(value: string) {
  return value
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function mealBlob(meal: PlannedMeal) {
  return `${meal.baseName} ${meal.sharedBase} ${meal.ingredients.map((ing) => `${ing.name} ${ing.notes ?? ""}`).join(" ")} ${meal.steps.join(" ")}`;
}

export function dressingGroupLabel(id: DressingGroupId): string {
  return DRESSING_GROUP_DEFS.find((row) => row.id === id)?.label ?? "Sauce";
}

function defOf(id: DressingGroupId) {
  return DRESSING_GROUP_DEFS.find((row) => row.id === id)!;
}

function mentionedIn(ing: RecipeIngredient, text: string) {
  const hay = text.toLowerCase();
  const name = ing.name.toLowerCase().trim();
  if (name.length < 3) return false;
  if (hay.includes(name)) return true;
  const first = name.split(/[\s,(]/)[0] ?? "";
  return first.length >= 4 && hay.includes(first);
}

function namedGroupOf(ing: RecipeIngredient): DressingGroupId | null {
  const blob = ing.name;
  for (const def of DRESSING_GROUP_DEFS) {
    if (def.id === "sauce" && !/\bsauce\b/i.test(blob)) continue;
    if (def.nameRx.test(blob)) return def.id;
  }
  return null;
}

export function groupsPresentInMeal(meal: PlannedMeal): DressingGroupId[] {
  if (isDessertRecipe(meal)) return [];
  const blob = mealBlob(meal);
  const found: DressingGroupId[] = [];
  for (const def of DRESSING_GROUP_DEFS) {
    if (def.nameRx.test(blob) || meal.steps.some((line) => def.stepRx.test(line))) {
      found.push(def.id);
    }
  }
  if (found.length === 0) {
    const names = meal.ingredients.map((ing) => fold(ing.name));
    const hasMoutarde = names.some((name) => name.includes("moutarde"));
    const hasAcid = names.some((name) => /citron|vinaigre/.test(name));
    const hasOil = names.some((name) => name.includes("huile"));
    if (hasMoutarde && hasAcid && hasOil) found.push("vinaigrette");
  }
  return found;
}

function stepsForGroup(meal: PlannedMeal, id: DressingGroupId) {
  const def = defOf(id);
  return meal.steps.filter((line) => {
    if (id === "sauce" && /marinade|mariner|mayo|a[iï]oli/i.test(line) && !/\bsauce\b/i.test(line)) {
      return false;
    }
    return def.stepRx.test(line);
  });
}

function isEmulsionOrAromatic(ing: RecipeIngredient) {
  return /moutarde|vinaigre|huile|soja|agave|sirop|tahini|tahin|s[eé]same|citron|lime|ail|gingembre|lait de soja|lait soja|yaourt soja|mayo|a[iï]oli|cumin|paprika|poivre|sel|curcuma/i.test(
    ing.name,
  );
}

function isAssemblyLine(line: string) {
  return (
    /bo[iî]te|assembl|dressage|montage|au pot|r[eé]partir|disposer|garnir/i.test(line) &&
    !/fouetter|thermomix|[eé]mulsion|mixer|sec\s*\/\s*v/i.test(line)
  );
}

/** Galette, tomate, falafel, tofu… jamais une sauce, même si l'étape d'assemblage cite « sauce tahini ». */
function canBeDressing(ing: RecipeIngredient, meal: PlannedMeal) {
  const n = fold(ing.name);
  const kind = classifyIngredient(ing.name);
  if (kind === "veg" || kind === "protein" || kind === "starch") return false;
  if (/avocat(?!ier)/.test(n) && !/huile/.test(n)) return false;
  if (/nori|graines de sesame/.test(n) && !/huile|tahini|tahin|beurre/.test(n)) return false;
  if (kind === "legume" || /pois chiche/.test(n)) return groupsPresentInMeal(meal).includes("houmous");
  if (namedGroupOf(ing)) return true;
  if (isEmulsionOrAromatic(ing) || kind === "sauce" || kind === "oil") return true;
  if (kind === "herb") {
    if (/gingembre|ail|cumin|paprika|poivre|sel|curcuma|cinq.?epice|5.?epice/.test(n)) return true;
    if (/basilic|persil|ciboulette|aneth/.test(n)) {
      const groups = groupsPresentInMeal(meal);
      return groups.includes("mayo") || groups.includes("pesto");
    }
  }
  return false;
}

function defaultGroupForPart(ing: RecipeIngredient, groups: DressingGroupId[]): DressingGroupId | null {
  if (groups.length === 0) return null;
  const n = fold(ing.name);
  const has = (id: DressingGroupId) => groups.includes(id);
  const firstFinish = groups.find((id) => id !== "marinade") ?? null;

  if (/lait de soja|lait soja|mayo|aioli|mayonnaise/.test(n)) {
    if (has("mayo")) return "mayo";
    return firstFinish ?? groups[0] ?? null;
  }
  if (/tahini|tahin/.test(n)) {
    if (has("tahini")) return "tahini";
    if (has("satay")) return "satay";
    return firstFinish ?? groups[0] ?? null;
  }
  if (/soja|gingembre|ail|sesame/.test(n) && has("marinade")) return "marinade";
  if (/citron|lime|moutarde|vinaigre/.test(n)) {
    if (has("mayo")) return "mayo";
    if (has("vinaigrette")) return "vinaigrette";
    if (has("tahini")) return "tahini";
    if (has("satay")) return "satay";
    if (has("nuoc")) return "nuoc";
    if (has("sauce")) return "sauce";
    if (has("marinade")) return "marinade";
  }
  if (/huile d['’ ]?olive/.test(n) && has("vinaigrette")) return "vinaigrette";
  if (/huile/.test(n) && /sesame/.test(n) && has("marinade")) return "marinade";
  if (groups.length === 1) return groups[0] ?? null;
  return firstFinish ?? groups[0] ?? null;
}

/** Quel pot / quelle marinade : null si c'est du plat (légume, protéine, féculent). */
export function dressingGroupOf(ing: RecipeIngredient, meal: PlannedMeal): DressingGroupId | null {
  if (isDessertRecipe(meal)) return null;
  if (/^eau$/i.test(ing.name.trim())) return null;
  if (!canBeDressing(ing, meal)) return null;
  const named = namedGroupOf(ing);
  if (named) return named;

  const groups = groupsPresentInMeal(meal);
  if (groups.length === 0) return null;

  const cookSteps = meal.steps.filter((line) =>
    /airfryer|plaque|four|r[oô]ti|rotir|po[eê]le|poele|saisir/i.test(line),
  );
  const cookHay = cookSteps.join(" ");
  const dressingHay = groups
    .flatMap((id) => stepsForGroup(meal, id))
    .filter((line) => !isAssemblyLine(line))
    .join(" ");
  if (/huile/i.test(ing.name) && cookHay && mentionedIn(ing, cookHay) && !mentionedIn(ing, dressingHay)) {
    return null;
  }

  for (const id of groups) {
    const hay = stepsForGroup(meal, id)
      .filter((line) => !isAssemblyLine(line))
      .join(" ");
    if (hay && mentionedIn(ing, hay)) return id;
  }

  return defaultGroupForPart(ing, groups);
}

export function dressingLabel(meal: PlannedMeal): string | null {
  const groups = groupsPresentInMeal(meal);
  if (groups.length === 0) return null;
  return dressingGroupLabel(groups[0]!);
}

export function isDressingIngredient(ing: RecipeIngredient, meal: PlannedMeal) {
  return dressingGroupOf(ing, meal) !== null;
}

export function isMarinadeIngredient(ing: RecipeIngredient, meal: PlannedMeal) {
  return dressingGroupOf(ing, meal) === "marinade";
}

export function isFinishSauceIngredient(ing: RecipeIngredient, meal: PlannedMeal) {
  const group = dressingGroupOf(ing, meal);
  return group !== null && group !== "marinade";
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
  const rest = ingredients.filter((ing) => !isDressingIngredient(ing, meal));
  const groups: Array<{ label: string | null; items: RecipeIngredient[] }> = [];
  if (rest.length) groups.push({ label: null, items: rest });
  const used = new Set<string>();
  for (const id of DRESSING_GROUP_ORDER) {
    const items = ingredients.filter((ing) => {
      if (used.has(ing.id)) return false;
      if (dressingGroupOf(ing, meal) !== id) return false;
      used.add(ing.id);
      return true;
    });
    if (items.length) groups.push({ label: dressingGroupLabel(id), items });
  }
  return groups;
}
