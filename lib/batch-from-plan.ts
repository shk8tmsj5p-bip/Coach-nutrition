import type {
  Appliance,
  BatchStep,
  BatchStepIngredient,
  BatchStepRecipeBlock,
  PlannedMeal,
  RecipeIngredient,
} from "@/lib/types";
import { uniqueWeekdayBatches, weekendFreshMeals, WEEKEND_INDEXES } from "@/lib/weekly-plan";
import { isAversionMention, isFluffLine, isLogisticsTip, isRealTmWork, isWorthTmMix, isStepSection, stepSectionLabel } from "@/lib/recipe-copy";
import { planTagByMealId } from "@/lib/meal-tags";
import { formatIngredientLine, scaleVisualQuantity, visualForIngredient } from "@/lib/visual-quantity";
import { groupShoppingItems, isUnlistedShoppingIng, shoppingItemsFromPlan } from "@/lib/shopping-from-plan";
import { cookScale, type QtyMode } from "@/lib/qty-scale";
import { portionsDiffer } from "@/lib/meal-coach";

export type AppliancePlan = {
  appliance: Appliance;
  setting: string;
  blocks: BatchStepRecipeBlock[];
};

export type NumberedRecipe = PlannedMeal & { recipeNo: string };

export type BatchSession = {
  durationLabel: string;
  recipes: NumberedRecipe[];
  weekend: NumberedRecipe[];
  steps: BatchStep[];
  appliances: AppliancePlan[];
  tips: string[];
  warnings: string[];
  storage: string[];
  ingredientsByAisle: ReturnType<typeof groupShoppingItems>;
};

type SectionKey = "airfryer" | "water" | "tm" | "cuts" | "assembly";

