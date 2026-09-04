import { extraRecipes, WEEK_DAYS, weeklyPlan as seedPlan } from "@/lib/weekly-plan-seed";
import { sanitizeCopy, stripAversionPhrases, isAversionMention, isFluffLine, isStepSection, stepSectionLabel, isRealTmWork, isWorthTmMix, rewriteTmAsHandMix, isKitchenAidCut, isLogisticsTip } from "@/lib/recipe-copy";
import { visualForIngredient } from "@/lib/visual-quantity";
import { expandPreparedSauces } from "@/lib/homemade-sauces";
import { capVegetablePortions } from "@/lib/meal-coach";
import { ensureFalafelAirfryer, repairMealIntegrity } from "@/lib/recipe-integrity";
import { declinationFromIngredients } from "@/lib/recipe-macros";
import { adaptMealToTheme, conflictsWithTheme, matchKit, mealMatchesTheme, stripThemeSticker } from "@/lib/theme-kits";
import { mockSuggestSwap as coherentSuggestSwap } from "@/lib/swap-coherence";
import { normalizeTitle, pickUnused } from "@/lib/recipe-diversity";
import type { MealType, PlannedMeal, RecipeIngredient } from "@/lib/types";

export { WEEK_DAYS, extraRecipes };

export const WEEKDAY_INDEXES = [0, 1, 2, 3, 4];
export const WEEKEND_INDEXES = [5, 6];

export type GenerateRange = "weekday" | "weekend";

export type BatchPair = {
  key: string;
  slotIds: string[];
  label: string;
  mealType: "dejeuner" | "diner";
  lowCalorie: boolean;
};

/** Lun–Ven : 1 recette batch = 2 repas / personne, jours ALTERNÉS (jamais consécutifs). */
export const WEEKDAY_BATCHES: BatchPair[] = [
  {
    key: "lunch-mon-wed",
    slotIds: ["mon-lunch", "wed-lunch"],
    label: "Lun + Mer déjeuner",
    mealType: "dejeuner",
    lowCalorie: false,
  },
  {
    key: "lunch-tue-thu",
    slotIds: ["tue-lunch", "thu-lunch"],
    label: "Mar + Jeu déjeuner",
    mealType: "dejeuner",
    lowCalorie: false,
  },
  {
    key: "dinner-mon-wed",
    slotIds: ["mon-dinner", "wed-dinner"],
    label: "Lun + Mer dîner",
    mealType: "diner",
    lowCalorie: true,
  },
  {
    key: "dinner-tue-thu",
    slotIds: ["tue-dinner", "thu-dinner"],
    label: "Mar + Jeu dîner",
    mealType: "diner",
    lowCalorie: true,
  },
  {
    key: "fri-lunch-dinner",
    slotIds: ["fri-lunch", "fri-dinner"],
    label: "Ven déjeuner + Ven dîner",
    mealType: "dejeuner",
    lowCalorie: false,
  },
];

const CATALOG: PlannedMeal[] = [...seedPlan, ...extraRecipes];

export function pairForSlot(slotId: string): BatchPair | null {
  return WEEKDAY_BATCHES.find((pair) => pair.slotIds.includes(slotId)) ?? null;
}

export function isWeekendSlot(meal: PlannedMeal) {
  return WEEKEND_INDEXES.includes(meal.dayIndex);
}

