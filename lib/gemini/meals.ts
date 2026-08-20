import type { Appliance, MealType, PlannedMeal, RecipeDeclination, RecipeIngredient } from "@/lib/types";
import { WEEKDAY_BATCHES, type BatchPair } from "@/lib/weekly-plan";
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
import { stripThemeSticker, themeConstraintLine } from "@/lib/theme-kits";
import { culinaryRole, describeIngredientUse } from "@/lib/swap-coherence";
import { visualForIngredient } from "@/lib/visual-quantity";
import { declinationFromIngredients } from "@/lib/recipe-macros";
import { motifsIn } from "@/lib/recipe-diversity";
import { generateGeminiJson, type GeminiCallResult } from "@/lib/gemini/models";

export type GenerateMealsMode =
  | "weekdays"
  | "weekend"
  | "single"
  | "suggest-swap"
  | "apply-swap"
  | "today-swap";

export type GeminiMealJson = {
  title: string;
  shared_ingredients: unknown;
  profile_1_ingredients: unknown;
  profile_2_ingredients: unknown;
  step_groups?: unknown;
  step_by_step_instructions: unknown;
  tips_and_cautions: unknown;
};

const CULINARY_LAWS = `Tu es Gem Chef Cuistot. Tu écris comme le plan S34 : condensé, gourmand, actionnable. Zéro blabla diététique.

Foyer : Alexis (vegan) et Élodie (omnivore). Base partagée, protéine seule déclinée.

════════════════════════════════
PRÉFÉRENCES FOYER = SOURCE DE VÉRITÉ
════════════════════════════════
Aversions, goûts, type de recette (express / équilibré / gastro) et règles batch viennent du bloc PRÉFÉRENCES FOYER fourni plus bas.
N'écris JAMAIS « sans X », « pas de piment », « aversion », « exclu ». Si un ingrédient ne va pas, OMETS-le silencieusement.
Chaleur autorisée par défaut (sauf si les prefs disent doux) : paprika fumé, cumin, gingembre frais, 5-épices, poivre, raifort, moutarde. Jamais le mot piment / cayenne / jalapeño.
Herbes fraîches : menthe, basilic, persil, ciboulette. JAMAIS de coriandre.

════════════════════════════════
SAUCE NOMMÉE OBLIGATOIRE (GOÛT GARANTI)
════════════════════════════════
INTERDIT : plat sec, bowl fade, riz + légume + protéine nature, sauce du commerce, « Assembler. » tout seul.
CHAQUE repas A une sauce, vinaigrette ou marinade NOMMÉE dans le titre (ex. « Vinaigrette raifort-noix », « Sauce tahini-citron », « Marinade soja-gingembre-sésame »).
Tous les composants de cette sauce sont des lignes d'ingrédients séparées, CHACUNE avec weight_g ET visual_unit (cc / cs / gousse / cm / pièce) — exactement comme le reste du plat.
INTERDIT : une seule ligne « Sauce satay 40g » ou « pesto du commerce » avec les ingrédients seulement en note. INTERDIT sauce du rayon.
Satay maison (beurre de sésame, jamais cacahuète) : beurre de sésame + sauce soja + citron + gingembre + agave + ail, chacun en ligne dosée.
Houmous / pesto / nuoc / vinaigrette : même règle, sous-recette maison dosée.
Épices complexes + agrumes + herbe fraîche sur presque chaque plat.

════════════════════════════════
APPAREILS — VALEUR AJOUTÉE UNIQUEMENT
════════════════════════════════
N'invente JAMAIS une étape robot si un geste manuel suffit.
Thermomix : UNIQUEMENT mixer / émulsionner / hacher (houmous, pesto, gazpacho, vinaigrette complexe 3+ ingrédients). INTERDIT : TM pour la moutarde seule, « ajouter le cumin au TM », « mélanger les épices au TM ». Vinaigrette simple (moutarde + citron + huile) : fouetter dans un pot, pas de TM.
Airfryer : UNIQUEMENT vraie cuisson parallèle vegan/omni, avec °C + min. INTERDIT pour tofu semaine, gazpacho, toast, salade.
KitchenAid : UNIQUEMENT si râpé fin / lamelles / spaghettis. Ciseler la menthe = couteau.
Omettre le step_group entier s'il ne sert à rien. Ne jamais remplir un bloc vide avec du remplissage.

PAS-À-PAS : uniquement les blocs utiles, phrases courtes et chargées :
1. Protéines (Airfryer) — si vraie cuisson — parallèle vegan/omni, °C + min. Tofu semaine : hors panier, pressé, mariné cru (soja, sésame, gingembre, agrume).
2. Féculents / eau — UNE durée par ingrédient si les temps diffèrent (ex. haricots verts : eau 8 min ; pommes de terre : eau 18 min). Riz : cuiseur à riz. Cookeo lentilles/quinoa. Galette, naan, pain, wrap : poêle ou four, JAMAIS à l'eau. INTERDIT d'appliquer un seul « 8 min » à toute la ligne.
3. Thermomix — SEULEMENT si on mixe vraiment, avec « 10 sec / V7 » (ou V6).
4. Découpes — UNE phrase par légume, coupe explicite : « Courgette : spaghettis KitchenAid. » « Carotte : râpé fin. » « Menthe : ciselée. »
5. Assemblage — liste TOUS les ingrédients du plat (Commun / Alexis / Élodie) + ordre dans la boîte + sauce au pot. INTERDIT d'y mettre une cuisson (lentilles, riz) ou une découpe (trancher les tomates).

visual_unit obligatoire : légumes en pièces ("2 pièces", "1/4 chou", "1/2 botte"), sauces/épices en cc/cs.
Houmous / nuoc / pesto / satay / vinaigrette = sous-recette maison (ingrédients séparés). TM seulement si on mixe.

Express (défaut) : zéro cuisson lourde, assemblage tupperware. Gastro seulement si les prefs le demandent.

════════════════════════════════
LOIS CUISINE
════════════════════════════════
- Riz : cuiseur à riz. Cookeo = lentilles, quinoa, vapeur.
- Galette / naan / pain / wrap : poêle ou four. JAMAIS de cuisson à l'eau.
- Dîners low cal savoureux si les prefs l'exigent (huile ≤ 8 g pour la perte ; la prise garde la protéine).
- Tofu Lun–Ven : presser, mariner cru, frais — jamais cuit pendant le batch (sauf dessert).
- Simili-carnés : week-end, sauf prefs contraires.
- tips_and_cautions : UNIQUEMENT logistique batch (ex. « Conservez la sauce à part dans un pot hermétique »). Jamais d'aversions, jamais « sans X ».

════════════════════════════════
PORTIONS COACH (PAS UNE MOYENNE FOYER)
════════════════════════════════
Le bloc COACH NUTRITION plus bas donne les kcal / P / G / L midi et soir de CHAQUE profil.
MÊME plat, grammes différents : grams_alexis + grams_elodie sur féculents, huile, légumes, légumineuses.
INTERDIT deux recettes. INTERDIT des assiettes identiques si les cibles divergent.
Perte = volume légumes + umami (soja, agrume, moutarde, herbes). Prise = densité (riz, tofu/protéine, tahini).
Protéine plancher : ne jamais alléger tofu / poulet / poisson pour « faire light ».
Pas de dessert dans la recette (templates Paramètres). Pas de discours diététique dans les étapes.

════════════════════════════════
THÈME
════════════════════════════════
Si un thème est fourni (ex. Coréen, Thaï, Italien, Tomate), CHAQUE recette du lot EST de cette cuisine / de cet ingrédient-star.
Titre, base partagée, ingrédient majeur et une étape dédiée : le thème est central, jamais un sous-titre.
INTERDIT de coller « · Coréen » (ou autre) sur un bowl satay, zaalouk, kefta, pesto, niçoise.
INTERDIT d'imiter la CUISINE de l'exemple JSON plus bas — c'est un FORMAT (clés, densités, visual_unit), pas un plat à recopier.
Français express : niçoise, taboulé, velouté TM, pistou — pas un tian de 40 min sauf mode gastro.
Coréen (sans piment / coriandre / cacahuète) : bibimbap, japchae, kimbap, namul sésame, banchan concombre, marinade soja-poire-ail-sésame (style bulgogi). Nori, daikon, épinards, pousses de soja. Pas de gochujang / piment.

════════════════════════════════
EXEMPLE S34 (imiter la densité, pas copier le piment)
════════════════════════════════
Titre : Bowl fraîcheur courgettes, vinaigrette soja-gingembre-agave
Base : spaghettis de 2 courgettes, 3 carottes râpées, 1/4 chou rouge, edamame, 1/2 botte menthe.
Sauce : 1 cm gingembre, 3 cs soja, jus d'1/2 citron vert, 1 cs huile sésame, 1 cc agave. TM 10 sec / V7.
Végane : tofu mariné soja-sésame (cru). Classique : crevettes airfryer 190°C · 8 min.
Montage : légumes + menthe dans les boîtes, protéines, sauce au pot.`;

