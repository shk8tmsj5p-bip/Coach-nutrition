import type { PlannedMeal } from "@/lib/types";

export type CulinaryRole =
  | "enveloppe"
  | "feculent"
  | "proteine"
  | "sauce"
  | "epice"
  | "herbe"
  | "gras"
  | "legume";

export type VegFamily =
  | "racine-ferme"
  | "racine-douce"
  | "fruit-chair"
  | "crudite-eau"
  | "feuille"
  | "allium"
  | "chou"
  | "champignon"
  | "legume";

export type CookUse = "cru" | "rape" | "roti" | "mijote" | "vapeur" | "grille";

export function culinaryRole(name: string): CulinaryRole {
  const n = name.toLowerCase();
  if (/galette|wrap|pita|naan|pain|tortilla|chapati|focaccia|ciabatta/.test(n)) return "enveloppe";
  if (
    /riz|quinoa|semoule|couscous|pâte|pate|penne|orzo|vermicelle|nouille|sarrasin|lentille|patate|pomme de terre/.test(
      n,
    )
  ) {
    return "feculent";
  }
  if (
    /tofu|poulet|dinde|pois chiche|falafel|oeuf|œuf|thon|crevette|cabillaud|bœuf|boeuf|tempeh|edamame|jambon|saumon/.test(
      n,
    )
  ) {
    return "proteine";
  }
  if (/tahini|tahin|houmous|moutarde|soja|vinaigrette|pesto|pistou|satay|nuoc|sauce|miso/.test(n)) {
    return "sauce";
  }
  if (/cumin|paprika|gingembre|cannelle|curcuma|poivre|ras el hanout|5-épices|cinq-épices/.test(n)) {
    return "epice";
  }
  if (/menthe|basilic|persil|ciboulette|aneth|thym|romarin/.test(n)) return "herbe";
  if (/huile|vinaigre|agave|sirop/.test(n)) return "gras";
  return "legume";
}

export function vegFamily(name: string): VegFamily {
  const n = name.toLowerCase();
  if (/navet|rutabaga|panais|c[ée]leri-rave|celeri-rave/.test(n)) return "racine-ferme";
  if (/carotte|betterave|patate douce/.test(n)) return "racine-douce";
  if (/aubergine|courgette|poivron|tomate/.test(n)) return "fruit-chair";
  if (/concombre|radis|fenouil/.test(n)) return "crudite-eau";
  if (/salade|épinard|epinard|roquette|blette|chou kale|pak choi/.test(n)) return "feuille";
  if (/oignon|[ée]chalote|poireau/.test(n)) return "allium";
  if (/chou|brocoli/.test(n)) return "chou";
  if (/champignon/.test(n)) return "champignon";
  return "legume";
}

export function inferCookUse(name: string, meal?: PlannedMeal): CookUse {
  const blob = `${meal?.baseName ?? ""} ${meal?.steps.join(" ") ?? ""} ${
    meal?.ingredients.find((item) => item.name.toLowerCase() === name.trim().toLowerCase())?.notes ?? ""
  }`.toLowerCase();
  if (/r[aâ]pé|rape fin|spaghettis/.test(blob) && new RegExp(name.slice(0, 5), "i").test(blob)) {
    return "rape";
  }
  if (/tian|ratatouille|r[oô]ti|four|airfryer|gratin/.test(blob)) return "roti";
  if (/velout[ée]|soupe|mijot|cookeo|bouillon/.test(blob)) return "mijote";
  if (/vapeur/.test(blob)) return "vapeur";
  if (/grill|plancha|po[eê]l/.test(blob)) return "grille";
  if (/cru|salade|wrap|crudit/.test(blob)) return "cru";
  if (/r[aâ]pé|rape/.test(blob)) return "rape";
  return "roti";
}