function sanitizeMeal(meal: PlannedMeal): PlannedMeal {
  const expanded = expandPreparedSauces({
    ...meal,
    baseName: stripThemeSticker(meal.baseName, meal.theme),
    sharedBase: stripAversionPhrases(meal.sharedBase),
    ingredients: meal.ingredients
      .filter(
        (item) =>
          !/coriandre|chou-fleur|piment fort|jalape[nñ]o|cayenne|past[eè]que|fenouil|beurre de cacahu[eè]te|mangue|seitan|tempeh/i.test(
            item.name,
          ),
      )
      .map((item) => {
        const grams = Math.max(item.gramsAlexis, item.gramsElodie);
        const nameRaw =
          /nuoc/i.test(item.name) && /v[ée]g[ée]|bouteille|commerce/i.test(item.name)
            ? "Nuoc mam vegan maison"
            : item.name;
        const name = /falafel/i.test(nameRaw)
          ? nameRaw.replace(/\s*marin[ée]e?s?\b/gi, "").replace(/\s{2,}/g, " ").trim() || nameRaw
          : nameRaw;
        const visualHint =
          item.visualQuantity ||
          (item.notes && /pièce|botte|barquette|gousse|brin|cc|cs|tranche|cm\b/i.test(item.notes)
            ? item.notes
            : undefined);
        return {
          ...item,
          name,
          notes: sanitizeCopy(item.notes),
          visualQuantity: visualForIngredient(name, grams, visualHint),
        };
      }),
    steps: meal.steps
      .map((line) => stripAversionPhrases(line))
      .filter((line) => line && !isAversionMention(line) && !isFluffLine(line)),
    tips: meal.tips
      .map((line) => sanitizeCopy(line))
      .filter((line): line is string => Boolean(line) && isLogisticsTip(line)),
    cautions: [],
  });
  const repaired = capVegetablePortions(repairMealIntegrity(expanded));
  const clean = ensureFalafelAirfryer(
    deriveAppliances(
      dropColdAirfryer(rewriteRiceCooker(scrubForcedRobots(scrubWeekdayTofuAirfryer(repaired)))),
    ),
  );
  return {
    ...clean,
    alexis: declinationFromIngredients(clean.ingredients, "alexis"),
    elodie: declinationFromIngredients(clean.ingredients, "elodie"),
  };
}

function isTofuCookSentence(line: string) {
  return (
    /tofu/i.test(line) &&
    /\d+\s*°c|\d+\s*min|airfryer|rôti|cuire/i.test(line) &&
    !/presser|mariner|frais|réserver|frigo|froid|hors panier/i.test(line)
  );
}