export const MEAL_JSON_SHAPE = `{
  "title": "Bowl fraîcheur courgettes, vinaigrette soja-gingembre-agave",
  "shared_ingredients": [
    { "name": "Courgette", "weight_g": 200, "visual_unit": "1 pièce", "prep": "spaghettis KitchenAid" },
    { "name": "Carotte", "weight_g": 160, "visual_unit": "2 pièces", "prep": "râpé fin KitchenAid" },
    { "name": "Chou rouge", "weight_g": 80, "visual_unit": "1/4 chou", "prep": "râpé fin" },
    { "name": "Edamame décortiqués", "grams_alexis": 90, "grams_elodie": 70, "visual_unit": "1 poignée" },
    { "name": "Menthe fraîche", "weight_g": 15, "visual_unit": "1/2 botte", "prep": "ciselée" },
    { "name": "Sauce soja", "weight_g": 18, "visual_unit": "1 cs" },
    { "name": "Citron vert", "weight_g": 30, "visual_unit": "1/2 pièce", "prep": "jus" },
    { "name": "Huile de sésame", "grams_alexis": 10, "grams_elodie": 6, "visual_unit": "1/2 cs" },
    { "name": "Riz cuit", "grams_alexis": 180, "grams_elodie": 100, "visual_unit": "1 bol" },
    { "name": "Gingembre frais", "weight_g": 8, "visual_unit": "1 cm" },
    { "name": "Sirop d'agave", "weight_g": 5, "visual_unit": "1 cc" }
  ],
  "profile_1_ingredients": [{ "name": "Tofu ferme", "weight_g": 150, "visual_unit": "1/2 bloc", "prep": "dés, mariné soja-sésame" }],
  "profile_2_ingredients": [{ "name": "Crevettes décortiquées", "weight_g": 150, "visual_unit": "1 barquette", "prep": "airfryer" }],
  "step_groups": [
    { "section": "Cuissons Airfryer", "steps": ["190°C · 8 min : crevettes Élodie. Pois chiches rôtis Alexis si besoin. Tofu : hors panier."] },
    { "section": "Cuissons Eau / Plaques", "steps": ["Edamame : 3 min à l'eau bouillante, rafraîchir.", "Riz : cuiseur à riz.", "Haricots verts : eau 8 min.", "Pommes de terre : eau 18 min, dés."] },
    { "section": "Thermomix", "steps": ["Vinaigrette soja-gingembre-agave : gingembre 1 cm, sauce soja 18 g, jus de citron vert, huile sésame 1/2 cs, agave 1 cc. 10 sec / V7. Racler. 5 sec / V7. Pots hermétiques."] },
    { "section": "Découpes KitchenAid", "steps": ["Courgette : spaghettis KitchenAid.", "Carotte : râpé fin.", "Chou rouge : râpé fin.", "Menthe : ciselée."] },
    { "section": "Assemblage", "steps": ["Tous les ingrédients : courgettes, carottes, chou, edamame, menthe, vinaigrette soja-gingembre-agave. Tofu pressé mariné Alexis / crevettes Élodie. Boîtes : légumes au fond, protéines sur le côté, sauce au pot."] }
  ],
  "tips_and_cautions": ["Conservez la sauce à part et mélangez au moment de servir."]
}`;

