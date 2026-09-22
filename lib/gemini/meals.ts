import type { Appliance, MealType, PlannedMeal, RecipeDeclination, RecipeIngredient } from "@/lib/types";
import { WEEKDAY_BATCHES, pairIsMixed, type BatchPair } from "@/lib/weekly-plan";
import { formatCoachBiasForPrompt, type HouseholdCoachBias } from "@/lib/coach-apply";
import {
  isFluffLine,
  isKitchenAidCut,
  isLogisticsTip,
  isRealTmWork,
  sanitizeCopy,
  STEP_SECTION_PREFIX,
} from "@/lib/recipe-copy";
import { expandPreparedSauces, isPreparedSauceName } from "@/lib/homemade-sauces";
import { equalizeSharedSauce } from "@/lib/ingredient-groups";
import { stripThemeSticker, themeConstraintLine } from "@/lib/theme-kits";
import { repairMealIntegrity } from "@/lib/recipe-integrity";
import { isDessertRecipe } from "@/lib/recipe-kind";
import { culinaryRole, describeIngredientUse } from "@/lib/swap-coherence";
import { visualForIngredient } from "@/lib/visual-quantity";
import { declinationFromIngredients } from "@/lib/recipe-macros";
import { motifsIn } from "@/lib/recipe-diversity";
import { generateGeminiJson, type GeminiCallResult, type GeminiPart } from "@/lib/gemini/models";
import { formatRecipePhotoForPrompt, type RecipeFit } from "@/lib/recipe-photo";

export type GenerateMealsMode =
  | "weekdays"
  | "weekend"
  | "single"
  | "suggest-swap"
  | "apply-swap"
  | "today-swap"
  | "dessert-batch";

export type GeminiMealJson = {
  title: string;
  shared_ingredients: unknown;
  profile_1_ingredients: unknown;
  profile_2_ingredients: unknown;
  step_groups?: unknown;
  step_by_step_instructions: unknown;
  tips_and_cautions: unknown;
};

/** If the dish has a sauce, name it and group its ingredients — don't invent one. */
const SAUCE_IF_PRESENT =
  "Sauce / vinaigrette / marinade : seulement si CE plat en a vraiment. Chaque composant = son nom seul (Citron, Moutarde, Huile). INTERDIT « Marinade Yassa - Citron ». L'app groupe. INTERDIT d'en inventer une pour remplir.";

const CULINARY_LAWS = `Tu es Gem Chef Cuistot. Condensé, gourmand, actionnable. Zéro blabla diététique.

Foyer : Alexis vegan, Élodie omnivore. MÊME plat. Protéine vegan / omni SAUF si le titre EST la protéine (ex. falafel) : alors la MÊME pour les deux. INTERDIT de remplacer la star du titre.

PRÉFÉRENCES FOYER = source de vérité (bloc plus bas) : aversions, type de recette, goût. Les aversions ne vont pas dans la recette et ne se mentionnent pas. Épices : celles du plat, pas un rajout.

SAUCES / VINAIGRETTES / MARINADES : seulement si CE plat en a vraiment. Chaque composant en ligne, nom = l'ingrédient seul (Citron, Moutarde, Huile d'olive). Cite « marinade » / « sauce » dans une étape, pas dans chaque nom. INTERDIT « Marinade Yassa - Jus de citron ». INTERDIT d'inventer une sauce. INTERDIT une seule ligne « pesto du commerce » / « satay 40g » sans ses ingrédients.

APPAREILS : le foyer a Thermomix TM31, KitchenAid, Cookeo, Airfryer, mixer, cuiseur à riz (détail Paramètres). Utilise-les au mieux pour CE plat. Omettre un robot qui ne sert à rien.
- Grillade / croustillant : privilégier l'Airfryer, avec °C + min.
- KitchenAid : nomme la coupe (râpé fin, râpé épais, lamelles). Ciseler = couteau.
- Riz : cuiseur à riz. Cookeo : légumineuses / vapeur, pas le riz.

PAS-À-PAS : phrases courtes, blocs utiles seulement. Eau : UNE durée par ingrédient, jamais un temps unique pour un mélange. Poêle / plaque : sauter ou revenir — pas une ligne « eau ». Assemblage = boîtes + pot sauce. INTERDIT d'y mettre une cuisson ou une découpe.

PORTIONS : JSON = 1 assiette / pers. (Lun–Ven : l'app ×2). Même plat, weight_g. Féculent / légume / riz = shared_ingredients seulement (UN weight_g). profile_1 / profile_2 = la protéine uniquement. L'app recale Alexis / Élodie. Extra kcal = ce qui est déjà dans le plat, pas une 2e protéine ni un 2e féculent.

THÈME : s'il est fourni, c'est une piste d'idées (cuisine, ingrédient, plat). Invente à partir de ça.`;