const VEG_ALTS: Record<VegFamily, Record<CookUse | "default", string[]>> = {
  "racine-ferme": {
    roti: ["Panais", "Rutabaga", "Céleri-rave"],
    mijote: ["Panais", "Carotte", "Céleri-rave"],
    vapeur: ["Panais", "Céleri-rave", "Carotte"],
    cru: ["Céleri-rave", "Radis noir", "Panais"],
    rape: ["Céleri-rave", "Panais", "Carotte"],
    grille: ["Panais", "Céleri-rave", "Rutabaga"],
    default: ["Panais", "Rutabaga", "Céleri-rave"],
  },
  "racine-douce": {
    roti: ["Panais", "Betterave", "Patate douce"],
    mijote: ["Panais", "Potiron", "Céleri-rave"],
    vapeur: ["Panais", "Betterave", "Potiron"],
    cru: ["Betterave crue", "Céleri-rave", "Radis"],
    rape: ["Betterave", "Céleri-rave", "Panais"],
    grille: ["Panais", "Betterave", "Patate douce"],
    default: ["Panais", "Betterave", "Céleri-rave"],
  },
  "fruit-chair": {
    roti: ["Courgette", "Poivron rouge", "Aubergine"],
    mijote: ["Courgette", "Poivron", "Aubergine"],
    vapeur: ["Courgette", "Poivron", "Aubergine"],
    cru: ["Tomate", "Poivron cru", "Concombre"],
    rape: ["Courgette", "Poivron", "Carotte"],
    grille: ["Courgette", "Poivron", "Aubergine"],
    default: ["Courgette", "Poivron rouge", "Aubergine"],
  },
  "crudite-eau": {
    cru: ["Courgette crue", "Radis", "Céleri branche"],
    rape: ["Courgette", "Radis", "Carotte"],
    roti: ["Courgette", "Poivron", "Céleri branche"],
    mijote: ["Courgette", "Poireau", "Céleri branche"],
    vapeur: ["Courgette", "Céleri branche", "Poireau"],
    grille: ["Courgette", "Poivron", "Céleri branche"],
    default: ["Courgette crue", "Radis", "Céleri branche"],
  },
  feuille: {
    cru: ["Roquette", "Mâche", "Épinard cru"],
    rape: ["Chou rouge", "Roquette", "Blettes"],
    roti: ["Blettes", "Pak choi", "Épinard"],
    mijote: ["Blettes", "Épinard", "Pak choi"],
    vapeur: ["Pak choi", "Blettes", "Épinard"],
    grille: ["Pak choi", "Blettes", "Courgette"],
    default: ["Roquette", "Épinard", "Blettes"],
  },
  allium: {
    roti: ["Échalote", "Poireau", "Oignon rouge"],
    mijote: ["Poireau", "Échalote", "Oignon"],
    vapeur: ["Poireau", "Oignon", "Échalote"],
    cru: ["Oignon rouge", "Échalote", "Ciboule"],
    rape: ["Oignon rouge", "Échalote", "Poireau"],
    grille: ["Poireau", "Oignon", "Échalote"],
    default: ["Échalote", "Poireau", "Oignon rouge"],
  },
  chou: {
    cru: ["Chou rouge", "Chou pointu", "Pak choi"],
    rape: ["Chou rouge", "Carotte", "Chou pointu"],
    roti: ["Chou pointu", "Brocoli tige", "Pak choi"],
    mijote: ["Chou pointu", "Brocoli", "Poireau"],
    vapeur: ["Brocoli tige", "Chou pointu", "Pak choi"],
    grille: ["Chou pointu", "Brocoli tige", "Pak choi"],
    default: ["Chou pointu", "Brocoli tige", "Pak choi"],
  },
  champignon: {
    roti: ["Champignon de Paris", "Pleurote", "Shiitaké"],
    mijote: ["Champignon de Paris", "Pleurote", "Shiitaké"],
    grille: ["Pleurote", "Champignon de Paris", "Shiitaké"],
    vapeur: ["Champignon de Paris", "Pleurote", "Shiitaké"],
    cru: ["Champignon de Paris", "Pleurote", "Shiitaké"],
    rape: ["Champignon de Paris", "Pleurote", "Shiitaké"],
    default: ["Champignon de Paris", "Pleurote", "Shiitaké"],
  },
  legume: {
    roti: ["Courgette", "Poivron rouge", "Aubergine"],
    mijote: ["Courgette", "Poireau", "Carotte"],
    vapeur: ["Courgette", "Brocoli tige", "Carotte"],
    cru: ["Concombre", "Radis", "Tomate"],
    rape: ["Carotte", "Courgette", "Betterave"],
    grille: ["Courgette", "Poivron", "Aubergine"],
    default: ["Courgette", "Poivron rouge", "Aubergine"],
  },
};

const ROLE_ALTS: Record<CulinaryRole, string[]> = {
  enveloppe: ["Pain pita complet", "Wrap complet", "Naan nature", "Tortilla complète"],
  feculent: ["Quinoa", "Riz basmati", "Sarrasin", "Orzo complet"],
  proteine: ["Pois chiches", "Edamame", "Lentilles", "Tofu ferme"],
  sauce: ["Tahini-citron", "Moutarde-citron", "Vinaigrette soja-gingembre"],
  epice: ["Cumin", "Paprika fumé", "Herbes de Provence"],
  herbe: ["Persil plat", "Basilic", "Menthe", "Ciboulette"],
  gras: ["Huile d'olive", "Huile de sésame", "Vinaigre de cidre"],
  legume: ["Courgette", "Poivron rouge", "Aubergine"],
};

function alreadyInMeal(meal: PlannedMeal | undefined, name: string) {
  if (!meal) return false;
  const n = name.trim().toLowerCase();
  return meal.ingredients.some((item) => item.name.trim().toLowerCase() === n);
}

function takeThree(pool: string[], original: string, meal?: PlannedMeal) {
  const skip = original.trim().toLowerCase();
  return pool.filter((item) => item.toLowerCase() !== skip && !alreadyInMeal(meal, item)).slice(0, 3);
}