export function formatPastMealsForPrompt(pastMeals?: string[]) {
  const titles = [...new Set((pastMeals ?? []).map((title) => title.trim()).filter(Boolean))];
  if (titles.length === 0) {
    return `DIVERSITÉ : dans ce lot, chaque recette a une identité propre (féculent, sauce, pays, légumes). Interdit de décliner 5 fois la même sauce (ex. 5 chermoula).`;
  }
  const families = [...new Set(titles.flatMap((title) => motifsIn(title)))];
  return `TITRES INTERDITS (ne les réécris JAMAIS, même reformulés — y compris la liste foyer « Plus jamais ») : [${titles.join(" | ")}].
${families.length ? `FAMILLES DÉJÀ SERVIÉS — change de sauce ET de plat : ${families.join(", ")}.` : ""}
Invente des recettes nouvelles. 1 lot = 1 identité par recette. Max 1 fois la même famille (chermoula, yassa, satay, etc.).`;
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
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => parseOneShared(item, index));
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
  if (steps.some(isKitchenAidCut) || /râpé fin|lamelles|spaghettis/.test(noteText)) {
    list.push("KitchenAid");
  }
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
    steps: steps.length ? steps : slot.steps,
    tips: logistics,
    cautions: [],
    alexis: macrosFromIngredients(ingredients, "alexis"),
    elodie: macrosFromIngredients(ingredients, "elodie"),
  };
  const expanded = expandPreparedSauces(planned);
  return {
    ...expanded,
    alexis: macrosFromIngredients(expanded.ingredients, "alexis"),
    elodie: macrosFromIngredients(expanded.ingredients, "elodie"),
  };
}