export const MEAL_JSON_SHAPE = `{
  "title": "<titre du plat>",
  "shared_ingredients": [
    { "name": "<ingrédient partagé>", "weight_g": 80, "prep": "<coupe si besoin>" },
    { "name": "<féculent>", "weight_g": 120 },
    { "name": "<autre partagé>", "weight_g": 12 }
  ],
  "profile_1_ingredients": [{ "name": "<protéine vegan seulement — pas de riz / féculent>", "weight_g": 140, "prep": "<prépa>" }],
  "profile_2_ingredients": [{ "name": "<protéine omni seulement — pas de riz / féculent>", "weight_g": 140, "prep": "<prépa>" }],
  "step_groups": [
    { "section": "Cuissons Airfryer", "steps": ["<°C · min — omettre le groupe si rien à cuire>"] },
    { "section": "Cuissons Eau / Féculents", "steps": ["<une durée par ingrédient — omettre si rien>"] },
    { "section": "Cuissons Plaque / Poêle", "steps": ["<poêle · min — omettre si rien à poêler>"] },
    { "section": "Thermomix", "steps": ["<uniquement si mixage réel — omettre sinon>"] },
    { "section": "Découpes KitchenAid", "steps": ["<une phrase par légume>"] },
    { "section": "Assemblage", "steps": ["<boîtes ; pot sauce si le plat en a une>"] }
  ],
  "tips_and_cautions": ["<logistique batch uniquement>"]
}`;

export function formatPastMealsForPrompt(pastMeals?: string[]) {
  const titles = [...new Set((pastMeals ?? []).map((title) => title.trim()).filter(Boolean))];
  if (titles.length === 0) {
    return `DIVERSITÉ : dans ce lot, chaque recette a une identité propre. Interdit de décliner le même plat / la même sauce sur tout le lot.`;
  }
  const families = [...new Set(titles.flatMap((title) => motifsIn(title)))];
  return `TITRES INTERDITS (ne les réécris JAMAIS, même reformulés — y compris la liste foyer « Plus jamais ») : [${titles.join(" | ")}].
${families.length ? `Déjà servi récemment — change de direction : ${families.join(", ")}.` : ""}
Invente des recettes nouvelles. 1 lot = 1 identité par recette.`;
}

export function culinaryPrompt(
  extra: string,
  coachBias?: HouseholdCoachBias | null,
  pastMeals?: string[],
  kitchenContext?: string,
) {
  const bias = formatCoachBiasForPrompt(coachBias);
  const memory = formatPastMealsForPrompt(pastMeals);
  return `${CULINARY_LAWS}

${kitchenContext ? `${kitchenContext}\n` : ""}
${extra}
${memory ? `\n${memory}\n` : ""}
${bias ? `\n${bias}\n` : ""}
Réponds UNIQUEMENT en JSON valide, sans markdown. Respecte EXACTEMENT les clés du schéma.`;
}

function asList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : JSON.stringify(item)))
      .filter((item) => item && item !== "{}" && !item.startsWith("{"));
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function looksLikeSection(line: string) {
  const text = line.replace(/^\d+[.)]\s*/, "").trim();
  if (text.length > 90) return false;
  if (/\d+\s*(min|sec)|vitesse\s*\d|°c|cookeo|airfryer/i.test(text) && /[—,:].{20,}/.test(text)) {
    return false;
  }
  return /^(§\s*)?(cuissons|thermomix|découpes|decoupes|assemblage|kitchenaid|sauces?\s*\/|protéines|féculents)/i.test(
    text,
  );
}

function isUselessStep(line: string) {
  const text = line.trim();
  return (
    /^(rien|n\/a|aucune|—|-|omit)$/i.test(text) ||
    /pas de cuisson|aucune cuisson|pas d['’]?airfryer|omit airfryer|ne concerne pas/i.test(text)
  );
}

function parseSteps(value: unknown, grouped?: unknown): string[] {
  const candidate =
    Array.isArray(grouped) && grouped.length > 0
      ? grouped
      : value;
  if (
    Array.isArray(candidate) &&
    candidate.some((item) => item && typeof item === "object" && !Array.isArray(item))
  ) {
    const fromGroups: string[] = [];
    for (const block of candidate) {
      if (typeof block === "string") {
        if (looksLikeSection(block)) {
          fromGroups.push(`${STEP_SECTION_PREFIX}${block.replace(/^\d+[.)]\s*/, "").replace(/^§\s*/, "").trim()}`);
        } else if (!isFluffLine(block) && !isUselessStep(block)) {
          fromGroups.push(block);
        }
        continue;
      }
      if (!block || typeof block !== "object") continue;
      const rec = block as Record<string, unknown>;
      const section = String(rec.section ?? rec.title ?? "").trim();
      const steps = asList(rec.steps ?? rec.items).filter(
        (line) => !isFluffLine(line) && !isUselessStep(line),
      );
      if (steps.length === 0) continue;
      if (section) fromGroups.push(`${STEP_SECTION_PREFIX}${section}`);
      fromGroups.push(...steps);
    }
    return fromGroups;
  }

  const flat = asList(candidate);
  const out: string[] = [];
  for (const line of flat) {
    if (looksLikeSection(line)) {
      const label = line.replace(/^\d+[.)]\s*/, "").replace(/^§\s*/, "").trim();
      out.push(`${STEP_SECTION_PREFIX}${label}`);
      continue;
    }
    if (!isFluffLine(line) && !isUselessStep(line)) out.push(line);
  }
  return out;
}

