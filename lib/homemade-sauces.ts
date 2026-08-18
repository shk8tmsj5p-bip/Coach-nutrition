import type { PlannedMeal, RecipeIngredient } from "@/lib/types";
import { isRealTmWork } from "@/lib/recipe-copy";

type SaucePart = { name: string; frac: number; notes?: string; visual?: string };

type SauceDef = {
  test: (name: string) => boolean;
  alreadyHas: (meal: PlannedMeal) => boolean;
  parts: SaucePart[];
  step: string;
  baseReplace?: [RegExp, string];
};

function hasIng(meal: PlannedMeal, pattern: RegExp) {
  return meal.ingredients.some((item) => pattern.test(item.name));
}

/** Nom d'un pot / d'une sauce toute faite à éclater en sous-recette. */
export function isPreparedSauceName(name: string) {
  const n = name.trim();
  if (/sauce soja/i.test(n)) return false;
  return /satay|houmous|hummus|\bnuoc\b|\bpesto\b|\bpistou\b|vinaigrette|sauce tahini|tahini-citron|tahini citron/i.test(
    n,
  );
}

const SAUCES: SauceDef[] = [
  {
    test: (name) => /^houmous\b|hummus/i.test(name.trim()),
    alreadyHas: (meal) => hasIng(meal, /pois chiche/i) && hasIng(meal, /tahini|tahin/i),
    parts: [
      { name: "Pois chiches", frac: 0.55, visual: "1/2 boîte", notes: "égouttés" },
      { name: "Tahini", frac: 0.18, visual: "1 cs" },
      { name: "Citron", frac: 0.12, visual: "1/2 pièce", notes: "jus" },
      { name: "Ail", frac: 0.05, visual: "1 gousse" },
      { name: "Cumin", frac: 0.03, visual: "1/2 cc" },
      { name: "Eau", frac: 0.07, visual: "1 cs" },
    ],
    step: "Houmous maison : pois chiches, tahini, citron, ail, cumin, eau. 20 sec / V6, racler, 10 sec / V6.",
    baseReplace: [/\bhoumous\b/gi, "houmous maison"],
  },
  {
    test: (name) => /nuoc/i.test(name),
    alreadyHas: (meal) => hasIng(meal, /sauce soja/i) && hasIng(meal, /citron/i),
    parts: [
      { name: "Sauce soja", frac: 0.4, visual: "1 cs" },
      { name: "Citron vert", frac: 0.25, visual: "1/2 pièce", notes: "jus" },
      { name: "Ail", frac: 0.08, visual: "1 gousse" },
      { name: "Sirop d'agave", frac: 0.12, visual: "1 cc" },
      { name: "Eau", frac: 0.1, visual: "1 cs" },
      { name: "Gingembre frais", frac: 0.05, visual: "1 cm" },
    ],
    step: "Nuoc mam vegan maison : soja, citron vert, ail, agave, eau, gingembre. 10 sec / V6, racler, 5 sec / V6.",
  },
  {
    test: (name) => /vinaigrette/i.test(name.trim()),
    alreadyHas: (meal) =>
      hasIng(meal, /moutarde/i) && hasIng(meal, /citron|vinaigre/i) && hasIng(meal, /huile/i),
    parts: [
      { name: "Moutarde", frac: 0.15, visual: "1 cc" },
      { name: "Citron", frac: 0.35, visual: "1/2 pièce", notes: "jus" },
      { name: "Huile d'olive", frac: 0.5, visual: "1 cs" },
    ],
    step: "Vinaigrette maison : moutarde, jus de citron, huile d'olive. Fouetter dans un pot hermétique.",
  },
  {
    test: (name) => /^pistou\b/i.test(name.trim()),
    alreadyHas: (meal) => hasIng(meal, /basilic/i) && hasIng(meal, /ail/i) && hasIng(meal, /huile/i),
    parts: [
      { name: "Basilic", frac: 0.45, visual: "1/2 botte" },
      { name: "Ail", frac: 0.1, visual: "1 gousse" },
      { name: "Huile d'olive", frac: 0.45, visual: "1 cs" },
    ],
    step: "Pistou : basilic, ail, huile d'olive. 15 sec / V6, racler, 10 sec / V6.",
  },
  {
    test: (name) => /satay/i.test(name),
    alreadyHas: (meal) =>
      hasIng(meal, /tahini|tahin|beurre de s[eé]same/i) &&
      hasIng(meal, /sauce soja/i) &&
      hasIng(meal, /citron/i),
    parts: [
      { name: "Beurre de sésame", frac: 0.4, visual: "1 cs" },
      { name: "Sauce soja", frac: 0.22, visual: "1 cs" },
      { name: "Citron", frac: 0.16, visual: "1/2 pièce", notes: "jus" },
      { name: "Gingembre frais", frac: 0.1, visual: "1 cm" },
      { name: "Sirop d'agave", frac: 0.08, visual: "1 cc" },
      { name: "Ail", frac: 0.04, visual: "1 gousse" },
    ],
    step: "Sauce satay maison : beurre de sésame 1 cs, sauce soja 1 cs, jus de citron 1/2, gingembre 1 cm, agave 1 cc, ail. 15 sec / V6. Racler. 10 sec / V6. Pots hermétiques.",
    baseReplace: [/\bsatay\b/gi, "sauce satay maison"],
  },
  {
    test: (name) => /\bpesto\b/i.test(name) && !/pistou/i.test(name),
    alreadyHas: (meal) => hasIng(meal, /basilic/i) && hasIng(meal, /ail/i) && hasIng(meal, /huile/i),
    parts: [
      { name: "Basilic", frac: 0.4, visual: "1/2 botte" },
      { name: "Ail", frac: 0.08, visual: "1 gousse" },
      { name: "Huile d'olive", frac: 0.4, visual: "1 cs" },
      { name: "Noix", frac: 0.12, visual: "1 cs" },
    ],
    step: "Pesto maison : basilic, ail, huile d'olive, noix. 15 sec / V6, racler, 10 sec / V6.",
  },
  {
    test: (name) => /tahini|tahin/i.test(name) && /sauce|citron/i.test(name),
    alreadyHas: (meal) =>
      hasIng(meal, /^(tahini|tahin|beurre de s[eé]same)$/i) && hasIng(meal, /citron/i),
    parts: [
      { name: "Tahini", frac: 0.45, visual: "1 cs" },
      { name: "Citron", frac: 0.25, visual: "1/2 pièce", notes: "jus" },
      { name: "Eau", frac: 0.2, visual: "1 cs" },
      { name: "Ail", frac: 0.1, visual: "1 gousse" },
    ],
    step: "Sauce tahini-citron maison : tahini, jus de citron, eau, ail. Fouetter dans un pot hermétique.",
  },
];