export function extractRecipes(parsed: unknown): GeminiMealJson[] {
  if (!parsed || typeof parsed !== "object") return [];
  const rec = parsed as Record<string, unknown>;
  if (Array.isArray(rec.recipes)) return rec.recipes as GeminiMealJson[];
  if (typeof rec.title === "string") return [parsed as GeminiMealJson];
  return [];
}

export function extractSuggestions(parsed: unknown): string[] {
  if (!parsed || typeof parsed !== "object") return [];
  const rec = parsed as Record<string, unknown>;
  const list = asList(rec.suggestions);
  return list.slice(0, 3);
}

export function weekdaysPrompt(
  theme: string,
  coachBias?: HouseholdCoachBias | null,
  pastMeals?: string[],
  kitchenContext?: string,
) {
  const batches = WEEKDAY_BATCHES.map(
    (pair, index) =>
      `${index + 1}. recipes[${index}] = ${pair.label} — ${pair.mealType}${pair.lowCalorie ? " · DÎNER LOW CAL (cibles soir COACH NUTRITION, huile serrée, féculent allégé, protéine gardée)" : " · déjeuner (cibles midi COACH NUTRITION par profil, pas une moyenne foyer)"}`,
  ).join("\n");
  return culinaryPrompt(
    `Génère EXACTEMENT 5 recettes BATCH Lundi–Vendredi, niveau S34 (détaillées, sauces maison, herbes, épices, légumes en nombre de pièces).
Règle portions : JSON = 1 repas / personne. L'utilisateur cuisinera ×2 (4 assiettes foyer).
grams_alexis / grams_elodie obligatoires sur féculents, huile, légumes, légumineuses (voir COACH NUTRITION).
Batch ×2 : jours ALTERNÉS (Lun+Mer, Mar+Jeu). Vendredi déj+dîner = même base, dîner plaqué plus léger.
Tofu : presser, mariner, servir frais.
visual_unit OBLIGATOIRE sur chaque légume / herbe / agrume.
Houmous = sous-recette pois chiches + tahini + citron + ail + cumin (jamais un pot).
${themeConstraintLine(theme, 5)}
ORDRE JSON STRICT — ne permute JAMAIS les index :
${batches}
recipes[2] et recipes[3] = SOIRS uniquement, vraiment low cal selon les cibles soir de CHAQUE profil (plus de légumes, moins d'huile/féculent, protéine intacte).
recipes[4] = même base Ven midi + soir ; le soir sera dressé plus léger.
Les 5 titres doivent être nettement distincts (féculent + sauce + légume star différents).
Tofu Lun–Ven : hors Airfryer, mariné cru au frais, dressé à l'assemblage.
Chaque titre NOMME la sauce (vinaigrette / marinade / sauce X).

step_groups : n'inclure un robot QUE s'il apporte quelque chose. Omettre un bloc vide.
Airfryer seulement si vraie cuisson (jamais le tofu en semaine). Jamais de gazpacho à l'airfryer.
Thermomix seulement pour mixer / émulsionner (jamais « ajouter le cumin au TM »).
KitchenAid seulement si râpé fin / lamelles / spaghettis.

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
Règle : 1 recette = 1 seul repas / personne (pas de double batch).
Portions : grams_alexis / grams_elodie selon COACH NUTRITION (pas une moyenne foyer).
Week-end : tofu poêlé / four / airfryer OK. Simili-carnés OK.
Houmous = sous-recette pois chiches + tahini + citron + ail + cumin (jamais un pot).
${themeConstraintLine(theme, 4)}
ORDRE JSON STRICT — les 4 dans le thème, sans exception :
1. recipes[0] = Samedi DÉJEUNER (cibles midi COACH NUTRITION)
2. recipes[1] = Samedi DÎNER LOW CAL (cibles soir, huile serrée, féculent allégé, protéine gardée)
3. recipes[2] = Dimanche DÉJEUNER (cibles midi COACH NUTRITION)
4. recipes[3] = Dimanche DÎNER LOW CAL (cibles soir, huile serrée, féculent allégé, protéine gardée)
Chaque titre NOMME la sauce. step_groups : n'inclure un robot QUE s'il apporte quelque chose ; omettre un bloc vide.
Airfryer seulement si vraie cuisson. Thermomix seulement pour mixer / émulsionner.

JSON :
{ "recipes": [ ${MEAL_JSON_SHAPE}, ... 4 objets ] }`,
    coachBias,
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
      `Génère 1 recette BATCH pour : ${pair.label}, niveau S34 (détaillée, sauces maison).
Règle : JSON = 1 repas / personne. L'utilisateur cuisinera ×2 (4 assiettes foyer).
grams_alexis / grams_elodie selon COACH NUTRITION.
Les 2 portions sont sur des jours ALTERNÉS, jamais consécutifs.
Tofu : presser, mariner, servir frais (cuisson seulement si dessert).
Type : ${pair.mealType}${pair.lowCalorie ? ", DÎNER LOW CAL (cibles soir, huile serrée, féculent allégé, protéine gardée)" : " (déjeuner, cibles midi par profil)"}.
Houmous = sous-recette pois chiches + tahini + citron + ail + cumin (jamais un pot).
${themeLine}
Chaque titre NOMME la sauce. step_groups : robot seulement si valeur ajoutée ; omettre un bloc vide.
Thermomix seulement pour mixer / émulsionner.

JSON : un objet ${MEAL_JSON_SHAPE} ou { "recipes": [objet] }.`,
      coachBias,
      pastMeals,
      kitchenContext,
    );
  }
  return culinaryPrompt(
    `Génère 1 repas frais (${slot.day} ${slot.mealType}), niveau S34.
Règle week-end : 1 recette = 1 seul repas / personne. Tofu cuit et simili-carnés autorisés.
Portions grams_alexis / grams_elodie selon COACH NUTRITION.
${slot.lowCalorie || slot.mealType === "diner" ? "Dîner low calorie (cibles soir, huile serrée, féculent allégé, protéine gardée)." : "Déjeuner : cibles midi par profil."}
Houmous = sous-recette pois chiches + tahini + citron + ail + cumin.
${themeLine}
Sous-recettes + weight_g + visual_unit + réglages appareils : obligatoires.
Chaque titre NOMME la sauce. step_groups : robot seulement si valeur ajoutée ; omettre un bloc vide.

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
            ? "SAUCE : 3 sauces maison du même profil (acide / onctueux / soja)."
            : role === "legume"
              ? `LÉGUME : 3 légumes qui gardent GOÛT + TEXTURE + CUISSON de celui-ci dans CETTE recette.
Exemple : navet rôti en tian → panais, rutabaga, céleri-rave. PAS concombre, PAS haricot vert.
Carotte râpée crue → betterave crue, céleri-rave, panais. PAS aubergine rôtie.`
              : "Garde la même fonction dans l'assiette.";
  return culinaryPrompt(`Recette : ${meal.baseName} (thème « ${meal.theme} »).
Étapes : ${meal.steps.filter((line) => !line.startsWith("§")).slice(0, 6).join(" | ")}
Déjà dans la recette (NE PAS les reproposer) : ${others || "—"}.
Ingrédient à remplacer : "${ingredientName}" (${ingredient?.notes ?? ingredient?.visualQuantity ?? ""}).
${use}
Propose EXACTEMENT 3 alternatives culinaires pour CE plat, pas 3 aliments au hasard de la même catégorie.
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
      return `PETIT-DÉJEUNER du jour. Vise ~25 % des kcal journalières de CHAQUE profil (bloc COACH NUTRITION, daily). Express OK (overnight oats, scramble tofu/œufs, toast). Tartinade / sauce maison si pertinent.`;
    case "collation":
      return `COLLATION du jour. Vise ~15 % des kcal journalières. Dense en protéine, pas un snack industriel sucré.`;
    case "diner":
      return `DÎNER du jour, LOW CAL : cibles soir COACH NUTRITION (hors dessert). Huile serrée, féculent allégé, protéine gardée.`;
    default:
      return `DÉJEUNER du jour : cibles midi COACH NUTRITION (hors dessert).`;
  }
}