function slug(name: string, index: number) {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24) || "ing"}-${index}`;
}

function mergeIngredientNotes(rec: Record<string, unknown>) {
  const parts = [rec.prep, rec.notes]
    .map((item) => (item == null ? "" : String(item).trim()))
    .filter(Boolean);
  const unique: string[] = [];
  for (const part of parts) {
    if (!unique.some((item) => item.toLowerCase() === part.toLowerCase())) unique.push(part);
  }
  return unique.map((part) => sanitizeCopy(part)).filter((part): part is string => Boolean(part)).join(" · ") || undefined;
}

function readVisualQuantity(rec: Record<string, unknown>) {
  const value = rec.visual_unit ?? rec.visual_quantity ?? rec.visualQuantity ?? rec.shop_unit;
  const text = value == null ? "" : String(value).trim();
  return text || undefined;
}

function readGrams(rec: Record<string, unknown>, keys: string[], fallback: number) {
  for (const key of keys) {
    const n = Number(rec[key]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return fallback;
}

function dropBannedIngredients(ingredients: RecipeIngredient[]) {
  return ingredients.filter(
    (item) =>
      !/coriandre|chou-fleur|piment fort|jalape[nñ]o|cayenne|past[eè]que|fenouil|beurre de cacahu[eè]te|mangue|seitan|tempeh/i.test(
        item.name,
      ),
  );
}

function normalizeIngredientName(name: string) {
  if (/nuoc/i.test(name) && /v[ée]g[ée]|bouteille|commerce|pr[eê]t/i.test(name)) {
    return "Nuoc mam vegan maison";
  }
  return name;
}

function parseOneShared(item: unknown, index: number): RecipeIngredient[] {
  if (typeof item === "string") {
    return [
      {
        id: slug(item, index),
        name: item,
        role: "shared" as const,
        gramsAlexis: 80,
        gramsElodie: 80,
      },
    ];
  }
  const rec = (item ?? {}) as Record<string, unknown>;
  const name = normalizeIngredientName(String(rec.name ?? rec.ingredient ?? "Ingrédient"));
  const nested = rec.components ?? rec.parts ?? rec.sauce_ingredients;
  if (Array.isArray(nested) && nested.length > 0 && isPreparedSauceName(name)) {
    return parseShared(nested);
  }
  const weight = readGrams(rec, ["weight_g", "grams"], 0);
  const gramsAlexis = readGrams(rec, ["grams_alexis"], 0);
  const gramsElodie = readGrams(rec, ["grams_elodie"], 0);
  const shared = weight || 80;
  const a = gramsAlexis || shared;
  const e = gramsElodie || (gramsAlexis ? gramsAlexis : shared);
  return [
    {
      id: slug(name, index),
      name,
      role: "shared" as const,
      gramsAlexis: a,
      gramsElodie: e,
      visualQuantity: visualForIngredient(name, Math.max(a, e), readVisualQuantity(rec)),
      notes: mergeIngredientNotes(rec),
    },
  ];
}

function parseShared(value: unknown): RecipeIngredient[] {
  if (Array.isArray(value)) return value.flatMap((item, index) => parseOneShared(item, index));
  if (value && typeof value === "object") {
    const rec = value as Record<string, unknown>;
    const nested = rec.items ?? rec.list ?? rec.shared;
    if (Array.isArray(nested)) return nested.flatMap((item, index) => parseOneShared(item, index));
  }
  return [];
}

function parseProfile(value: unknown, role: "alexis" | "elodie"): RecipeIngredient[] {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    if (typeof item === "string") {
      return {
        id: slug(item, index),
        name: item,
        role,
        gramsAlexis: role === "alexis" ? 120 : 0,
        gramsElodie: role === "elodie" ? 120 : 0,
      };
    }
    const rec = (item ?? {}) as Record<string, unknown>;
    const name = normalizeIngredientName(String(rec.name ?? rec.ingredient ?? "Protéine"));
    const grams = readGrams(rec, ["weight_g", "grams"], 120);
    return {
      id: slug(name, index),
      name,
      role,
      gramsAlexis: role === "alexis" ? grams : 0,
      gramsElodie: role === "elodie" ? grams : 0,
      visualQuantity: visualForIngredient(name, grams, readVisualQuantity(rec)),
      notes: mergeIngredientNotes(rec),
    };
  });
}

function macrosFromIngredients(
  ingredients: RecipeIngredient[],
  profile: "alexis" | "elodie",
): RecipeDeclination {
  return declinationFromIngredients(ingredients, profile);
}

function inferAppliances(steps: string[], ingredients: RecipeIngredient[]): Appliance[] {
  const stepText = steps.join(" ");
  const noteText = ingredients.map((item) => `${item.name} ${item.notes ?? ""}`).join(" ");
  const text = `${stepText} ${noteText}`.toLowerCase();
  const cold = /gazpacho|soupe froide|carpaccio|salade froide/.test(text);
  const list: Appliance[] = [];
  if (steps.some(isRealTmWork)) list.push("Thermomix");
  if (text.includes("cookeo")) list.push("Cookeo");
  if (/cuiseur à riz/.test(text) || /\briz\b/.test(text)) {
    list.push("Cuiseur à riz");
  }
  if (!cold && /\d+\s*°c/.test(text) && /airfryer|air fryer/.test(text)) list.push("Airfryer");
  if (text.includes("four") || text.includes("chaleur tournante")) list.push("Four");
  if (steps.some(isKitchenAidCut) || /râpé fin|râpé épais|lamelles|spaghettis/.test(noteText)) {
    list.push("KitchenAid");
  }
  if (/\bmixer\b|\bmixeur\b/.test(text) && !list.includes("Thermomix")) list.push("Mixer");
  if (text.includes("poêle") || text.includes("plaque")) list.push("Plaque");
  return list;
}

export function parseGeminiJson(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, "").replace(/```[\s\n]*$/, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch (first) {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
    throw first;
  }
}