export function describeIngredientUse(name: string, meal?: PlannedMeal) {
  if (!meal) return `${name} : même fonction dans l'assiette.`;
  const role = culinaryRole(name);
  const use = inferCookUse(name, meal);
  const family = vegFamily(name);
  const useLabel: Record<CookUse, string> = {
    cru: "cru / salade",
    rape: "râpé",
    roti: "rôti / four / tian",
    mijote: "mijoté / soupe",
    vapeur: "vapeur",
    grille: "grillé / poêle",
  };
  return `${name} dans « ${meal.baseName} » : rôle ${role}${
    role === "legume" ? `, famille ${family}` : ""
  }, cuisson ${useLabel[use]}.`;
}

const LIGHT_DESSERT_ALTS = [
  "Érythritol",
  "Tofu soyeux",
  "Cacao non sucré",
  "Stévia",
  "Extrait de vanille",
  "Konjac",
  "Cannelle",
];

export function mockSuggestDessertSwap(ingredientName: string, meal?: PlannedMeal): string[] {
  const n = ingredientName.toLowerCase();
  let pool: string[];
  if (/sirop|miel|agave|sucre|cassonade/.test(n)) {
    pool = ["Érythritol", "Stévia", "Extrait de vanille"];
  } else if (/puree|purée|beurre d.amande|beurre de cajou/.test(n)) {
    pool = ["Tofu soyeux", "Compote de pomme", "Yaourt soja nature"];
  } else if (/pepites|pépites|chocolat/.test(n) && !/cacao/.test(n)) {
    pool = ["Cacao non sucré", "Zeste d'agrume", "Cannelle"];
  } else if (/(amandes|noisettes|noix)/.test(n) && !/lait|puree|purée|beurre/.test(n)) {
    pool = ["Framboises", "Cacao non sucré", "Amandes effilées"];
  } else if (/lait/.test(n)) {
    pool = ["Lait d'amande non sucré", "Lait de soja", "Eau vanillée"];
  } else if (/farine/.test(n)) {
    pool = ["Farine de konjac", "Son d'avoine", "Poudre d'amande"];
  } else {
    pool = LIGHT_DESSERT_ALTS;
  }
  const picked = takeThree([...pool, ...LIGHT_DESSERT_ALTS], ingredientName, meal);
  if (picked.length >= 3) return picked;
  return takeThree(
    [...picked, ...pool, ...LIGHT_DESSERT_ALTS, "Vanille", "Zeste de citron"],
    ingredientName,
    meal,
  );
}

export function mockSuggestSwap(ingredientName: string, meal?: PlannedMeal): string[] {
  const n = ingredientName.toLowerCase();
  if (/galette|wrap|tortilla/.test(n)) {
    return takeThree(["Pain pita complet", "Wrap complet", "Naan nature", "Tortilla complète"], ingredientName, meal);
  }
  if (/pita|pain/.test(n)) {
    return takeThree(["Wrap complet", "Galette complète", "Naan nature"], ingredientName, meal);
  }
  if (/naan/.test(n)) {
    return takeThree(["Pain pita complet", "Wrap complet", "Galette complète"], ingredientName, meal);
  }
  if (/poulet|dinde|cabillaud|saumon|thon/.test(n)) {
    return takeThree(["Dinde", "Cabillaud", "Œufs"], ingredientName, meal);
  }
  if (/tofu/.test(n)) {
    return takeThree(["Edamame", "Pois chiches", "Lentilles"], ingredientName, meal);
  }

  const role = culinaryRole(ingredientName);
  if (role === "legume") {
    const family = vegFamily(ingredientName);
    const use = inferCookUse(ingredientName, meal);
    const pool = VEG_ALTS[family][use] ?? VEG_ALTS[family].default;
    const picked = takeThree(pool, ingredientName, meal);
    if (picked.length >= 3) return picked;
    return takeThree([...pool, ...VEG_ALTS[family].default, ...ROLE_ALTS.legume], ingredientName, meal);
  }

  return takeThree(ROLE_ALTS[role], ingredientName, meal);
}

export function suggestionsFitRole(original: string, suggestions: string[]): boolean {
  if (suggestions.length < 3) return false;
  const role = culinaryRole(original);
  if (role === "enveloppe") {
    return suggestions.every((item) => culinaryRole(item) === "enveloppe");
  }
  if (role === "proteine") {
    return suggestions.every((item) => culinaryRole(item) === "proteine");
  }
  if (role === "feculent") {
    return suggestions.every((item) => culinaryRole(item) === "feculent" || culinaryRole(item) === "enveloppe");
  }
  if (role === "legume") {
    return suggestions.every((item) => culinaryRole(item) === "legume");
  }
  return true;
}

export function suggestionsFitRecipe(
  original: string,
  suggestions: string[],
  meal?: PlannedMeal,
): boolean {
  if (!suggestionsFitRole(original, suggestions)) return false;
  if (meal && suggestions.some((item) => alreadyInMeal(meal, item))) return false;
  if (culinaryRole(original) !== "legume") return true;
  const family = vegFamily(original);
  if (family === "legume") return true;
  return suggestions.every((item) => {
    const other = vegFamily(item);
    if (other === family) return true;
    if (family === "racine-ferme" && other === "racine-douce") return true;
    if (family === "racine-douce" && other === "racine-ferme") return true;
    return false;
  });
}