export function todaySwapPrompt(
  mealType: MealType,
  theme: string,
  coachBias?: HouseholdCoachBias | null,
  pastMeals?: string[],
  kitchenContext?: string,
) {
  return culinaryPrompt(
    `Génère 1 SEUL repas FRAIS pour AUJOURD'HUI — pas un batch de la semaine, pas un couple Lun+Mer.
Règle : 1 recette = 1 portion / personne (comme un repas week-end). INTERDIT de doubler.
MÊME plat pour Alexis et Élodie. grams_alexis / grams_elodie selon COACH NUTRITION. INTERDIT deux recettes.
PAS de dessert, yaourt sucré, granola dessert (déjà sur la carte Aujourd'hui).
${todaySlotBrief(mealType)}
Repas du jour (pas une session batch Lun–Ven) : tofu cuit et simili-carnés OK si le plat le demande.
Houmous / satay / pesto / vinaigrette = sous-recette maison dosée.
${themeConstraintLine(theme, 1)}
Chaque titre NOMME la sauce. step_groups : robot seulement si valeur ajoutée ; omettre un bloc vide.
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
Garde thème, double déclinaison, visual_unit, sous-recettes, réglages appareils. Omettre un step_group vide. Jamais de gazpacho à l'airfryer.
Recalcule grammes, visual_unit, étapes. Astuces = logistique batch seulement.

JSON : un objet ${MEAL_JSON_SHAPE}.`,
    undefined,
    pastMeals,
    kitchenContext,
  );
}

export async function callGeminiPro(prompt: string): Promise<GeminiCallResult & { mock: boolean }> {
  const result = await generateGeminiJson({
    preferredTier: "pro",
    fallbackTier: "flash",
    parts: [{ text: prompt }],
    temperature: 0.9,
    logLabel: "MEAL GEN",
  });
  return { ...result, mock: false };
}