function slug(itemId: string, name: string, index: number) {
  return `${itemId}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 20)}-${index}`;
}

function ingredientNamePattern(name: string) {
  const distinctive = name
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 2 && !/^(sauce|huile|jus|de|d)$/i.test(token));
  const needle = (distinctive[distinctive.length - 1] ?? name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(needle, "i");
}

/** Remplace un pot / une bouteille du commerce par la sous-recette maison. */
export function expandPreparedSauces(meal: PlannedMeal): PlannedMeal {
  const next: RecipeIngredient[] = [];
  const extraSteps: string[] = [];
  let sharedBase = meal.sharedBase;
  let expanded = false;

  for (const item of meal.ingredients) {
    const sauce = SAUCES.find((def) => def.test(item.name));
    if (!sauce) {
      next.push(item);
      continue;
    }
    if (sauce.alreadyHas(meal)) continue;
    expanded = true;
    const baseA = item.gramsAlexis > 0 ? item.gramsAlexis : 30;
    const baseE = item.gramsElodie > 0 ? item.gramsElodie : 25;
    sauce.parts.forEach((part, index) => {
      const gramsAlexis = Math.max(1, Math.round(baseA * part.frac));
      const gramsElodie = Math.max(1, Math.round(baseE * part.frac));
      next.push({
        id: slug(item.id, part.name, index),
        name: part.name,
        role: item.role,
        gramsAlexis,
        gramsElodie,
        visualQuantity: part.visual,
        notes: part.notes,
      });
    });
    if (!meal.steps.some((line) => line.toLowerCase().includes(sauce.step.slice(0, 18).toLowerCase()))) {
      extraSteps.push(sauce.step);
    }
    if (sauce.baseReplace) {
      sharedBase = sharedBase.replace(sauce.baseReplace[0], sauce.baseReplace[1]);
    }
  }

  const withParts = expanded
    ? {
        ...meal,
        ingredients: next,
        sharedBase,
      }
    : meal;

  return ensureNamedSauce(
    injectMissingSauceFromSteps({
      ...withParts,
      steps:
        extraSteps.length === 0
          ? withParts.steps
          : withParts.steps.some((line) => /^§\s*thermomix/i.test(line))
            ? [...withParts.steps, ...extraSteps]
            : [...withParts.steps, "§ Thermomix", ...extraSteps],
      appliances: extraSteps.length
        ? [...new Set([...withParts.appliances, "Thermomix" as const])]
        : withParts.appliances,
    }),
  );
}