export function geminiToPlannedMeal(json: GeminiMealJson, slot: PlannedMeal, theme: string): PlannedMeal {
  const shared = parseShared(json.shared_ingredients);
  const alexisIngs = parseProfile(json.profile_1_ingredients, "alexis");
  const elodieIngs = parseProfile(json.profile_2_ingredients, "elodie");
  const ingredients = dropBannedIngredients([...shared, ...alexisIngs, ...elodieIngs]);
  const steps = parseSteps(json.step_by_step_instructions, json.step_groups);
  const logistics = asList(json.tips_and_cautions)
    .map((line) => sanitizeCopy(line))
    .filter((line): line is string => Boolean(line) && isLogisticsTip(line));

  const rawTitle = json.title || slot.baseName;
  const planned: PlannedMeal = {
    ...slot,
    baseName: stripThemeSticker(rawTitle, theme),
    sharedBase: shared.map((item) => item.name).join(", ") || slot.sharedBase,
    theme: theme.trim() || slot.theme || "Base",
    appliances: inferAppliances(steps, ingredients),
    ingredients,
    steps: steps.length ? steps : isDessertRecipe(slot) ? [] : slot.steps,
    tips: logistics,
    cautions: [],
    alexis: macrosFromIngredients(ingredients, "alexis"),
    elodie: macrosFromIngredients(ingredients, "elodie"),
  };
  const expanded = equalizeSharedSauce(expandPreparedSauces(planned));
  const repaired = repairMealIntegrity(expanded);
  return {
    ...repaired,
    alexis: macrosFromIngredients(repaired.ingredients, "alexis"),
    elodie: macrosFromIngredients(repaired.ingredients, "elodie"),
  };
}

export function extractRecipes(parsed: unknown): GeminiMealJson[] {
  if (Array.isArray(parsed)) {
    return parsed.map(coerceMealJson).filter((item): item is GeminiMealJson => Boolean(item));
  }
  if (!parsed || typeof parsed !== "object") return [];
  const rec = parsed as Record<string, unknown>;
  for (const key of ["recipes", "desserts", "meals"]) {
    const list = rec[key];
    if (Array.isArray(list)) {
      const mapped = list.map(coerceMealJson).filter((item): item is GeminiMealJson => Boolean(item));
      if (mapped.length) return mapped;
    } else {
      const nested = coerceMealJson(list);
      if (nested) return [nested];
    }
  }
  for (const key of ["dessert", "recipe", "meal"]) {
    const nested = coerceMealJson(rec[key]);
    if (nested) return [nested];
  }
  const one = coerceMealJson(parsed);
  return one ? [one] : [];
}

function coerceMealJson(raw: unknown): GeminiMealJson | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  const rawTitle = rec.title ?? rec.nom ?? rec.name;
  const title = typeof rawTitle === "string" ? rawTitle.trim() : "";
  if (!title) return null;
  const ings =
    rec.shared_ingredients ??
    rec.ingredients ??
    rec.sharedIngredients ??
    rec.composition ??
    rec.ingredient_list;
  return {
    title,
    shared_ingredients: ings,
    profile_1_ingredients: rec.profile_1_ingredients ?? rec.alexis ?? rec.profile_1 ?? [],
    profile_2_ingredients: rec.profile_2_ingredients ?? rec.elodie ?? rec.profile_2 ?? [],
    step_groups: rec.step_groups ?? rec.etapes_groupees,
    step_by_step_instructions: rec.step_by_step_instructions ?? rec.etapes ?? rec.steps,
    tips_and_cautions: rec.tips_and_cautions ?? rec.tips,
  };
}

export function extractSuggestions(parsed: unknown): string[] {
  if (!parsed || typeof parsed !== "object") return [];
  const rec = parsed as Record<string, unknown>;
  return uniqueSuggestions(flattenSuggestions(rec.suggestions ?? rec.alternatives ?? rec.options)).slice(0, 3);
}

function flattenSuggestions(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (typeof item === "string") return splitSuggestionText(item);
      if (item && typeof item === "object") {
        const rec = item as Record<string, unknown>;
        const name = rec.name ?? rec.ingredient ?? rec.title ?? rec.label;
        if (typeof name === "string") return splitSuggestionText(name);
      }
      return [];
    });
  }
  if (typeof value === "string") return splitSuggestionText(value);
  return [];
}

function splitSuggestionText(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (/[\n;]/.test(trimmed) || /,.*,/.test(trimmed)) {
    return trimmed.split(/[\n;,]/).map(cleanSuggestion).filter(Boolean);
  }
  if (trimmed.includes(" / ")) return trimmed.split("/").map(cleanSuggestion).filter(Boolean);
  return [cleanSuggestion(trimmed)].filter(Boolean);
}

function cleanSuggestion(value: string) {
  return value.replace(/^\d+[.)]\s*/, "").replace(/^[-•*]\s*/, "").trim();
}