function unique(lines: string[]) {
  const seen = new Set<string>();
  return lines.filter((line) => {
    const key = line.trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function fold(text: string) {
  return text
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function tokenHit(hay: string, needle: string) {
  const h = fold(hay);
  const n = fold(needle);
  if (!n) return false;
  let from = 0;
  while (from <= h.length) {
    const idx = h.indexOf(n, from);
    if (idx < 0) return false;
    const beforeOk = idx === 0 || /[^a-z0-9]/.test(h.charAt(idx - 1));
    const after = idx + n.length;
    const next = h.charAt(after);
    const afterOk =
      !next ||
      /[^a-z0-9]/.test(next) ||
      (next === "s" && (!h.charAt(after + 1) || /[^a-z0-9]/.test(h.charAt(after + 1))));
    if (beforeOk && afterOk) return true;
    from = idx + 1;
  }
  return false;
}

function matches(name: string, keys: string[]) {
  return keys.some((key) => tokenHit(name, key));
}

export function isRedundantTofuLine(line: string) {
  return /tofu/i.test(line) && /jamais|ne pas cuire|non cuit|pas cuit|interdit de cuire/i.test(line);
}

function lineFor(
  ing: RecipeIngredient,
  scale: number,
  planTag?: string,
): BatchStepIngredient {
  const gramsA = Math.round(ing.gramsAlexis * scale);
  const gramsE = Math.round(ing.gramsElodie * scale);
  const who = ing.role === "alexis" ? "Alexis" : ing.role === "elodie" ? "Élodie" : undefined;
  if (ing.role === "shared" && portionsDiffer(gramsA, gramsE)) {
    const maxG = Math.max(ing.gramsAlexis, ing.gramsElodie, 1);
    const visualA = scaleVisualQuantity(
      visualForIngredient(ing.name, ing.gramsAlexis, ing.visualQuantity),
      scale * (ing.gramsAlexis / maxG),
    );
    const visualE = scaleVisualQuantity(
      visualForIngredient(ing.name, ing.gramsElodie, ing.visualQuantity),
      scale * (ing.gramsElodie / maxG),
    );
    return {
      name: ing.name,
      quantity: `${ing.name} : Alexis ${visualA ? `${visualA} (${gramsA}g)` : `${gramsA}g`} · Élodie ${visualE ? `${visualE} (${gramsE}g)` : `${gramsE}g`}`,
      visual: visualA || visualE,
      planTag,
      gramsAlexis: gramsA,
      gramsElodie: gramsE,
      sauce: isPotSauceIng(ing),
    };
  }
  const grams = (ing.gramsAlexis + ing.gramsElodie) * scale;
  const visual = scaleVisualQuantity(
    visualForIngredient(ing.name, Math.max(ing.gramsAlexis, ing.gramsElodie), ing.visualQuantity),
    scale,
  );
  return {
    name: ing.name,
    quantity: formatIngredientLine({
      name: ing.name,
      grams,
      visual,
      who,
    }),
    visual,
    planTag,
    who,
    gramsAlexis: gramsA,
    gramsElodie: gramsE,
    sauce: isPotSauceIng(ing),
  };
}

function blockFor(
  meal: NumberedRecipe,
  ings: RecipeIngredient[],
  action: string,
  setting: string | undefined,
  scale: number,
): BatchStepRecipeBlock {
  return {
    recipeNo: meal.recipeNo,
    recipeTitle: meal.baseName,
    coverLabel: meal.coverLabel,
    ingredients: ings.map((ing) => lineFor(ing, scale, meal.recipeNo)),
    action,
    setting,
    servingsPerPerson: meal.servingsPerPerson,
  };
}

function sectionFromLabel(label: string): SectionKey | null {
  if (/airfryer/i.test(label)) return "airfryer";
  if (/eau|plaque|féculent|feculent|cookeo|bouillant|cuiseur|riz/i.test(label)) return "water";
  if (/thermomix/i.test(label)) return "tm";
  if (/assemblage|dressage|montage/i.test(label) && !/découpe|decoupe|kitchenaid/i.test(label)) {
    return "assembly";
  }
  if (/découpe|decoupe|kitchenaid/i.test(label)) return "cuts";
  if (/assemblage|dressage|montage/i.test(label)) return "assembly";
  return null;
}

const CUT_RX =
  /(râpé fin|rape fin|râpé(?:es?)?|lamelles?|spaghettis?|dés|cubes?|émincé[es]*|emince[es]*|ciselé[es]*|quartiers?|rondelles?|julienne|brunoise|tranches?)/i;

function isCutSentence(line: string) {
  return (
    CUT_RX.test(line) ||
    /ciseler|tailler|kitchenaid|trancher|émincer|emincer|râper|raper/i.test(line)
  );
}

function isAssemblySentence(line: string) {
  return /boîte|boite|tupperware|dresser|assembl|montage|sauce au pot|au fond|sur le côté|verser|filet|au service|fouetter dans un pot|presser|mariner|répartir|disposer|garnir|napper/i.test(
    line,
  );
}

function isCookWaterSentence(line: string) {
  if (/même base|sans riz|pas de riz|remplacé par/i.test(line)) return false;
  return (
    /cuire |cuisson|égoutt|blanchir|eau bouillante|eau frémissante|cookeo|cuiseur|mode riz|vapeur|\blentille|\bquinoa|\bnouille|\bsemoule|\borzo|\bpâtes|\bpates|\briz\b|haricot vert|pomme de terre/i.test(
      line,
    ) && !/boîte|boite|assembler|dresser|sauce au pot|au fond/i.test(line)
  );
}

function classifySentence(sentence: string, meal: PlannedMeal): SectionKey | null {
  if (isRealTmWork(sentence) || /thermomix|gazpacho|houmous maison/i.test(sentence)) return "tm";
  if (
    weekdayTofuIsFresh(meal) &&
    /tofu/i.test(sentence) &&
    /presser|mariner|frais|réserver|frigo/i.test(sentence) &&
    !/\d+\s*°c|airfryer/i.test(sentence)
  ) {
    return "assembly";
  }
  if (
    /marinade|mariner|badigeon|imbib/i.test(sentence) &&
    meal.ingredients.some((ing) => isAirfryProtein(ing, meal) && mentionedIn(ing, sentence))
  ) {
    return "airfryer";
  }
  if (/\d+\s*°c|airfryer/i.test(sentence) && !/hors panier|presser/i.test(sentence)) {
    return "airfryer";
  }
  if (isCookWaterSentence(sentence)) return "water";
  if (isCutSentence(sentence)) return "cuts";
  if (isAssemblySentence(sentence)) return "assembly";
  return null;
}

function groupedSteps(meal: PlannedMeal): Record<SectionKey, string[]> {
  const out: Record<SectionKey, string[]> = { airfryer: [], water: [], tm: [], cuts: [], assembly: [] };
  const hasSections = meal.steps.some(isStepSection);
  let current: SectionKey = "assembly";
  for (const line of meal.steps) {
    if (isStepSection(line)) {
      current = sectionFromLabel(stepSectionLabel(line)) ?? current;
      continue;
    }
    if (!line.trim() || isFluffLine(line) || isAversionMention(line) || isRedundantTofuLine(line)) continue;
    for (const sentence of stepSentences(line)) {
      if (weekdayTofuIsFresh(meal) && /tofu/i.test(sentence)) {
        if (!isTofuCookSentence(sentence)) out.assembly.push(sentence);
        continue;
      }
      const routed = classifySentence(sentence, meal);
      if (routed) {
        out[routed].push(sentence);
        continue;
      }
      if (!hasSections) continue;
      if (current === "assembly") continue;
      out[current].push(sentence);
    }
  }
  return out;
}

function stepSentences(line: string) {
  const parts = line.split(/(?<=[.!?])\s+/).map((item) => item.trim()).filter(Boolean);
  return parts.length > 0 ? parts : [line.trim()];
}

function extractSetting(lines: string[], fallback: string, ings: RecipeIngredient[] = []) {
  const blob = `${lines.join(" ")} ${ings.map((ing) => ing.name).join(" ")}`;
  if (/\briz\b/i.test(blob) && !/lentille|quinoa|pâte|pate|nouille/i.test(blob)) {
    const min = blob.match(/(\d+\s*min)/i);
    return min ? `Cuiseur à riz · ${min[1]}` : "Cuiseur à riz";
  }
  const tm = blob.match(/(\d+\s*sec\s*\/\s*v\d+(?:\s*,?\s*racler[^.]*)?)/i);
  if (tm) return tm[1].replace(/\s+/g, " ");
  const air = blob.match(/(\d+\s*°c[^\d]{0,12}\d+\s*min|\d+\s*min[^\d]{0,12}\d+\s*°c)/i);
  if (air) return air[1].replace(/\s+/g, " ");
  const cuts = blob.match(/râpé fin|rape fin|lamelles|spaghettis/i);
  if (cuts) return cuts[0];
  const hit = lines.find((line) => /\d+\s*°c|\d+\s*sec\s*\/\s*v\d|vitesse\s*\d|cookeo|cuiseur|eau bouillante/i.test(line));
  if (!hit) return fallback;
  const min = hit.match(/(\d+\s*min)/i);
  return min ? min[1] : fallback;
}

function isSauceIng(ing: RecipeIngredient) {
  return matches(`${ing.name} ${ing.notes ?? ""}`, [
    "sauce",
    "vinaigrette",
    "marinade",
    "tahini",
    "tahin",
    "houmous",
    "pesto",
    "pistou",
    "satay",
    "nuoc",
    "raifort",
    "beurre de sésame",
    "beurre de sesame",
  ]);
}

function isSolidBoxFood(ing: RecipeIngredient) {
  if (isStarchIng(ing) || isHerbIng(ing) || isBakeryIng(ing)) return true;
  return matches(ing.name, [
    "tofu",
    "edamame",
    "poulet",
    "dinde",
    "truite",
    "saumon",
    "crevette",
    "cabillaud",
    "thon",
    "boeuf",
    "steak",
    "œuf",
    "oeuf",
    "haricot",
    "pois chiche",
    "courgette",
    "carotte",
    "concombre",
    "daikon",
    "radis",
    "chou",
    "tomate",
    "poivron",
    "épinard",
    "epinard",
    "brocoli",
    "aubergine",
    "champignon",
    "salade",
    "roquette",
    "gingembre",
    "ail",
    "graines de sésame",
    "graines de sesame",
    "nori",
    "avocat",
  ]);
}

/** Pot sauce = condiments named as such. Never proteins / veg (notes « mariné soja » / « à l'eau » ne comptent pas). */
function isPotSauceIng(ing: RecipeIngredient) {
  if (isSolidBoxFood(ing)) return false;
  const name = ing.name;
  if (/^sauce\b/i.test(name) || /vinaigrette|marinade/i.test(name)) return true;
  return matches(name, [
    "tahini",
    "tahin",
    "houmous",
    "pesto",
    "pistou",
    "satay",
    "nuoc",
    "raifort",
    "beurre de sésame",
    "beurre de sesame",
    "huile",
    "moutarde",
    "vinaigre",
    "sauce soja",
    "agave",
    "sirop",
    "cumin",
    "paprika",
    "citron",
    "lime",
  ]);
}

function isTmBowlIng(ing: RecipeIngredient) {
  return isSauceIng(ing);
}

function isBakeryIng(ing: RecipeIngredient) {
  return matches(ing.name, ["galette", "naan", "pain", "pita", "wrap", "toast", "tortilla", "chapati"]);
}

function isStarchIng(ing: RecipeIngredient) {
  if (isBakeryIng(ing)) return false;
  return matches(ing.name, [
    "quinoa",
    "riz",
    "lentille",
    "sarrasin",
    "orzo",
    "penne",
    "pâte",
    "pate",
    "vermicelle",
    "nouille",
    "soba",
    "semoule",
    "konjac",
    "edamame",
  ]);
}

function isHerbIng(ing: RecipeIngredient) {
  return matches(ing.name, [
    "thym",
    "menthe",
    "basilic",
    "persil",
    "ciboulette",
    "aneth",
    "romarin",
    "origan",
    "laurier",
    "estragon",
    "sauge",
    "cerfeuil",
    "herbes de provence",
    "herbes fraîches",
    "herbes fraiches",
    "bouquet garni",
  ]);
}

function isWaterCookIng(ing: RecipeIngredient) {
  if (isBakeryIng(ing) || isHerbIng(ing) || isSauceIng(ing) || isPantryOrBinder(ing) || isTmBowlIng(ing)) {
    return false;
  }
  if (/patate douce/i.test(ing.name)) return false;
  if (isStarchIng(ing)) return true;
  if (/haricots?\s+vert/i.test(ing.name)) return true;
  return matches(ing.name, [
    "pomme de terre",
    "brocoli",
    "petits pois",
    "petit pois",
    "asperge",
    "poireau",
    "chou romanesco",
    "œuf",
    "oeuf",
  ]);
}

function defaultWaterMinutes(name: string) {
  if (/pomme de terre/i.test(name)) return "18 min";
  if (/haricots?\s+vert/i.test(name)) return "8 min";
  if (/brocoli|romanesco/i.test(name)) return "5 min";
  if (/petits? pois|edamame/i.test(name)) return "3 min";
  if (/asperge/i.test(name)) return "4 min";
  if (/lentille|quinoa/i.test(name)) return "12 min";
  if (/semoule/i.test(name)) return "5 min";
  if (/nouille|pâte|pate|orzo|penne|soba|vermicelle/i.test(name)) return "8 min";
  if (tokenHit(name, "oeuf") || tokenHit(name, "œuf")) return "7 min";
  if (/épinard|epinard/i.test(name)) return "1 min";
  if (/poireau/i.test(name)) return "12 min";
  return "10 min";
}

function formatWaterSetting(ing: RecipeIngredient, minutes: string) {
  if (/\briz\b/i.test(ing.name) && !/lentille|quinoa|pâte|pate|nouille/i.test(ing.name)) {
    return /min/i.test(minutes) ? `Cuiseur à riz · ${minutes}` : "Cuiseur à riz";
  }
  if (/lentille|quinoa/i.test(ing.name)) return `Cookeo · ${minutes}`;
  return `Eau · ${minutes}`;
}

function firstNameToken(name: string) {
  return (name.split(/[\s,(]/)[0] ?? name).trim();
}

function timeNearName(ing: RecipeIngredient, blob: string) {
  const first = fold(firstNameToken(ing.name));
  if (first.length < 4) return null;
  const hay = fold(blob);
  const escaped = first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const near =
    hay.match(new RegExp(`(.{0,48}${escaped}.{0,80}?\\d+\\s*min)`, "i")) ??
    hay.match(new RegExp(`(\\d+\\s*min.{0,48}${escaped})`, "i"));
  if (!near) return null;
  const time = near[1].match(/(\d+\s*min)/i)?.[1];
  if (!time) return null;
  return { time: time.replace(/\s+/g, " "), window: near[1] };
}

function hasOwnWaterCook(ing: RecipeIngredient, meal: PlannedMeal) {
  return groupedSteps(meal).water.some((line) => {
    if (!mentionedIn(ing, line)) return false;
    if (/même base|sans riz|pas de riz|remplacé par/i.test(line)) return false;
    return /blanchir|eau bouillante|vapeur|égoutt|cuire |cuiseur|cookeo|\d+\s*min/i.test(line);
  });
}

function waterCookIngs(meal: PlannedMeal) {
  return meal.ingredients.filter((ing) => {
    if (isHerbIng(ing) || isSauceIng(ing) || isPantryOrBinder(ing) || isTmBowlIng(ing) || isBakeryIng(ing)) return false;
    if (isFreshTofuIng(ing, meal)) return false;
    if (isAirfryProtein(ing, meal) || isPreparedOrCold(ing)) return false;
    if (isWaterCookIng(ing)) return true;
    return hasOwnWaterCook(ing, meal);
  });
}

function herbsCookedWith(ing: RecipeIngredient, meal: PlannedMeal, claimed: Set<string>) {
  const waterLines = groupedSteps(meal).water;
  const line = waterLines.find((item) => mentionedIn(ing, item)) ?? waterLines.join(" ");
  if (!line) return [];
  return meal.ingredients.filter((herb) => {
    if (!isHerbIng(herb) || claimed.has(herb.id)) return false;
    if (!mentionedIn(herb, line)) return false;
    claimed.add(herb.id);
    return true;
  });
}

function cookTimeOf(ing: RecipeIngredient, meal: PlannedMeal) {
  const blob = groupedSteps(meal).water.join(" ");
  const near = timeNearName(ing, blob);
  if (near) {
    const othersHere = waterCookIngs(meal).filter(
      (other) => other.id !== ing.id && mentionedIn(other, near.window),
    );
    if (othersHere.length === 0) return formatWaterSetting(ing, near.time);
  }
  if (/\briz\b/i.test(ing.name) && !/lentille|quinoa|pâte|pate|nouille/i.test(ing.name)) {
    return "Cuiseur à riz";
  }
  return formatWaterSetting(ing, defaultWaterMinutes(ing.name));
}

function isPreparedOrCold(ing: RecipeIngredient) {
  return matches(ing.name, [
    "houmous",
    "hummus",
    "ricotta",
    "jambon",
    "feta",
    "fromage",
    "mozza",
    "thon",
    "truite fum",
    "saumon fum",
    "yaourt",
    "skyr",
    "toast",
    "pain",
    "tofu soyeux",
  ]);
}

function isAirfryProtein(ing: RecipeIngredient, meal?: PlannedMeal) {
  if (isPreparedOrCold(ing) || isSauceIng(ing)) return false;
  if (meal && isFreshTofuIng(ing, meal)) return false;
  if (/pois chiche/i.test(ing.name)) {
    const blob = meal ? `${meal.steps.join(" ")} ${meal.baseName}` : "";
    if (/houmous|hummus/i.test(blob)) return false;
    return /airfryer|\d+\s*°c/i.test(blob) && mentionedIn(ing, blob);
  }
  return matches(ing.name, [
    "poulet",
    "dinde",
    "crevette",
    "bœuf",
    "boeuf",
    "falafel",
    "cabillaud",
    "tofu ferme",
    "simili",
  ]);
}

function mealText(meal: PlannedMeal) {
  return `${meal.baseName} ${meal.steps.join(" ")} ${meal.appliances.join(" ")}`.toLowerCase();
}

function isWeekdayBatchMeal(meal: PlannedMeal) {
  return !WEEKEND_INDEXES.includes(meal.dayIndex);
}

function isDessertOrBaking(meal: PlannedMeal) {
  return /dessert|gâteau|gateau|brownie|cake|muffin|pâtisserie|patisserie/i.test(mealText(meal));
}

function weekdayTofuIsFresh(meal: PlannedMeal) {
  return isWeekdayBatchMeal(meal) && !isDessertOrBaking(meal);
}

function isFreshTofuIng(ing: RecipeIngredient, meal: PlannedMeal) {
  return /tofu/i.test(ing.name) && weekdayTofuIsFresh(meal);
}

function isTofuCookSentence(line: string) {
  return (
    /tofu/i.test(line) &&
    /\d+\s*°c|\d+\s*min|airfryer|rôti|rotir|cuire|cuisson/i.test(line) &&
    !/presser|mariner|frais|réserver|frigo|dresser|froid/i.test(line)
  );
}

function isColdDish(meal: PlannedMeal) {
  return /gazpacho|soupe froide|carpaccio|salade froide|toast protéiné/i.test(mealText(meal));
}

function mealUsesSection(meal: PlannedMeal, key: SectionKey) {
  if (key === "airfryer" && isColdDish(meal)) return false;
  const lines = groupedSteps(meal)[key];
  const useful = lines.filter((line) => !/^(rien|n\/a|aucune|pas de cuisson|omit)/i.test(line.trim()));
  if (key === "airfryer") {
    const cook = useful.filter(
      (line) =>
        /\d+\s*°c|airfryer/i.test(line) &&
        !(/tofu/i.test(line) && /hors panier|presser|frais|réserver/i.test(line) && !/\d+\s*°c|airfryer/i.test(line)),
    );
    return cook.length > 0 && meal.ingredients.some((ing) => isAirfryProtein(ing, meal));
  }
  if (key === "tm") {
    return useful.some(isRealTmWork) && isWorthTmMix(useful.join(" "));
  }
  if (key === "water") {
    return waterCookIngs(meal).length > 0;
  }
  if (key === "cuts") {
    return meal.ingredients.some((ing) => isCutVeg(ing, meal));
  }
  if (key === "assembly") {
    return meal.ingredients.length > 0;
  }
  return useful.length > 0;
}

function mentionedIn(ing: RecipeIngredient, text: string) {
  const hay = text.toLowerCase();
  const name = ing.name.toLowerCase().trim();
  if (name.length < 3) return false;
  if (hay.includes(name)) return true;
  const first = name.split(/[\s,(]/)[0];
  return first.length >= 4 && hay.includes(first);
}

function isPantryOrBinder(ing: RecipeIngredient) {
  return matches(`${ing.name} ${ing.notes ?? ""}`, [
    "huile",
    "moutarde",
    "vinaigre",
    "soja",
    "agave",
    "sirop",
    "cumin",
    "paprika",
    "sel",
    "poivre",
    "eau",
    "jus",
  ]);
}

function isCutVeg(ing: RecipeIngredient, meal: PlannedMeal) {
  if (isSauceIng(ing) || isStarchIng(ing) || isTmBowlIng(ing) || isPantryOrBinder(ing)) return false;
  if (isFreshTofuIng(ing, meal) || isAirfryProtein(ing, meal)) return false;
  if (isPreparedOrCold(ing)) return false;
  if (matches(ing.name, ["œuf", "oeuf", "edamame", "petits pois", "petit pois", "asperge"]) || /haricots?\s+vert/i.test(ing.name)) {
    return CUT_RX.test(`${ing.name} ${ing.notes ?? ""}`);
  }
  const blob = `${ing.name} ${ing.notes ?? ""}`;
  if (/rôti|roti|cuit|marin/i.test(blob) && !CUT_RX.test(blob)) return false;
  if (isHerbIng(ing) && mentionedIn(ing, groupedSteps(meal).water.join(" ")) && !CUT_RX.test(blob)) {
    return false;
  }
  if (CUT_RX.test(blob)) return true;
  return matches(ing.name, [
    "courgette",
    "carotte",
    "chou",
    "concombre",
    "tomate",
    "oignon",
    "échalote",
    "echalote",
    "poivron",
    "aubergine",
    "betterave",
    "céleri",
    "celeri",
    "navet",
    "panais",
    "pomme de terre",
    "poireau",
    "salade",
    "laitue",
    "roquette",
    "épinard",
    "epinard",
    "menthe",
    "basilic",
    "persil",
    "ciboulette",
    "aneth",
    "thym",
    "radis",
    "avocat",
  ]);
}

function normalizeCut(raw: string) {
  const t = raw.toLowerCase();
  if (/spaghetti/.test(t)) return "spaghettis";
  if (/r[aâ]p/.test(t)) return "râpé fin";
  if (/lamelle/.test(t)) return "lamelles";
  if (/cisel/.test(t)) return "ciselée";
  if (/éminc|eminc/.test(t)) return "émincé";
  if (/quartier/.test(t)) return "quartiers";
  if (/rondelle/.test(t)) return "rondelles";
  if (/julienne/.test(t)) return "julienne";
  if (/brunoise/.test(t)) return "brunoise";
  if (/d[eé]s|cube/.test(t)) return "dés";
  return raw;
}

function defaultCut(name: string) {
  if (/menthe|basilic|persil|ciboulette|aneth|herbes/i.test(name)) return "ciselée";
  if (/carotte|chou|c[eé]leri-rave|betterave/i.test(name)) return "râpé fin";
  if (/courgette/i.test(name)) return "lamelles";
  if (/concombre|poivron|aubergine|oignon|[eé]chalote/i.test(name)) return "lamelles";
  if (/tomate/i.test(name)) return "quartiers";
  if (/pomme de terre/i.test(name)) return "dés";
  if (/poireau/i.test(name)) return "rondelles";
  if (/radis/i.test(name)) return "rondelles";
  if (/avocat/i.test(name)) return "tranches";
  return "tailler";
}

const VEG_ORDER = [
  "tomate",
  "concombre",
  "carotte",
  "courgette",
  "chou",
  "poivron",
  "aubergine",
  "oignon",
  "échalote",
  "betterave",
  "céleri",
  "navet",
  "panais",
  "pomme de terre",
  "poireau",
  "radis",
  "avocat",
  "salade",
  "laitue",
  "roquette",
  "épinard",
  "menthe",
  "basilic",
  "persil",
  "ciboulette",
  "aneth",
];

export function vegFamily(name: string) {
  const n = fold(name);
  return VEG_ORDER.find((fam) => n.includes(fold(fam))) ?? n.split(/[\s,(]/)[0] ?? n;
}

const VEG_LABELS: Record<string, string> = {
  tomate: "Tomates",
  concombre: "Concombres",
  carotte: "Carottes",
  courgette: "Courgettes",
  chou: "Choux",
  poivron: "Poivrons",
  aubergine: "Aubergines",
  oignon: "Oignons",
  échalote: "Échalotes",
  betterave: "Betteraves",
  céleri: "Céleri",
  navet: "Navets",
  panais: "Panais",
  "pomme de terre": "Pommes de terre",
  poireau: "Poireaux",
  radis: "Radis",
  avocat: "Avocats",
  salade: "Salade",
  laitue: "Laitue",
  roquette: "Roquette",
  épinard: "Épinards",
  menthe: "Menthe",
  basilic: "Basilic",
  persil: "Persil",
  ciboulette: "Ciboulette",
  aneth: "Aneth",
};

export function vegFamilyLabel(name: string) {
  const fam = vegFamily(name);
  return VEG_LABELS[fam] ?? `${fam.charAt(0).toUpperCase()}${fam.slice(1)}`;
}

function sortCutBlocks(blocks: BatchStepRecipeBlock[]) {
  return [...blocks].sort((a, b) => {
    const na = a.ingredients[0]?.name ?? "";
    const nb = b.ingredients[0]?.name ?? "";
    const ra = VEG_ORDER.indexOf(vegFamily(na));
    const rb = VEG_ORDER.indexOf(vegFamily(nb));
    const ia = ra >= 0 ? ra : VEG_ORDER.length;
    const ib = rb >= 0 ? rb : VEG_ORDER.length;
    if (ia !== ib) return ia - ib;
    const byName = vegFamily(na).localeCompare(vegFamily(nb), "fr");
    if (byName !== 0) return byName;
    const byCut = (a.setting ?? "").localeCompare(b.setting ?? "", "fr");
    if (byCut !== 0) return byCut;
    return a.recipeNo.localeCompare(b.recipeNo, "fr");
  });
}

function cutTypeOf(ing: RecipeIngredient, meal: PlannedMeal) {
  const fromNotes = (ing.notes ?? "").match(CUT_RX);
  if (fromNotes) return normalizeCut(fromNotes[1]);
  const blob = `${groupedSteps(meal).cuts.join(" ")} ${groupedSteps(meal).water.join(" ")} ${meal.steps.join(" ")}`;
  const first = firstNameToken(ing.name);
  if (first.length >= 4) {
    const escaped = first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const near = blob.match(new RegExp(`${escaped}[^.]{0,56}${CUT_RX.source}`, "i"));
    if (near) {
      const hit = near[0].match(CUT_RX);
      if (hit) return normalizeCut(hit[1]);
    }
  }
  return defaultCut(ing.name);
}

function classifyIng(ing: RecipeIngredient, meal: PlannedMeal): SectionKey {
  const groups = groupedSteps(meal);
  const tmText = groups.tm.join(" ");
  const waterText = groups.water.join(" ");
  if (isFreshTofuIng(ing, meal)) return "assembly";
  if (isBakeryIng(ing)) return "assembly";
  if (mealUsesSection(meal, "tm") && (isTmBowlIng(ing) || mentionedIn(ing, tmText))) {
    if (!isAirfryProtein(ing, meal) && !isStarchIng(ing) && !isWaterCookIng(ing)) return "tm";
  }
  if (isWaterCookIng(ing)) return "water";
  if (isHerbIng(ing)) return mentionedIn(ing, tmText) && mealUsesSection(meal, "tm") ? "tm" : isCutVeg(ing, meal) ? "cuts" : "assembly";
  if (waterText && mentionedIn(ing, waterText) && !isTmBowlIng(ing) && !isCutVeg(ing, meal) && !isAirfryProtein(ing, meal) && !isPreparedOrCold(ing) && !isBakeryIng(ing)) {
    return "water";
  }
  if (isCutVeg(ing, meal)) return "cuts";
  if (isPreparedOrCold(ing)) return "assembly";
  if (isAirfryProtein(ing, meal) && mealUsesSection(meal, "airfryer")) return "airfryer";
  if (isStarchIng(ing)) return "water";
  return "assembly";
}

function ingsFor(meal: PlannedMeal, key: SectionKey) {
  if (key === "airfryer") {
    return meal.ingredients.filter((ing) => isAirfryProtein(ing, meal));
  }
  const classified = meal.ingredients.filter((ing) => classifyIng(ing, meal) === key);
  const action = groupedSteps(meal)[key].join(" ");
  const extra = meal.ingredients.filter((ing) => {
    if (classified.some((item) => item.id === ing.id)) return false;
    if (key === "water" && (isHerbIng(ing) || isBakeryIng(ing))) return false;
    if (key === "cuts" && !isCutVeg(ing, meal)) return false;
    return mentionedIn(ing, action);
  });
  return [...classified, ...extra];
}

function marinadeHowTo(meal: PlannedMeal) {
  const proteins = meal.ingredients.filter((ing) => isAirfryProtein(ing, meal));
  if (proteins.length === 0) return "";
  return groupedSteps(meal)
    .airfryer.filter((line) => {
      if (!/marinade|mariner|badigeon|imbib/i.test(line)) return false;
      return proteins.some((ing) => mentionedIn(ing, line));
    })
    .join(" ");
}

function actionFor(meal: PlannedMeal, key: SectionKey, fallback: string) {
  const lines = groupedSteps(meal)[key].filter((line) => {
    if (/^(rien|n\/a|aucune|pas de cuisson|omit)/i.test(line.trim())) return false;
    if (key === "airfryer" && weekdayTofuIsFresh(meal) && /tofu/i.test(line) && !/\d+\s*°c|airfryer/i.test(line)) {
      return false;
    }
    if (key === "assembly") {
      if (weekdayTofuIsFresh(meal) && /tofu/i.test(line) && /presser|mariner/i.test(line)) return false;
      return isAssemblySentence(line) && !isCutSentence(line) && !isCookWaterSentence(line);
    }
    return true;
  });
  if (key === "airfryer") {
    const marinade = marinadeHowTo(meal);
    const cook = lines.filter((line) => !/marinade|mariner|badigeon|imbib/i.test(line));
    const parts = [marinade, ...cook].filter(Boolean);
    if (parts.length > 0) return unique(parts).join(" ");
    return fallback;
  }
  if (lines.length > 0) return lines.join(" ");
  return fallback;
}

function waterMethodKey(ing: RecipeIngredient) {
  if (/\briz\b/i.test(ing.name) && !/lentille|quinoa|pâte|pate|nouille/i.test(ing.name)) return "rice";
  if (/lentille|quinoa/i.test(ing.name)) return "cookeo";
  return "eau";
}

function waterSettingLabel(method: string, ings: RecipeIngredient[], meal: PlannedMeal) {
  if (method === "rice") return cookTimeOf(ings[0], meal) || "Cuiseur à riz";
  if (method === "cookeo") {
    return unique(ings.map((ing) => cookTimeOf(ing, meal))).join(" · ");
  }
  return ings
    .map((ing) => `${firstNameToken(ing.name)} ${cookTimeOf(ing, meal).replace(/^Eau · /i, "")}`)
    .join(" · ");
}

function stripPlatingTalk(text: string) {
  return text
    .replace(/\s*\([^)]*(déjeuner|dîner|diner)[^)]*\)/gi, "")
    .replace(/\b(pour le |au |en |du |le |la )?(petits?[- ]déjeuners?|déjeuners?|dîners?|diners?)\b/gi, "")
    .replace(/\b(version )?low[\s-]?cal(?:orie)?s?\b/gi, "")
    .replace(/\b(Lun|Mar|Mer|Jeu|Ven|Sam|Dim)(\s*\+\s*(Lun|Mar|Mer|Jeu|Ven))?\b/gi, "")
    .replace(/\s*[,;:]\s*[,;:]/g, ",")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,])/g, "$1")
    .replace(/^[,;.\s]+|[,;.\s]+$/g, "")
    .trim();
}

function sentenceFitsWaterGroup(
  sentence: string,
  method: string,
  ings: RecipeIngredient[],
  others: RecipeIngredient[],
) {
  if (/même base|sans riz|pas de riz|remplacé par/i.test(sentence)) return false;
  const own = ings.some((ing) => mentionedIn(ing, sentence));
  const other = others.some((ing) => mentionedIn(ing, sentence));
  if (other && own) return false;
  if (other && !own) return false;
  if (own) return true;
  if (method === "rice") return /cuiseur à riz/i.test(sentence);
  if (method === "cookeo") return /cookeo/i.test(sentence);
  return false;
}

function waterHowTo(meal: PlannedMeal, ings: RecipeIngredient[], method: string) {
  const others = waterCookIngs(meal).filter((ing) => !ings.some((item) => item.id === ing.id));
  const raw = groupedSteps(meal)
    .water.filter((line) => sentenceFitsWaterGroup(line, method, ings, others))
    .map(stripPlatingTalk)
    .filter(Boolean);
  return unique(raw).join(" ");
}

function waterCookBlocks(meal: NumberedRecipe, qtyMode: QtyMode): BatchStepRecipeBlock[] {
  const items = waterCookIngs(meal);
  if (items.length === 0) return [];
  const scale = cookScale(meal, qtyMode);
  const groups = new Map<string, RecipeIngredient[]>();
  const claimed = new Set<string>();
  for (const ing of items) {
    const key = waterMethodKey(ing);
    const list = groups.get(key) ?? [];
    const herbs = herbsCookedWith(ing, meal, claimed);
    list.push(ing, ...herbs);
    groups.set(key, list);
  }
  return [...groups.entries()].map(([method, ings]) => {
    const uniqueIngs = ings.filter((ing, index) => ings.findIndex((item) => item.id === ing.id) === index);
    return blockFor(
      meal,
      uniqueIngs,
      waterHowTo(meal, uniqueIngs, method),
      waterSettingLabel(method, uniqueIngs, meal),
      scale,
    );
  });
}

const SECTIONS: Array<{
  key: SectionKey;
  title: string;
  detail: string;
  appliance: Appliance;
  fallbackAction: (meal: PlannedMeal) => string;
  fallbackSetting: string;
}> = [
  {
    key: "airfryer",
    title: "1. Cuissons Airfryer (Protéines)",
    detail:
      "Enchaînez les cuissons. Placez la version végane d'un côté du panier, la classique de l'autre, avec un pschitt d'huile.",
    appliance: "Airfryer",
    fallbackSetting: "",
    fallbackAction: () =>
      "Cuisson parallèle vegan / omnivore, même panier si possible.",
  },
  {
    key: "water",
    title: "2. Cuissons Eau / Plaques (Féculents)",
    detail: "Une ligne par recette et par mode (cuiseur / Cookeo / eau). Si plusieurs ingrédients cuisent ensemble, ils sont regroupés avec les temps et les gestes.",
    appliance: "Cookeo",
    fallbackSetting: "Cuiseur à riz / Cookeo",
    fallbackAction: (meal) =>
      meal.ingredients.some((ing) => /\briz\b/i.test(ing.name))
        ? "Riz au cuiseur à riz. Autres féculents : Cookeo ou eau bouillante."
        : "Cuire le féculent, égoutter, répartir.",
  },
  {
    key: "tm",
    title: "3. Thermomix (Sauces maison)",
    detail:
      "Rincez le bol entre chaque sauce. Versez dans des pots hermétiques. Ne mélangez qu'au moment de servir.",
    appliance: "Thermomix",
    fallbackSetting: "",
    fallbackAction: () => "Mixer la vinaigrette / sauce. Pots hermétiques.",
  },
  {
    key: "cuts",
    title: "4. Découpes",
    detail: "Une ligne par légume. Disques KitchenAid (râpé fin, lamelles, spaghettis) ou couteau (ciselée).",
    appliance: "KitchenAid",
    fallbackSetting: "",
    fallbackAction: () => "Tailler chaque légume selon la coupe indiquée.",
  },
  {
    key: "assembly",
    title: "5. Boîtes Alexis & Élodie",
    detail: "Grammes = 1 boîte = 1 repas. Semaine : faire ×2 pour 4 repas. Sauce au pot, jamais dans la boîte.",
    appliance: "Plaque",
    fallbackSetting: "",
    fallbackAction: () => "Répartir dans les boîtes. Sauce au pot.",
  },
];

export function buildBatchSession(plan: PlannedMeal[], qtyMode: QtyMode = "batch"): BatchSession {
  const tags = planTagByMealId(plan);
  const recipes = uniqueWeekdayBatches(plan).map((meal) => ({
    ...meal,
    recipeNo: tags.get(meal.id) ?? "P1",
    steps: meal.steps.filter((line) => !isRedundantTofuLine(line) && !isAversionMention(line)),
    tips: meal.tips.filter((line) => !isRedundantTofuLine(line) && !isAversionMention(line)),
    cautions: [],
  }));
  const weekend = weekendFreshMeals(plan).map((meal) => ({
    ...meal,
    recipeNo: tags.get(meal.id) ?? "P6",
  }));
  const ingredientsByAisle = groupShoppingItems(shoppingItemsFromPlan(plan));

  const appliances: AppliancePlan[] = [];
  const steps: BatchStep[] = SECTIONS.flatMap((section, index) => {
    const blocks = recipes.flatMap((meal) => {
      if (!mealUsesSection(meal, section.key)) return [];
      const ings =
        section.key === "assembly"
          ? meal.ingredients.filter((ing) => !isUnlistedShoppingIng(ing.name))
          : ingsFor(meal, section.key);
      const lines = groupedSteps(meal)[section.key].filter(
        (line) => !/^(rien|n\/a|aucune|pas de cuisson|omit)/i.test(line.trim()),
      );
      if (section.key === "water") {
        return waterCookBlocks(meal, qtyMode);
      }
      if (section.key === "cuts") {
        const vegs = meal.ingredients.filter((ing) => isCutVeg(ing, meal));
        if (vegs.length === 0) return [];
        const scale = cookScale(meal, qtyMode);
        return vegs.map((ing) => blockFor(meal, [ing], "", cutTypeOf(ing, meal), scale));
      }
      const montageLines = lines.filter(
        (line) => isAssemblySentence(line) && !isCutSentence(line) && !isCookWaterSentence(line),
      );
      if (section.key === "assembly") {
        if (ings.length === 0 && montageLines.length === 0) return [];
        return [
          blockFor(
            meal,
            ings,
            actionFor(meal, section.key, section.fallbackAction(meal)),
            undefined,
            1,
          ),
        ];
      }
      if (ings.length === 0) return [];
      if (
        section.key === "tm" &&
        !isWorthTmMix(
          [...lines, actionFor(meal, section.key, "")].join(" "),
          ings.map((ing) => ing.name),
        )
      ) {
        return [];
      }
      const scale = cookScale(meal, qtyMode);
      return [
        blockFor(
          meal,
          ings,
          actionFor(meal, section.key, section.fallbackAction(meal)),
          extractSetting(lines, section.fallbackSetting, ings) || undefined,
          scale,
        ),
      ];
    });

    const ordered = section.key === "cuts" ? sortCutBlocks(blocks) : blocks;

    appliances.push({
      appliance: section.appliance,
      setting: unique(ordered.map((block) => block.setting ?? "").filter(Boolean)).join(" · "),
      blocks: ordered,
    });

    if (ordered.length === 0) return [];
    return [
      {
        time: String(index + 1),
        title: section.title,
        detail: section.detail,
        appliance: section.appliance,
        setting: unique(ordered.map((block) => block.setting ?? "").filter(Boolean)).slice(0, 3).join(" · "),
        recipes: ordered,
        rowMode: section.key === "cuts" ? "per-item" : undefined,
      },
    ];
  });

  if (weekend.length > 0) {
    steps.push({
      time: "W",
      title: "Week-end · repas frais",
      detail: "Hors session batch. 1 repas / personne, le jour même. Tofu cuit OK.",
      recipes: weekend.map((meal) =>
        blockFor(
          meal,
          meal.ingredients,
          meal.steps.filter((line) => !isStepSection(line) && !isFluffLine(line)).join(" ") ||
            "Cuisiner le jour J.",
          "Repas frais · jour J",
          cookScale(meal, qtyMode),
        ),
      ),
    });
  }

  const tips = unique([
    "Conservez toutes les sauces dans des petits pots séparés et ne mélangez qu'au moment de servir.",
    ...recipes.flatMap((meal) => meal.tips.filter((line) => isLogisticsTip(line))),
    weekend.length > 0 ? "Week-end : cuisiner le jour J, 1 repas / pers." : "",
  ]);

  const storage = unique([
    "Boîtes : grammes = 1 repas. Semaine = faire ×2 (2 boîtes / pers.). Sauce au pot, versée au moment.",
    "Vinaigrettes et sauces en pots, versées au moment.",
    weekend.length > 0 ? "Week-end : cuisiner le jour J, 1 repas / pers." : "",
  ]);

  return {
    durationLabel: "session express",
    recipes,
    weekend,
    steps,
    appliances: appliances.filter((row) => row.blocks.length > 0),
    tips: tips.filter(Boolean).slice(0, 8),
    warnings: [],
    storage: storage.filter(Boolean),
    ingredientsByAisle,
  };
}