type StepSauce = {
  detect: RegExp;
  mixLine: string;
  tm: boolean;
  parts: Array<{ name: string; gramsAlexis: number; gramsElodie: number; visual?: string; notes?: string }>;
};

const STEP_SAUCES: StepSauce[] = [
  {
    detect: /vinaigrette|moutarde-citron|moutarde citron|moutarde-vinaigre/i,
    mixLine: "Vinaigrette maison : moutarde, citron, huile. Fouetter dans un pot hermétique.",
    tm: false,
    parts: [
      { name: "Moutarde", gramsAlexis: 8, gramsElodie: 6, visual: "1 cc" },
      { name: "Citron", gramsAlexis: 20, gramsElodie: 16, visual: "1/2 pièce", notes: "jus" },
      { name: "Huile d'olive", gramsAlexis: 10, gramsElodie: 8, visual: "1 cs" },
    ],
  },
  {
    detect: /pistou/i,
    mixLine: "Pistou : basilic, ail, huile d'olive. 15 sec / V6. Racler. 10 sec / V6. Pots hermétiques.",
    tm: true,
    parts: [
      { name: "Basilic", gramsAlexis: 15, gramsElodie: 12, visual: "1/2 botte" },
      { name: "Ail", gramsAlexis: 6, gramsElodie: 5, visual: "1 gousse" },
      { name: "Huile d'olive", gramsAlexis: 12, gramsElodie: 10, visual: "1 cs" },
    ],
  },
  {
    detect: /satay/i,
    mixLine:
      "Sauce satay maison : beurre de sésame 1 cs, sauce soja 1 cs, jus de citron, gingembre 1 cm, agave 1 cc, ail. 15 sec / V6. Racler. 10 sec / V6. Pots hermétiques.",
    tm: true,
    parts: [
      { name: "Beurre de sésame", gramsAlexis: 18, gramsElodie: 15, visual: "1 cs" },
      { name: "Sauce soja", gramsAlexis: 12, gramsElodie: 10, visual: "1 cs" },
      { name: "Citron", gramsAlexis: 12, gramsElodie: 10, visual: "1/2 pièce", notes: "jus" },
      { name: "Gingembre frais", gramsAlexis: 8, gramsElodie: 6, visual: "1 cm" },
      { name: "Sirop d'agave", gramsAlexis: 5, gramsElodie: 4, visual: "1 cc" },
      { name: "Ail", gramsAlexis: 5, gramsElodie: 4, visual: "1 gousse" },
    ],
  },
  {
    detect: /pesto/i,
    mixLine: "Pesto maison : basilic, ail, huile d'olive, noix. 15 sec / V6. Racler. 10 sec / V6. Pots hermétiques.",
    tm: true,
    parts: [
      { name: "Basilic", gramsAlexis: 16, gramsElodie: 14, visual: "1/2 botte" },
      { name: "Ail", gramsAlexis: 6, gramsElodie: 5, visual: "1 gousse" },
      { name: "Huile d'olive", gramsAlexis: 12, gramsElodie: 10, visual: "1 cs" },
      { name: "Noix", gramsAlexis: 8, gramsElodie: 6, visual: "1 cs" },
    ],
  },
];

