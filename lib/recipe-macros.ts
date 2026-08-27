import type { RecipeDeclination, RecipeIngredient } from "@/lib/types";

export type IngredientKind =
  | "starch"
  | "protein"
  | "legume"
  | "oil"
  | "veg"
  | "sauce"
  | "herb"
  | "other";

type Per100 = { kcal: number; protein: number; carbs: number; fat: number };

const KIND_MACROS: Record<IngredientKind, Per100> = {
  starch: { kcal: 130, protein: 2.7, carbs: 28, fat: 0.4 },
  protein: { kcal: 145, protein: 18, carbs: 2, fat: 7 },
  legume: { kcal: 120, protein: 9, carbs: 16, fat: 3 },
  oil: { kcal: 884, protein: 0, carbs: 0, fat: 100 },
  veg: { kcal: 28, protein: 1.4, carbs: 5, fat: 0.2 },
  sauce: { kcal: 55, protein: 2, carbs: 6, fat: 2 },
  herb: { kcal: 25, protein: 2, carbs: 4, fat: 0.4 },
  other: { kcal: 80, protein: 4, carbs: 10, fat: 3 },
};

const NAMED: Array<{ keys: string[]; macros: Per100 }> = [
  { keys: ["riz"], macros: { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 } },
  { keys: ["pates", "pate", "nouille"], macros: { kcal: 160, protein: 6, carbs: 31, fat: 1 } },
  { keys: ["quinoa"], macros: { kcal: 120, protein: 4.4, carbs: 21, fat: 1.9 } },
  { keys: ["boulgour", "semoule"], macros: { kcal: 110, protein: 4, carbs: 23, fat: 0.4 } },
  { keys: ["pomme de terre", "patate douce", "patate"], macros: { kcal: 86, protein: 1.7, carbs: 20, fat: 0.1 } },
  { keys: ["pain", "naan", "galette", "wrap", "pita", "tortilla"], macros: { kcal: 260, protein: 8, carbs: 48, fat: 4 } },
  { keys: ["tofu soyeux"], macros: { kcal: 55, protein: 5.3, carbs: 2.3, fat: 2.7 } },
  { keys: ["tofu ferme", "tofu"], macros: { kcal: 145, protein: 16, carbs: 2, fat: 9 } },
  { keys: ["edamame"], macros: { kcal: 120, protein: 11, carbs: 9, fat: 5 } },
  { keys: ["lentille", "pois chiche", "haricot blanc", "haricot rouge"], macros: { kcal: 115, protein: 8, carbs: 18, fat: 1 } },
  { keys: ["poulet", "dinde"], macros: { kcal: 165, protein: 31, carbs: 0, fat: 3.6 } },
  { keys: ["crevette", "cabillaud", "saumon", "thon"], macros: { kcal: 120, protein: 22, carbs: 0, fat: 3 } },
  { keys: ["oeuf", "œuf"], macros: { kcal: 143, protein: 13, carbs: 1, fat: 10 } },
  { keys: ["huile"], macros: { kcal: 884, protein: 0, carbs: 0, fat: 100 } },
  { keys: ["tahini", "tahin", "beurre de sesame"], macros: { kcal: 595, protein: 17, carbs: 21, fat: 54 } },
  { keys: ["avocat"], macros: { kcal: 160, protein: 2, carbs: 9, fat: 15 } },
  { keys: ["banane"], macros: { kcal: 89, protein: 1.1, carbs: 23, fat: 0.3 } },
  { keys: ["pomme"], macros: { kcal: 52, protein: 0.3, carbs: 14, fat: 0.2 } },
  { keys: ["sauce soja"], macros: { kcal: 53, protein: 8, carbs: 5, fat: 0 } },
];

function fold(value: string) {
  return value
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function classifyIngredient(name: string): IngredientKind {
  const n = fold(name);
  if (
    /menthe|basilic|persil|ciboulette|thym|romarin|aneth|estragon|origan|ciboule/.test(n)
  ) {
    return "herb";
  }
  if (/cumin|paprika|poivre|sel|curcuma|cinq.?epice|5.?epice|moutarde|cannelle|cardamome/.test(n)) {
    return "herb";
  }
  if (/gingembre|ail|echalote|citronnelle/.test(n)) return "herb";
  if (/huile|tahini|tahin|beurre de sesame|avocat(?!ier)/.test(n) && !/pousse/.test(n)) {
    return "oil";
  }
  if (
    /riz|pate|quinoa|boulgour|semoule|pomme de terre|patate|pain|naan|galette|wrap|pita|tortilla|avoine|sarrasin|nouille|vermicelle/.test(
      n,
    )
  ) {
    return "starch";
  }
  if (
    /tofu|poulet|dinde|saumon|cabillaud|crevette|oeuf|thon|boeuf|steak|fromage|skyr|tempeh|seitan/.test(
      n,
    )
  ) {
    return "protein";
  }
  if (/lentille|pois chiche|haricot blanc|haricot rouge|edamame/.test(n)) return "legume";
  if (/sauce soja|vinaigre|citron|lime|agave|nuoc|miso/.test(n)) return "sauce";
  if (
    /courgette|carotte|chou|salade|concombre|tomate|poivron|epinard|brocoli|haricot vert|aubergine|champignon|radis|navet|celeri|betterave|oignon|poireau|roquette|mache|fenouil|courge|asperge|petit pois|pousse de soja/.test(
      n,
    )
  ) {
    return "veg";
  }
  return "other";
}

function namedMacros(name: string): Per100 | undefined {
  const n = fold(name);
  let best: { macros: Per100; len: number } | undefined;
  for (const row of NAMED) {
    for (const key of row.keys) {
      if (!n.includes(fold(key))) continue;
      if (!best || key.length > best.len) best = { macros: row.macros, len: key.length };
    }
  }
  return best?.macros;
}

export function estimateIngredientMacros(name: string, grams: number) {
  const per100 = namedMacros(name) ?? KIND_MACROS[classifyIngredient(name)];
  const g = Math.max(0, grams);
  return {
    calories: Math.round((per100.kcal * g) / 100),
    protein: Math.round((per100.protein * g) / 100),
    carbs: Math.round((per100.carbs * g) / 100),
    fat: Math.round((per100.fat * g) / 100),
  };
}

export function declinationFromIngredients(
  ingredients: RecipeIngredient[],
  profile: "alexis" | "elodie",
): RecipeDeclination {
  const rows = ingredients.filter((item) => item.role === "shared" || item.role === profile);
  let calories = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  for (const item of rows) {
    const grams = profile === "alexis" ? item.gramsAlexis : item.gramsElodie;
    if (grams <= 0) continue;
    const macros = estimateIngredientMacros(item.name, grams);
    calories += macros.calories;
    protein += macros.protein;
    carbs += macros.carbs;
    fat += macros.fat;
  }
  const proteinRow = rows.find((item) => item.role === profile);
  return {
    protein: proteinRow?.name ?? (profile === "alexis" ? "Protéine vegan" : "Protéine"),
    calories: Math.round(calories) || 0,
    proteinG: Math.round(protein) || 0,
    carbsG: Math.round(carbs) || 0,
    fatG: Math.round(fat) || 0,
  };
}