function isRealAirfryerLine(line: string) {
  if (/tofu/i.test(line) && /hors panier|presser|mariner|frais|réserver/i.test(line)) return false;
  if (/pas d['’]?airfryer|pas de cuisson airfryer/i.test(line)) return false;
  return /\d+\s*°c|airfryer/i.test(line);
}

/** Week-end → Lun–Ven : tofu pressé / mariné, pas cuit (sauf dessert). */
export function adaptReplayMeal(meal: PlannedMeal, targetDayIndex: number): PlannedMeal {
  const next = { ...structuredClone(meal), dayIndex: targetDayIndex };
  if (WEEKEND_INDEXES.includes(targetDayIndex)) return next;
  return scrubWeekdayTofuAirfryer(next);
}

export function weekendReplayNotice(meal: PlannedMeal) {
  if (!isWeekendSlot(meal)) return undefined;
  const tofu = meal.ingredients.some((item) => /tofu/i.test(item.name));
  if (tofu) {
    return "Plat de week-end : en semaine, tofu pressé et mariné (pas cuit comme le dimanche). Même recette, quantités d’aujourd’hui.";
  }
  return "Plat de week-end : en semaine, même recette, quantités recalées. Ce n’est pas un nouveau batch.";
}

function scrubWeekdayTofuAirfryer(meal: PlannedMeal): PlannedMeal {
  if (WEEKEND_INDEXES.includes(meal.dayIndex)) return meal;
  if (!meal.ingredients.some((item) => /tofu/i.test(item.name))) return tidyStepSections(meal);
  if (/dessert|gâteau|gateau|brownie|cake|muffin/i.test(`${meal.baseName} ${meal.steps.join(" ")}`)) {
    return tidyStepSections(meal);
  }

  const fresh = "Tofu : presser, mariner, réserver au frais.";
  const out: string[] = [];
  let section: string | null = null;
  let bucket: string[] = [];
  const tofuBits: string[] = [];

  function flush() {
    if (section) {
      const isAf = /airfryer/i.test(section);
      const keep = isAf ? bucket.filter(isRealAirfryerLine) : bucket;
      const leftoverTofu = isAf
        ? bucket.filter((line) => /tofu/i.test(line) && !isTofuCookSentence(line) && !isRealAirfryerLine(line))
        : [];
      tofuBits.push(...leftoverTofu);
      if (keep.length > 0) {
        out.push(`§ ${section}`, ...keep);
      }
    } else {
      out.push(...bucket);
    }
    bucket = [];
  }

  for (const line of meal.steps) {
    if (isStepSection(line)) {
      flush();
      section = stepSectionLabel(line);
      continue;
    }
    const parts = line.split(/(?<=[.!?])\s+/).map((item) => item.trim()).filter(Boolean);
    for (const sentence of parts.length ? parts : [line]) {
      if (/tofu/i.test(sentence) && isTofuCookSentence(sentence)) {
        tofuBits.push(fresh);
        continue;
      }
      if (/tofu/i.test(sentence) && /hors panier|presser|mariner|frais|réserver/i.test(sentence)) {
        tofuBits.push(sentence === "Tofu hors panier." ? fresh : sentence);
        continue;
      }
      bucket.push(sentence);
    }
  }
  flush();

  const tofuLine = tofuBits.find((line) => /presser|mariner|frais/i.test(line)) ?? fresh;
  if (!out.some((line) => /tofu/i.test(line) && /presser|mariner|frais/i.test(line))) {
    const idx = out.findIndex((line) => /assemblage|kitchenaid/i.test(line));
    if (idx >= 0) out.splice(idx + 1, 0, tofuLine);
    else out.push("§ Découpes KitchenAid & Assemblage", tofuLine);
  }

  return tidyStepSections({
    ...meal,
    steps: out.filter((line, index) => out.indexOf(line) === index),
    appliances: out.some((line) => isRealAirfryerLine(line))
      ? meal.appliances
      : meal.appliances.filter((item) => item !== "Airfryer"),
  });
}

function tidyStepSections(meal: PlannedMeal): PlannedMeal {
  const steps: string[] = [];
  for (let i = 0; i < meal.steps.length; i += 1) {
    const line = meal.steps[i];
    if (!isStepSection(line)) {
      steps.push(line);
      continue;
    }
    const body: string[] = [];
    let j = i + 1;
    while (j < meal.steps.length && !isStepSection(meal.steps[j])) {
      body.push(meal.steps[j]);
      j += 1;
    }
    const useful = body.filter((item) => item.trim());
    const airfryerEmpty =
      /airfryer/i.test(line) && useful.every((item) => !isRealAirfryerLine(item));
    const tmEmpty = /thermomix/i.test(line) && useful.every((item) => !isRealTmWork(item));
    if (useful.length > 0 && !airfryerEmpty && !tmEmpty) {
      steps.push(line, ...useful);
    } else if (airfryerEmpty) {
      steps.push(...useful.filter((item) => /tofu/i.test(item)));
    } else if (tmEmpty) {
      steps.push(...useful.filter((item) => !/cumin|paprika|ajouter les épices|mélanger les épices/i.test(item)));
    }
    i = j - 1;
  }
  return { ...meal, steps };
}

function scrubForcedRobots(meal: PlannedMeal): PlannedMeal {
  const out: string[] = [];
  let section: string | null = null;
  let bucket: string[] = [];
  const leftover: string[] = [];

  function flush() {
    if (!section) {
      out.push(...bucket);
      bucket = [];
      return;
    }
    const isTm = /thermomix/i.test(section);
    if (isTm) {
      const worth = isWorthTmMix(bucket.join(" "));
      if (!worth) {
        leftover.push(...bucket.map(rewriteTmAsHandMix).filter(Boolean));
      } else {
        leftover.push(...bucket.filter((line) => !isRealTmWork(line)));
        const keep = bucket.filter(isRealTmWork);
        if (keep.length > 0) out.push(`§ ${section}`, ...keep);
      }
      bucket = [];
      return;
    }
    if (bucket.length > 0) out.push(`§ ${section}`, ...bucket);
    bucket = [];
  }

  for (const line of meal.steps) {
    if (isStepSection(line)) {
      flush();
      section = stepSectionLabel(line);
      continue;
    }
    bucket.push(line);
  }
  flush();

  if (leftover.length > 0) {
    const idx = out.findIndex((line) => /assemblage|kitchenaid|découpe/i.test(line));
    if (idx >= 0) out.splice(idx + 1, 0, ...leftover);
    else out.push("§ Découpes KitchenAid & Assemblage", ...leftover);
  }

  return tidyStepSections({ ...meal, steps: out });
}

function deriveAppliances(meal: PlannedMeal): PlannedMeal {
  const text = meal.steps.join(" ").toLowerCase();
  const notes = meal.ingredients.map((item) => `${item.name} ${item.notes ?? ""}`).join(" ").toLowerCase();
  const cold = /gazpacho|soupe froide|carpaccio|salade froide/.test(`${meal.baseName} ${text}`);
  const list: PlannedMeal["appliances"] = [];
  if (meal.steps.some(isRealTmWork)) list.push("Thermomix");
  if (/cookeo/.test(text)) list.push("Cookeo");
  if (/cuiseur à riz/.test(text) || /\briz\b/.test(`${text} ${notes}`)) {
    list.push("Cuiseur à riz");
  }
  if (!cold && /airfryer/.test(text) && /\d+\s*°c/.test(text)) list.push("Airfryer");
  if (/four|chaleur tournante/.test(text)) list.push("Four");
  if (meal.steps.some(isKitchenAidCut) || /râpé fin|lamelles|spaghettis/.test(`${text} ${notes}`)) {
    list.push("KitchenAid");
  }
  if (/poêle|plaque/.test(text)) list.push("Plaque");
  const unique = [...new Set(list)];
  return { ...meal, appliances: unique };
}

function rewriteRiceCooker(meal: PlannedMeal): PlannedMeal {
  const hasRice =
    meal.ingredients.some((item) => /\briz\b/i.test(item.name)) ||
    meal.steps.some((line) => /\briz\b/i.test(line));
  if (!hasRice) return meal;
  const steps = meal.steps.map((line) =>
    /\briz\b/i.test(line) ? line.replace(/\bcookeo\b/gi, "cuiseur à riz") : line,
  );
  const ingredients = meal.ingredients.map((item) => {
    if (!/\briz\b/i.test(`${item.name} ${item.notes ?? ""}`)) return item;
    return { ...item, notes: item.notes?.replace(/\bcookeo\b/gi, "cuiseur à riz") };
  });
  const stillCookeo = [...steps, ...ingredients.map((item) => item.notes ?? "")].some((text) =>
    /cookeo/i.test(text),
  );
  const appliances = meal.appliances.includes("Cuiseur à riz")
    ? meal.appliances
    : [...meal.appliances, "Cuiseur à riz" as const];
  return {
    ...meal,
    steps,
    ingredients,
    appliances: stillCookeo ? appliances : appliances.filter((item) => item !== "Cookeo"),
  };
}

function dropColdAirfryer(meal: PlannedMeal): PlannedMeal {
  const blob = `${meal.baseName} ${meal.steps.join(" ")}`.toLowerCase();
  if (!/gazpacho|soupe froide|carpaccio|salade froide|toast protéiné/.test(blob)) return meal;
  const steps: string[] = [];
  let skip = false;
  for (const line of meal.steps) {
    if (isStepSection(line)) {
      skip = /airfryer/i.test(line);
      if (skip) continue;
    } else if (skip || /airfryer/i.test(line)) {
      continue;
    }
    steps.push(line);
  }
  return {
    ...meal,
    steps,
    appliances: meal.appliances.filter((item) => item !== "Airfryer"),
  };
}

export function annotatePlan(plan: PlannedMeal[]): PlannedMeal[] {
  return plan.map((slot) => {
    const clean = sanitizeMeal(slot);
    const pair = pairForSlot(clean.id);
    if (!pair) {
      return {
        ...clean,
        servingsPerPerson: 1,
        batchId: clean.id,
        coverLabel: "1 repas frais",
      };
    }
    return {
      ...clean,
      servingsPerPerson: 2,
      batchId: pair.key,
      coverLabel: pair.label,
      lowCalorie: pair.lowCalorie || clean.mealType === "diner",
    };
  });
}

export function defaultWeekPlan(): PlannedMeal[] {
  return annotatePlan(structuredClone(seedPlan));
}

const EMPTY_DECL = {
  protein: "—",
  calories: 0,
  proteinG: 0,
  carbsG: 0,
  fatG: 0,
};

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export function isEmptyMeal(meal: PlannedMeal) {
  return (
    meal.ingredients.length === 0 ||
    meal.baseName === "Aucun repas" ||
    (meal.alexis.calories === 0 && meal.elodie.calories === 0 && meal.steps.length === 0)
  );
}

export function emptyMealForSlot(slot: Pick<PlannedMeal, "id" | "day" | "dayIndex" | "mealType">): PlannedMeal {
  return {
    id: slot.id,
    day: slot.day,
    dayIndex: slot.dayIndex,
    mealType: slot.mealType,
    baseName: "Aucun repas",
    sharedBase: "Génère un repas pour remplir ce créneau.",
    theme: "Base",
    appliances: [],
    servingsPerPerson: 1,
    batchId: slot.id,
    coverLabel: "",
    ingredients: [],
    steps: [],
    tips: [],
    cautions: [],
    alexis: { ...EMPTY_DECL },
    elodie: { ...EMPTY_DECL },
    lowCalorie: slot.mealType === "diner",
  };
}

/** Vessel for Today Remplacement — PD/collation reuse a lunch-shaped slot. */
export function dummyTodaySwapSlot(mealType: MealType): PlannedMeal {
  const plan = emptyWeekPlan();
  const dinner = plan.find((meal) => meal.dayIndex === 0 && meal.mealType === "diner");
  const lunch = plan.find((meal) => meal.dayIndex === 0 && meal.mealType === "dejeuner");
  return mealType === "diner" ? dinner ?? lunch! : lunch!;
}

export function emptyWeekPlan(): PlannedMeal[] {
  const slots = WEEK_DAYS.flatMap((day, dayIndex) => [
    emptyMealForSlot({
      id: `${DAY_KEYS[dayIndex]}-lunch`,
      day,
      dayIndex,
      mealType: "dejeuner",
    }),
    emptyMealForSlot({
      id: `${DAY_KEYS[dayIndex]}-dinner`,
      day,
      dayIndex,
      mealType: "diner",
    }),
  ]);
  return annotatePlan(slots);
}

export function clearMealsInPlan(plan: PlannedMeal[], slotId: string): PlannedMeal[] {
  const pair = pairForSlot(slotId);
  const ids = new Set(pair?.slotIds ?? [slotId]);
  return annotatePlan(plan.map((slot) => (ids.has(slot.id) ? emptyMealForSlot(slot) : slot)));
}

export function moveMealInPlan(
  plan: PlannedMeal[],
  fromId: string,
  target: { dayIndex: number; mealType: "dejeuner" | "diner" },
): PlannedMeal[] {
  const from = plan.find((meal) => meal.id === fromId);
  const to = plan.find((meal) => meal.dayIndex === target.dayIndex && meal.mealType === target.mealType);
  if (!from || !to || from.id === to.id) return plan;
  const fromRecipe = structuredClone(from);
  const toRecipe = structuredClone(to);
  return annotatePlan(
    plan.map((slot) => {
      if (slot.id === from.id) return cloneMealIntoSlot(toRecipe, slot);
      if (slot.id === to.id) return cloneMealIntoSlot(fromRecipe, slot);
      return slot;
    }),
  );
}

export function cloneMealIntoSlot(source: PlannedMeal, slot: PlannedMeal): PlannedMeal {
  return {
    ...structuredClone(source),
    id: slot.id,
    day: slot.day,
    dayIndex: slot.dayIndex,
    mealType: slot.mealType,
  };
}

export function applyTheme(meal: PlannedMeal, theme: string): PlannedMeal {
  const next = theme.trim();
  if (!next) return { ...meal, theme: meal.theme || "Base", baseName: stripThemeSticker(meal.baseName, meal.theme) };
  return adaptMealToTheme(
    {
      ...meal,
      tips: meal.tips.filter((tip) => !/^Thème demandé/i.test(tip)),
    },
    next,
  );
}

export function applyRecipeToSlots(
  plan: PlannedMeal[],
  slotIds: string[],
  recipe: PlannedMeal,
  theme: string,
): PlannedMeal[] {
  const pair = pairForSlot(slotIds[0] ?? "");
  return annotatePlan(
    plan.map((slot) => {
      if (!slotIds.includes(slot.id)) return slot;
      const next = applyTheme(cloneMealIntoSlot(recipe, slot), theme);
      return {
        ...next,
        batchId: pair?.key ?? slot.id,
        coverLabel: pair?.label ?? "1 repas frais",
        servingsPerPerson: pair ? 2 : 1,
        lowCalorie: pair ? pair.lowCalorie || slot.mealType === "diner" : slot.lowCalorie,
      };
    }),
  );
}

/** Pose une recette telle quelle (favori) — pas de réadaptation de thème. */
export function placeRecipeInSlots(plan: PlannedMeal[], slotIds: string[], recipe: PlannedMeal): PlannedMeal[] {
  const pair = pairForSlot(slotIds[0] ?? "");
  return annotatePlan(
    plan.map((slot) => {
      if (!slotIds.includes(slot.id)) return slot;
      const next = cloneMealIntoSlot(recipe, slot);
      return {
        ...next,
        batchId: pair?.key ?? slot.id,
        coverLabel: pair?.label ?? "1 repas frais",
        servingsPerPerson: pair ? 2 : 1,
        lowCalorie: pair ? pair.lowCalorie || slot.mealType === "diner" : slot.lowCalorie,
      };
    }),
  );
}

function poolFor(
  mealType: PlannedMeal["mealType"],
  theme: string,
  pastMeals: string[] = [],
  opts?: { lowCalorie?: boolean },
): PlannedMeal[] {
  let all = CATALOG.filter((meal) => meal.mealType === mealType);
  if (opts?.lowCalorie) {
    const low = all.filter((meal) => meal.lowCalorie);
    if (low.length > 0) all = low;
  } else if (opts?.lowCalorie === false) {
    const normal = all.filter((meal) => !meal.lowCalorie);
    if (normal.length > 0) all = normal;
  }
  const needle = theme.trim();
  let base = all;
  if (needle) {
    const themed = all.filter((meal) => mealMatchesTheme(meal, theme));
    if (themed.length > 0) {
      base = themed;
    } else {
      const kit = matchKit(theme);
      base = kit ? [] : all.filter((meal) => !conflictsWithTheme(meal, theme));
    }
  }
  const avoid = new Set(pastMeals.map((title) => title.trim().toLowerCase()).filter(Boolean));
  if (avoid.size === 0) return base;
  const fresh = base.filter((meal) => !avoid.has(meal.baseName.toLowerCase()));
  return fresh.length > 0 ? fresh : base;
}

function pickFromPool(
  mealType: PlannedMeal["mealType"],
  theme: string,
  used: string[],
  nonce: number,
  index: number,
  lowCalorie?: boolean,
) {
  const themed = poolFor(mealType, theme, used, { lowCalorie });
  const picked = pickUnused(themed, used, nonce, index) ?? themed[0];
  if (picked) return picked;
  if (theme.trim()) return undefined;
  const fallback = poolFor(mealType, "", used, { lowCalorie });
  return pickUnused(fallback, used, nonce, index) ?? fallback[0];
}

export function mockGenerateRange(
  plan: PlannedMeal[],
  range: GenerateRange,
  theme: string,
  nonce: number,
  pastMeals: string[] = [],
): PlannedMeal[] {
  const used = [...pastMeals];
  if (range === "weekend") {
    return annotatePlan(
      plan.map((slot, index) => {
        if (!WEEKEND_INDEXES.includes(slot.dayIndex)) return slot;
        const picked = pickFromPool(
          slot.mealType,
          theme,
          used,
          nonce,
          index,
          slot.mealType === "diner" || slot.lowCalorie,
        );
        if (!picked) return slot;
        used.push(picked.baseName);
        return {
          ...applyTheme(cloneMealIntoSlot(picked, slot), theme),
          servingsPerPerson: 1 as const,
          batchId: slot.id,
          coverLabel: "1 repas frais",
          lowCalorie: slot.mealType === "diner" || slot.lowCalorie,
        };
      }),
    );
  }

  let next = plan;
  WEEKDAY_BATCHES.forEach((pair, index) => {
    const picked = pickFromPool(pair.mealType, theme, used, nonce, index, pair.lowCalorie);
    if (!picked) return;
    used.push(picked.baseName);
    next = applyRecipeToSlots(next, pair.slotIds, picked, theme);
  });
  return next;
}

export function mockGenerateSingle(
  plan: PlannedMeal[],
  slotId: string,
  theme: string,
  nonce: number,
  pastMeals: string[] = [],
): PlannedMeal[] {
  const slot = plan.find((meal) => meal.id === slotId);
  if (!slot) return plan;
  const pair = pairForSlot(slotId);
  const mealType = pair?.mealType ?? slot.mealType;
  const used = [...pastMeals, slot.baseName];
  const lowCalorie = pair ? pair.lowCalorie : slot.mealType === "diner" || slot.lowCalorie;
  const source = pickFromPool(mealType, theme, used, nonce, 0, lowCalorie) ?? slot;
  const targets = pair?.slotIds ?? [slotId];
  return applyRecipeToSlots(plan, targets, source, theme);
}

export function mockRegenerateMeal(
  plan: PlannedMeal[],
  slotId: string,
  theme: string,
): PlannedMeal[] {
  return mockGenerateSingle(plan, slotId, theme, Date.now() % 9);
}

export function mockSuggestSwap(ingredientName: string, meal?: PlannedMeal): string[] {
  return coherentSuggestSwap(ingredientName, meal);
}

function isDessertOrBaking(meal: PlannedMeal) {
  const text = `${meal.baseName} ${meal.theme} ${meal.steps.join(" ")}`.toLowerCase();
  return /dessert|gâteau|gateau|brownie|cake|muffin|pâtisserie|patisserie|baking/.test(text);
}

export function mockSwapIngredient(
  meal: PlannedMeal,
  ingredientId: string,
  replacement: string,
): PlannedMeal {
  const name = replacement.trim();
  if (!name) return meal;
  const previous = meal.ingredients.find((item) => item.id === ingredientId);
  const ingredients = meal.ingredients.map((item) =>
    item.id === ingredientId ? { ...item, name } : item,
  );
  const oldName = previous?.name ?? "ingrédient";
  const caution = `Ingrédient échangé : ${oldName} → ${name}.`;
  const tofuTip =
    /tofu/i.test(name) && meal.dayIndex <= 4 && !isDessertOrBaking(meal)
      ? "Tofu : presser, mariner, réserver au frais."
      : /tofu/i.test(name)
        ? "Tofu : poêler ou enfourner (week-end / dessert)."
        : null;

  return {
    ...meal,
    ingredients,
    sharedBase: previous?.role === "shared" ? meal.sharedBase.replace(oldName, name) : meal.sharedBase,
    alexis:
      previous?.role === "alexis"
        ? { ...meal.alexis, protein: meal.alexis.protein.replace(oldName, name) }
        : meal.alexis,
    elodie:
      previous?.role === "elodie"
        ? { ...meal.elodie, protein: meal.elodie.protein.replace(oldName, name) }
        : meal.elodie,
    tips: tofuTip && !meal.tips.includes(tofuTip) ? [...meal.tips, tofuTip] : meal.tips,
    cautions: [
      caution,
      ...meal.cautions.filter(
        (line) =>
          !line.startsWith("Ingrédient échangé") &&
          !(/tofu/i.test(line) && /jamais|ne pas cuire|non cuit|pas cuit/i.test(line)),
      ),
    ],
  };
}

export function applySwapToBatch(
  plan: PlannedMeal[],
  slotId: string,
  ingredientId: string,
  replacement: string,
): PlannedMeal[] {
  const pair = pairForSlot(slotId);
  const targets = new Set(pair?.slotIds ?? [slotId]);
  return plan.map((slot) =>
    targets.has(slot.id) ? mockSwapIngredient(slot, ingredientId, replacement) : slot,
  );
}

export function applyFullRecipeToBatch(
  plan: PlannedMeal[],
  slotId: string,
  recipe: PlannedMeal,
  theme: string,
): PlannedMeal[] {
  const pair = pairForSlot(slotId);
  return applyRecipeToSlots(plan, pair?.slotIds ?? [slotId], recipe, theme);
}

export function ingredientsForView(
  ingredients: RecipeIngredient[],
  view: "alexis" | "elodie" | "couple",
): RecipeIngredient[] {
  if (view === "couple") return ingredients;
  return ingredients.filter((item) => item.role === "shared" || item.role === view);
}

export function gramsFor(item: RecipeIngredient, profileId: "alexis" | "elodie") {
  return profileId === "alexis" ? item.gramsAlexis : item.gramsElodie;
}

export function groupPlanByDay(plan: PlannedMeal[]) {
  const map = new Map<string, PlannedMeal[]>();
  for (const meal of plan) {
    const list = map.get(meal.day) ?? [];
    list.push(meal);
    map.set(meal.day, list);
  }
  return WEEK_DAYS.map((day) => [day, map.get(day) ?? []] as const);
}

export function uniqueWeekdayBatches(plan: PlannedMeal[]): PlannedMeal[] {
  const seen = new Set<string>();
  const out: PlannedMeal[] = [];
  for (const meal of plan) {
    if (WEEKEND_INDEXES.includes(meal.dayIndex)) continue;
    if (isEmptyMeal(meal)) continue;
    const key = normalizeTitle(meal.baseName);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(meal);
  }
  return out;
}

export function weekendFreshMeals(plan: PlannedMeal[]): PlannedMeal[] {
  return plan.filter((meal) => WEEKEND_INDEXES.includes(meal.dayIndex) && !isEmptyMeal(meal));
}