/** Si l'étape cite une sauce mais les composants n'y sont pas, on les ajoute. */
export function injectMissingSauceFromSteps(meal: PlannedMeal): PlannedMeal {
  const blob = `${meal.baseName} ${meal.sharedBase} ${meal.steps.join(" ")}`;
  const extra: RecipeIngredient[] = [];
  let mixLine = "";
  let needsTm = false;
  for (const sauce of STEP_SAUCES) {
    if (!sauce.detect.test(blob)) continue;
    let added = false;
    for (const part of sauce.parts) {
      const known = [...meal.ingredients, ...extra];
      if (hasIng({ ...meal, ingredients: known }, ingredientNamePattern(part.name))) continue;
      if (part.name === "Citron" && /vinaigre/i.test(blob) && !/citron/i.test(blob)) continue;
      extra.push({
        id: slug("sauce", part.name, extra.length),
        name: part.name,
        role: "shared",
        gramsAlexis: part.gramsAlexis,
        gramsElodie: part.gramsElodie,
        visualQuantity: part.visual,
        notes: part.notes,
      });
      added = true;
    }
    if (added) {
      mixLine = sauce.mixLine;
      needsTm = sauce.tm && !meal.steps.some(isRealTmWork);
    }
  }
  if (extra.length === 0) return meal;
  const hasMix = mixLine
    ? meal.steps.some((line) => line.toLowerCase().includes(mixLine.slice(0, 22).toLowerCase()))
    : true;
  const steps = hasMix
    ? meal.steps
    : needsTm
      ? meal.steps.some((line) => /^§\s*thermomix/i.test(line))
        ? [...meal.steps, mixLine]
        : [...meal.steps, "§ Thermomix", mixLine]
      : meal.steps.some((line) => /assemblage|kitchenaid|découpe/i.test(line))
        ? [...meal.steps, mixLine]
        : [...meal.steps, "§ Découpes KitchenAid & Assemblage", mixLine];
  const sharedBase = [
    meal.sharedBase,
    ...extra.map((item) => item.name.toLowerCase()).filter((name) => !meal.sharedBase.toLowerCase().includes(name)),
  ].join(", ");
  return {
    ...meal,
    ingredients: [...meal.ingredients, ...extra],
    sharedBase,
    steps,
    appliances: needsTm ? [...new Set([...meal.appliances, "Thermomix" as const])] : meal.appliances,
  };
}

const NAMED_SAUCE_RE =
  /vinaigrette|marinade|sauce |pesto|pistou|tahini|tahin|houmous|satay|nuoc|chermoula|yassa|teriyaki|raifort|miso|velouté|veloute|gazpacho|soupe |aïoli|aioli|gremolata|salsa|pistou/i;

export function mealHasNamedSauce(meal: PlannedMeal) {
  return NAMED_SAUCE_RE.test(
    `${meal.baseName} ${meal.sharedBase} ${meal.ingredients.map((item) => item.name).join(" ")}`,
  );
}

/** Garantit une sauce/vinaigrette nommée + ses composants, jamais un plat sec. */
export function ensureNamedSauce(meal: PlannedMeal): PlannedMeal {
  if (!meal.ingredients.length || meal.baseName === "Aucun repas") return meal;
  if (mealHasNamedSauce(meal)) return meal;
  const extra: RecipeIngredient[] = STEP_SAUCES[0].parts.map((part, index) => ({
    id: slug("binder", part.name, index),
    name: part.name,
    role: "shared" as const,
    gramsAlexis: part.gramsAlexis,
    gramsElodie: part.gramsElodie,
    visualQuantity: part.visual,
    notes: part.notes,
  }));
  const mixLine =
    "Vinaigrette citron-moutarde : moutarde, jus de citron, huile d'olive. Fouetter dans un pot hermétique.";
  const hasMix = meal.steps.some((line) => /vinaigrette citron-moutarde|fouetter dans un pot/i.test(line));
  const steps = hasMix
    ? meal.steps
    : meal.steps.some((line) => /assemblage|kitchenaid|découpe/i.test(line))
      ? [...meal.steps, mixLine]
      : [...meal.steps, "§ Découpes KitchenAid & Assemblage", mixLine];
  const title = /vinaigrette|sauce|marinade/i.test(meal.baseName)
    ? meal.baseName
    : `${meal.baseName.replace(/\s*,\s*$/, "")}, vinaigrette citron-moutarde`;
  return {
    ...meal,
    baseName: title,
    ingredients: [...meal.ingredients, ...extra],
    sharedBase: [meal.sharedBase, "vinaigrette citron-moutarde"].filter(Boolean).join(", "),
    steps,
  };
}