function uniqueSuggestions(list: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    const key = item.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function weekdaysPrompt(
  theme: string,
  coachBias?: HouseholdCoachBias | null,
  pastMeals?: string[],
  kitchenContext?: string,
) {
  const batches = WEEKDAY_BATCHES.map((pair, index) => {
    const cal = pairIsMixed(pair)
      ? "même base midi + soir · JSON 1 assiette midi ; le dîner sera recalé light (cibles soir)"
      : pair.lowCalorie
        ? "DÎNER LOW CAL (cibles soir COACH NUTRITION)"
        : "déjeuner (cibles midi COACH NUTRITION)";
    return `${index + 1}. recipes[${index}] = ${pair.label} — ${cal}`;
  }).join("\n");
  return culinaryPrompt(
    `Génère EXACTEMENT 5 recettes BATCH Lundi–Vendredi, niveau S34 (détaillées ; sauce maison seulement si le plat en a une).
JSON = 1 assiette / pers., weight_g. L'app ×2 (4 assiettes foyer).
Batch ×2 : 2 créneaux / recette, jamais le même jour. recipes[4] = Mer midi + Ven soir, même base, soir recalé light.
${themeConstraintLine(theme, 5)}
ORDRE JSON STRICT — ne permute JAMAIS les index :
${batches}
Les 5 titres doivent être nettement distincts. Sauce seulement si le plat en a une.
${SAUCE_IF_PRESENT}

step_groups : n'inclure un robot QUE s'il apporte quelque chose. Omettre un bloc vide.

JSON :
{ "recipes": [ ${MEAL_JSON_SHAPE}, ... 5 objets ] }`,
    coachBias,
    pastMeals,
    kitchenContext,
  );
}

export function weekendPrompt(
  theme: string,
  coachBias?: HouseholdCoachBias | null,
  pastMeals?: string[],
  kitchenContext?: string,
) {
  return culinaryPrompt(
    `Génère EXACTEMENT 4 repas FRAIS week-end, niveau S34.
JSON = 1 assiette / pers., weight_g (pas de double batch).
${themeConstraintLine(theme, 4)}
ORDRE JSON STRICT :
1. recipes[0] = Samedi DÉJEUNER (cibles midi COACH NUTRITION)
2. recipes[1] = Samedi DÎNER LOW CAL (cibles soir COACH NUTRITION)
3. recipes[2] = Dimanche DÉJEUNER (cibles midi COACH NUTRITION)
4. recipes[3] = Dimanche DÎNER LOW CAL (cibles soir COACH NUTRITION)
${SAUCE_IF_PRESENT} step_groups : n'inclure un robot QUE s'il apporte quelque chose ; omettre un bloc vide.

JSON :
{ "recipes": [ ${MEAL_JSON_SHAPE}, ... 4 objets ] }`,
    coachBias,
    pastMeals,
    kitchenContext,
  );
}

export function recipeFromPhotoPrompt(
  slot: PlannedMeal,
  pair: BatchPair | null,
  theme: string,
  fit: RecipeFit,
  coachBias?: HouseholdCoachBias | null,
  pastMeals?: string[],
  kitchenContext?: string,
) {
  const themeLine = theme.trim()
    ? `Thème saisi en plus (secondaire) : ${theme}. Ne l'utilise que s'il précise la photo (variante, ingrédient). La photo reste la source.`
    : "Pas de thème texte : la photo EST le cahier des charges.";
  const photoBlock = formatRecipePhotoForPrompt(fit);
  if (pair) {
    return culinaryPrompt(
      `${photoBlock}

Génère 1 recette BATCH fidèle à la photo pour : ${pair.label}, niveau S34.
JSON = 1 assiette / pers., weight_g. L'app ×2 (4 assiettes foyer).
Type : ${pairIsMixed(pair) ? "même base midi + soir · JSON 1 assiette midi ; le dîner sera recalé light." : `${pair.mealType}${pair.lowCalorie ? ", créneau DÎNER" : " (déjeuner)"}${fit === "adapt" && pair.lowCalorie ? " — RÉADAPTER en low cal (cibles soir) SANS perdre la star de la photo." : fit === "as-is" ? " — TEL QUEL même le soir : ne pas alléger pour le dîner." : "."}`}
${themeLine}
${SAUCE_IF_PRESENT} step_groups : robot seulement si la photo le justifie ; omettre un bloc vide.

JSON : un objet ${MEAL_JSON_SHAPE} ou { "recipes": [objet] }.`,
      fit === "as-is" ? null : coachBias,
      pastMeals,
      kitchenContext,
    );
  }
  return culinaryPrompt(
    `${photoBlock}

Génère 1 repas frais (${slot.day} ${slot.mealType}) fidèle à la photo, niveau S34.
JSON = 1 assiette / pers., weight_g.
${slot.lowCalorie || slot.mealType === "diner" ? (fit === "adapt" ? "Dîner : réadapter light (cibles soir) sans perdre la star." : "Dîner TEL QUEL : ne pas alléger.") : "Déjeuner."}
${themeLine}
${SAUCE_IF_PRESENT} step_groups : robot seulement si la photo le justifie ; omettre un bloc vide.

JSON : un objet ${MEAL_JSON_SHAPE} ou { "recipes": [objet] }.`,
    fit === "as-is" ? null : coachBias,
    pastMeals,
    kitchenContext,
  );
}

export function singlePrompt(
  slot: PlannedMeal,
  pair: BatchPair | null,
  theme: string,
  coachBias?: HouseholdCoachBias | null,
  pastMeals?: string[],
  kitchenContext?: string,
) {
  const themeLine = themeConstraintLine(theme, 1);
  if (pair) {
    return culinaryPrompt(
      `Génère 1 recette BATCH pour : ${pair.label}, niveau S34 (détaillée ; sauce maison seulement si le plat en a une).
JSON = 1 assiette / pers., weight_g. L'app ×2 (4 assiettes foyer).
Les 2 portions sont sur 2 créneaux, jamais le même jour.
Type : ${pairIsMixed(pair) ? "même base midi + soir · JSON 1 assiette midi ; le dîner sera recalé light (cibles soir)" : `${pair.mealType}${pair.lowCalorie ? ", DÎNER LOW CAL (cibles soir COACH NUTRITION)" : " (déjeuner, cibles midi)"}`}.
${themeLine}
${SAUCE_IF_PRESENT} step_groups : robot seulement si valeur ajoutée ; omettre un bloc vide.

JSON : un objet ${MEAL_JSON_SHAPE} ou { "recipes": [objet] }.`,
      coachBias,
      pastMeals,
      kitchenContext,
    );
  }
  return culinaryPrompt(
    `Génère 1 repas frais (${slot.day} ${slot.mealType}), niveau S34.
JSON = 1 assiette / pers., weight_g.
${slot.lowCalorie || slot.mealType === "diner" ? "Dîner low calorie (cibles soir COACH NUTRITION)." : "Déjeuner : cibles midi."}
${themeLine}
${SAUCE_IF_PRESENT} step_groups : robot seulement si valeur ajoutée ; omettre un bloc vide.

JSON : un objet ${MEAL_JSON_SHAPE} ou { "recipes": [objet] }.`,
    coachBias,
    pastMeals,
    kitchenContext,
  );
}

export function suggestSwapPrompt(meal: PlannedMeal, ingredientName: string, kitchenContext?: string) {
  const ingredient = meal.ingredients.find(
    (item) => item.name.toLowerCase() === ingredientName.trim().toLowerCase(),
  );
  const role = culinaryRole(ingredientName);
  const others = meal.ingredients
    .map((item) => item.name)
    .filter((name) => name.toLowerCase() !== ingredientName.trim().toLowerCase())
    .slice(0, 12)
    .join(", ");
  const use = describeIngredientUse(ingredientName, meal);
  const veganOk =
    !ingredient || ingredient.role === "shared" || ingredient.role === "alexis"
      ? "Si l'ingrédient est partagé ou Alexis : alternatives 100 % vegan."
      : "Élodie seule : protéines animales OK.";
  const roleRule =
    role === "enveloppe"
      ? "ENVELOPPE : 3 autres pains / wraps. JAMAIS un légume."
      : role === "feculent"
        ? "FÉCULENT : 3 féculents de même usage (chaud vs salade)."
        : role === "proteine"
          ? "PROTÉINE : 3 protéines du même régime, même technique (mariné cru vs rôti)."
          : role === "sauce"
            ? "SAUCE : 3 sauces maison du même rôle dans CE plat."
            : role === "legume"
              ? "LÉGUME : 3 légumes qui gardent GOÛT + TEXTURE + CUISSON de celui-ci dans CETTE recette."
              : "Garde la même fonction dans l'assiette.";
  return culinaryPrompt(`Recette : ${meal.baseName} (thème « ${meal.theme} »).
Étapes : ${meal.steps.filter((line) => !line.startsWith("§")).slice(0, 6).join(" | ")}
Déjà dans la recette (NE PAS les reproposer) : ${others || "—"}.
Ingrédient à remplacer : "${ingredientName}" (${ingredient?.notes ?? ingredient?.visualQuantity ?? ""}).
${use}
Propose EXACTEMENT 3 alternatives culinaires pour CE plat, pas 3 aliments au hasard de la même catégorie.
Si un STOCK FOYER est fourni et qu'un item a le même rôle culinaire, mets-le en suggestion n°1 (sans casser la règle de rôle).
${roleRule}
${veganOk}
N'écris aucune formule négative (« sans X »).

JSON : { "suggestions": ["alt1", "alt2", "alt3"] }`,
    undefined,
    undefined,
    kitchenContext,
  );
}

function todaySlotBrief(mealType: MealType) {
  switch (mealType) {
    case "petit-dejeuner":
      return `PETIT-DÉJEUNER du jour. Vise ~25 % des kcal journalières de CHAQUE profil (bloc COACH NUTRITION, daily). Express.`;
    case "collation":
      return `COLLATION du jour. Vise ~15 % des kcal journalières. Dense en protéine, pas un snack industriel sucré.`;
    case "diner":
      return `DÎNER du jour, LOW CAL : cibles soir COACH NUTRITION (hors dessert).`;
    default:
      return `DÉJEUNER du jour : cibles midi COACH NUTRITION (hors dessert).`;
  }
}

export function dessertBatchPrompt(
  theme: string,
  coachBias?: HouseholdCoachBias | null,
  pastMeals?: string[],
  kitchenContext?: string,
  slot: "midi" | "soir" = "midi",
) {
  const evening = slot === "soir";
  const themeLine = theme.trim()
    ? `THÈME DESSERT : « ${theme.trim()} ». Le titre et un ingrédient majeur incarnent ce thème. INTERDIT un plat salé.${evening ? " Version LIGHT du thème (jamais un dessert dense déguisé)." : ""}`
    : evening
      ? "Pas de thème imposé — invente un dessert soir light vegan."
      : "Pas de thème imposé — invente un dessert midi maison.";
  const bias = formatCoachBiasForPrompt(coachBias);
  const memory = formatPastMealsForPrompt(pastMeals);
  const head = evening
    ? `Tu es Gem Chef pâtissier light. Dessert SOIR batch foyer : très faible calorie, gourmand, actionnable.
1 SEUL dessert pour PLUSIEURS soirs. JSON = 1 part / personne.
Alexis vegan : tofu soyeux / konjac OK. INTERDIT lait animal, beurre, œufs, fromage, gélatine, miel, pâte brisée, crème.
Élodie : même base vegan. Pas de mascarpone.
Tofu soyeux : CUISSON / mixage autorisés. Konjac / shirataki : rincer, égoutter, parfumer — jamais du vrai riz à côté.
Plafond ~70 kcal / part. INTERDIT plat salé.
MÊME dessert, MÊMES ingrédients. INTERDIT deux versions. Perte = extras denses plus petits. visual_unit = grammes (1 cs sirop ≈ 20 g).`
    : `Tu es Gem Chef pâtissier. Dessert midi batch foyer : condensé, gourmand, actionnable.
1 SEUL dessert maison pour PLUSIEURS déjeuners. JSON = 1 part / personne (pas le total fournée).
Alexis vegan : tofu soyeux cuit / mixé / four OK. INTERDIT lait animal, beurre, œufs, fromage, gélatine, miel.
Élodie : même base vegan de préférence. Sinon œufs / skyr / fromage blanc UNIQUEMENT dans profile_2_ingredients.
Tofu soyeux : CUISSON autorisée. Tient 3 à 5 jours au frigo, portions individuelles.
INTERDIT plat salé. Vrai riz interdit (sauf konjac du PRODUIT FOYER).
MÊME dessert pour Alexis et Élodie. MÊMES ingrédients (grammes différents OK). INTERDIT deux versions (light vs gourmand).
La personne en PERTE a les PLUS PETITES portions des extras denses, jamais plus.
visual_unit doit coller aux grammes. INTERDIT 2 cs = 99 g.
profile_2_ingredients : produit animal seulement si CE dessert le demande. Pas une version gourmande Élodie.`;
  return `${head}
Four / TM seulement s'ils servent. visual_unit sur chaque ingrédient. Titre = le dessert seulement.
Si un PRODUIT FOYER est fourni, il EST l'ingrédient star (grammes visibles). Un dessert classique + ce produit = le classique FAIT AVEC ce produit, pas les deux.

${kitchenContext ? `${kitchenContext}\n` : ""}
${themeLine}
${memory ? `\n${memory}\n` : ""}
${bias ? `\n${bias}\n` : ""}
Réponds UNIQUEMENT en JSON valide, sans markdown. SQUELETTE de clés — INTERDIT d'en copier un dessert :
{
  "title": "<nom du dessert>",
  "shared_ingredients": [
    { "name": "<ingrédient>", "grams_alexis": 80, "grams_elodie": 80, "visual_unit": "<pièce ou cs>" }
  ],
  "profile_1_ingredients": [],
  "profile_2_ingredients": [],
  "step_groups": [
    { "section": "${evening ? "Plaque" : "Four"}", "steps": ["<geste utile>"] },
    { "section": "Assemblage", "steps": ["<portions, frigo>"] }
  ],
  "tips_and_cautions": ["<logistique conservation>"]
}`;
}

function dessertIngredientBrief(meal: PlannedMeal) {
  return meal.ingredients
    .map(
      (item) =>
        `${item.name} · A ${item.gramsAlexis}g / É ${item.gramsElodie}g${item.visualQuantity ? ` (${item.visualQuantity})` : ""}`,
    )
    .join(" ; ");
}

export function dessertSuggestSwapPrompt(
  meal: PlannedMeal,
  ingredientName: string,
  kitchenContext?: string,
  slot: "midi" | "soir" = "midi",
) {
  const others = meal.ingredients
    .map((item) => item.name)
    .filter((name) => name.toLowerCase() !== ingredientName.trim().toLowerCase())
    .join(", ");
  const evening = slot === "soir";
  return `Tu es Gem Chef pâtissier${evening ? " light" : ""}. Dessert foyer : « ${meal.baseName} »${meal.theme ? ` (thème « ${meal.theme} »)` : ""}.
JSON = 1 part / personne. Alexis vegan.
Ingrédients actuels : ${dessertIngredientBrief(meal) || "—"}.
Déjà dans la recette (NE PAS les reproposer) : ${others || "—"}.
Ingrédient à remplacer : « ${ingredientName} ».

Propose EXACTEMENT 3 alternatives pâtisserie pour CE dessert, pas 3 aliments au hasard.
PRIORITÉ n°1 : plus light / moins calorique, tout en restant gourmand et cuisinable. Même rôle dans le dessert.
INTERDIT plat salé.
INTERDIT de proposer le même ingrédient, ou un simple « moins de X » sans autre aliment.
Si un STOCK FOYER a le même rôle, mets-le en suggestion n°1.
N'écris aucune formule négative (« sans X »).

${kitchenContext ? `${kitchenContext}\n` : ""}
JSON : { "suggestions": ["alt1", "alt2", "alt3"] }`;
}

export function dessertApplySwapPrompt(
  meal: PlannedMeal,
  ingredientName: string,
  replacement: string,
  pastMeals?: string[],
  kitchenContext?: string,
  slot: "midi" | "soir" = "midi",
) {
  const evening = slot === "soir";
  const memory = formatPastMealsForPrompt(pastMeals);
  const head = evening
    ? `Tu es Gem Chef pâtissier light. Dessert SOIR. Plafond ~70 kcal / part. Tofu soyeux / konjac OK.`
    : `Tu es Gem Chef pâtissier. Dessert midi maison.`;
  return `${head}
Réadapte TOUT le dessert « ${meal.baseName} » en remplaçant « ${ingredientName} » par « ${replacement} ».
Ingrédients actuels : ${dessertIngredientBrief(meal)}.
Garde le même dessert (titre proche OK si le remplacant change le goût). Recalcule grammes ET visual_unit.
visual_unit doit coller aux grammes. INTERDIT 2 cs = 99 g.
MÊME dessert, MÊMES ingrédients pour Alexis et Élodie (grammes différents OK). INTERDIT deux versions.
Si le remplacant est un édulcorant, retire le sucre / sirop qu'il remplace.
Perte = extras denses plus petits. Tofu soyeux cuisson OK. INTERDIT plat salé.
Alexis vegan : pas de lait animal, beurre, œufs, miel.
Four / TM seulement s'ils servent. Titre = le dessert seulement.

${kitchenContext ? `${kitchenContext}\n` : ""}
${memory ? `\n${memory}\n` : ""}
Réponds UNIQUEMENT en JSON valide, sans markdown. SQUELETTE de clés — INTERDIT d'en copier un dessert :
{
  "title": "${meal.baseName.replace(/"/g, "")}",
  "shared_ingredients": [
    { "name": "<ingrédient>", "grams_alexis": 80, "grams_elodie": 80, "visual_unit": "<pièce ou cs>" }
  ],
  "profile_1_ingredients": [],
  "profile_2_ingredients": [],
  "step_groups": [
    { "section": "${evening ? "Plaque" : "Four"}", "steps": ["<geste utile>"] },
    { "section": "Assemblage", "steps": ["<portions, frigo>"] }
  ],
  "tips_and_cautions": ["<logistique conservation>"]
}`;
}

export function todaySwapPrompt(
  mealType: MealType,
  theme: string,
  coachBias?: HouseholdCoachBias | null,
  pastMeals?: string[],
  kitchenContext?: string,
) {
  return culinaryPrompt(
    `Génère 1 SEUL repas FRAIS pour AUJOURD'HUI — pas un batch de la semaine, pas un couple de créneaux.
JSON = 1 assiette / pers., weight_g. INTERDIT de doubler.
MÊME plat pour Alexis et Élodie. INTERDIT deux recettes.
PAS de dessert, yaourt sucré, granola dessert (déjà sur la carte Aujourd'hui).
${todaySlotBrief(mealType)}
Repas du jour (pas une session batch Lun–Ven).
Sauce maison dosée SI le plat en a une. INTERDIT d'en coller une pour remplir.
${themeConstraintLine(theme, 1)}
${SAUCE_IF_PRESENT} step_groups : robot seulement si valeur ajoutée ; omettre un bloc vide.
tips_and_cautions : logistique du repas du jour seulement.

JSON : un objet ${MEAL_JSON_SHAPE} ou { "recipes": [objet] }.`,
    coachBias,
    pastMeals,
    kitchenContext,
  );
}

export function applySwapPrompt(
  meal: PlannedMeal,
  ingredientName: string,
  replacement: string,
  pastMeals?: string[],
  kitchenContext?: string,
) {
  return culinaryPrompt(
    `Réadapte TOUTE la recette "${meal.baseName}" en remplaçant "${ingredientName}" par "${replacement}".
Garde thème, double déclinaison, réglages appareils. Omettre un step_group vide.
${SAUCE_IF_PRESENT}
Recalcule weight_g et étapes. Astuces = logistique batch seulement.

JSON : un objet ${MEAL_JSON_SHAPE}.`,
    undefined,
    pastMeals,
    kitchenContext,
  );
}

export async function callGeminiPro(
  prompt: string,
  images?: GeminiPart[],
): Promise<GeminiCallResult & { mock: boolean }> {
  const result = await generateGeminiJson({
    preferredTier: "pro",
    fallbackTier: "flash",
    parts: [...(images ?? []), { text: prompt }],
    temperature: 0.9,
    logLabel: "MEAL GEN",
  });
  return { ...result, mock: false };
}

export async function callGeminiDessert(prompt: string): Promise<GeminiCallResult & { mock: boolean }> {
  const result = await generateGeminiJson({
    preferredTier: "pro",
    fallbackTier: "flash",
    parts: [{ text: prompt }],
    temperature: 0.55,
    maxOutputTokens: 4096,
    maxModelsPerTier: 1,
    logLabel: "DESSERT GEN",
  });
  return { ...result, mock: false };
}
