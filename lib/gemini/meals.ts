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
import { equalizeSharedSauce } from "@/lib/ingredient-groups";
import { stripThemeSticker, themeConstraintLine } from "@/lib/theme-kits";
import { repairMealIntegrity } from "@/lib/recipe-integrity";
import { isDessertRecipe } from "@/lib/recipe-kind";
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

const CULINARY_LAWS = `Tu es Gem Chef Cuistot. Tu écris comme le plan S34 : condensé, gourmand, actionnable. Zéro blabla diététique.

Foyer : Alexis (vegan) et Élodie (omnivore). Base partagée. Protéine déclinée vegan / omni SAUF si le thème ou le titre EST la protéine (falafel, wrap falafel) : alors la MÊME protéine pour les deux, en shared_ingredients. INTERDIT de remplacer les falafels d'Élodie par des crevettes ou du poulet.

════════════════════════════════
PRÉFÉRENCES FOYER = SOURCE DE VÉRITÉ
════════════════════════════════
Aversions, goûts, type de recette (express / équilibré / gastro) et règles batch viennent du bloc PRÉFÉRENCES FOYER fourni plus bas.
N'écris JAMAIS « sans X », « pas de piment », « aversion », « exclu ». Si un ingrédient ne va pas, OMETS-le silencieusement.
Chaleur autorisée par défaut (sauf si les prefs disent doux) : paprika fumé, cumin, gingembre frais, 5-épices, poivre, raifort, moutarde. Jamais le mot piment / cayenne / jalapeño.
Herbes fraîches : menthe, basilic, persil, ciboulette. JAMAIS de coriandre.

════════════════════════════════
SAUCES DU PLAT — GROUPES NOMMÉS
════════════════════════════════
INTERDIT : plat sec, bowl fade, riz + légume + protéine nature, sauce du commerce, « Assembler. » tout seul.
Chaque plat salé a au moins une sauce / marinade / condiment NOMMÉE, CHOISIE POUR CE PLAT.
Marinade (protéine) ET sauce de service (wrap, mayo, tahini, vinaigrette) = DEUX groupes distincts, chacun explosé en lignes dosées. INTERDIT de tout coller sous un seul titre « Sauce » si les rôles diffèrent.
Le mot « vinaigrette » n'est PAS obligatoire. INTERDIT d'ajouter en plus une vinaigrette moutarde + citron + huile d'olive « pour marquer une sauce ».
INTERDIT vinaigrette moutarde-citron-huile sur un plat asiatique / satay / tahini / soja / sésame / pesto.
Tous les composants de CHAQUE groupe sont des lignes séparées, chacune avec weight_g ET visual_unit.
Citron / lait de soja / tahini / soja d'une sauce : lignes de CETTE sauce, jamais du plat à mettre dans la boîte.
Marinade : soja, gingembre, ail… restent dans le groupe Marinade. À l'assemblage on met la protéine marinée, PAS les ingrédients de marinade dans la boîte.
Mayo / aïoli : lait de soja, moutarde, huile — groupe Mayo, pot à part.
INTERDIT : une seule ligne « Sauce satay 40g » ou « pesto du commerce » avec les ingrédients seulement en note. INTERDIT sauce du rayon.
Satay maison (beurre de sésame, jamais cacahuète) : beurre de sésame + sauce soja + citron + gingembre + agave + ail, chacun en ligne dosée.
Houmous / pesto / nuoc : même règle, sous-recette maison dosée. Vinaigrette moutarde : UNIQUEMENT si le plat EST une salade / niçoise / lentilles froides dont la sauce EST cette vinaigrette.
Épices complexes + agrumes + herbe fraîche sur presque chaque plat salé.
DESSERTS : aucune sauce salée. INTERDIT moutarde, vinaigrette, huile d'olive, satay, nuoc, marinade soja, « fouetter dans un pot » salé.

════════════════════════════════
APPAREILS — VALEUR AJOUTÉE UNIQUEMENT
════════════════════════════════
N'invente JAMAIS une étape robot si un geste manuel suffit.
Thermomix : UNIQUEMENT mixer / émulsionner / hacher (houmous, pesto, gazpacho, vinaigrette moutarde complexe 3+ ingrédients). INTERDIT : TM pour la moutarde seule, « ajouter le cumin au TM », « mélanger les épices au TM ». Vinaigrette moutarde (salade seulement) : fouetter dans un pot, pas de TM.
Airfryer : UNIQUEMENT vraie cuisson avec °C + min. Si crevettes, falafels ou poulet sont dans les ingrédients, le step_group Airfryer est OBLIGATOIRE. INTERDIT pour tofu semaine, gazpacho, toast, salade. INTERDIT d'afficher une protéine dans la déclinaison sans ligne d'ingrédient.
KitchenAid : UNIQUEMENT si râpé fin / lamelles / spaghettis. Ciseler la menthe = couteau.
Omettre le step_group entier s'il ne sert à rien. Ne jamais remplir un bloc vide avec du remplissage.

PAS-À-PAS : uniquement les blocs utiles, phrases courtes et chargées :
1. Protéines (Airfryer) — si vraie cuisson — parallèle vegan/omni, °C + min. Tofu semaine : hors panier, pressé, mariné cru (soja, sésame, gingembre, agrume).
2. Féculents / eau — UNE durée par ingrédient si les temps diffèrent (ex. haricots verts : eau 8 min ; pommes de terre : eau 18 min). Riz : cuiseur à riz. Cookeo lentilles/quinoa. Galette, naan, pain, wrap : poêle ou four, JAMAIS à l'eau. INTERDIT d'appliquer un seul « 8 min » à toute la ligne.
3. Thermomix — SEULEMENT si on mixe vraiment, avec « 10 sec / V7 » (ou V6).
4. Découpes — UNE phrase par légume, coupe explicite : « Courgette : spaghettis KitchenAid. » « Carotte : râpé fin. » « Menthe : ciselée. »
5. Assemblage — légumes + féculent + protéine marinée (si marinade) dans les boîtes. Sauce / mayo au pot. INTERDIT d'y lister soja / gingembre / lait de soja / citron de la sauce. INTERDIT d'y mettre une cuisson (lentilles, riz) ou une découpe (trancher les tomates).

visual_unit obligatoire : légumes en pièces ("1 pièce", "1/3 concombre", "1/2 botte"), sauces/épices en cc/cs. JAMAIS le préfixe « env. ».
Légumes : 1–2 pièces par personne par plat (ex. 1 carotte 80 g, 1/3 concombre 100 g). INTERDIT 3+ carottes ou 1 concombre entier par assiette. Total légumes ~200–280 g / pers. midi, moins le soir.
Houmous / nuoc / pesto / satay / vinaigrette = sous-recette maison (ingrédients séparés). TM seulement si on mixe.

Express (défaut) : zéro cuisson lourde, assemblage tupperware. Gastro seulement si les prefs le demandent.

════════════════════════════════
LOIS CUISINE
════════════════════════════════
- Riz : cuiseur à riz. Cookeo = lentilles, quinoa, vapeur.
- Galette / naan / pain / wrap : poêle ou four. JAMAIS de cuisson à l'eau.
- Wrap falafel / falafel : falafels dans shared_ingredients ET dans les étapes (airfryer °C + min). Alexis ET Élodie. INTERDIT un titre falafel sans falafel, INTERDIT crevettes à la place.
- Dîners low cal savoureux si les prefs l'exigent (huile ≤ 8 g pour la perte ; la prise garde la protéine).
- Tofu Lun–Ven : presser, mariner cru, frais — jamais cuit pendant le batch (sauf dessert).
- Simili-carnés : week-end, sauf prefs contraires.
- tips_and_cautions : UNIQUEMENT logistique batch (ex. « Conservez la sauce à part dans un pot hermétique »). Jamais d'aversions, jamais « sans X ».

════════════════════════════════
PORTIONS COACH (PAS UNE MOYENNE FOYER)
════════════════════════════════
Le bloc COACH NUTRITION plus bas donne les kcal / P / G / L midi et soir de CHAQUE profil.
MÊME plat, grammes différents : grams_alexis + grams_elodie sur féculents, légumes, légumineuses.
SAUCES / VINAIGRETTES / MARINADES / PESTO / HOUMOUS : UN seul dosage foyer. weight_g unique ou grams_alexis = grams_elodie. INTERDIT de splitter l'huile, le soja, la moutarde, le citron ou le tahini de la sauce. L'huile de CUISSON du plat (hors sauce) peut rester split.
INTERDIT deux recettes. INTERDIT des assiettes identiques si les cibles divergent.
Perte = un peu plus de légumes (+10 % max, jamais des kilos) + umami (soja, agrume, moutarde, herbes). Prise = densité (riz, tofu/protéine, tahini).
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
Base : spaghettis de 1 courgette, 1 carotte râpée, 1/4 chou rouge, edamame, 1/2 botte menthe.
Sauce : 1 cm gingembre, 3 cs soja, jus d'1/2 citron vert, 1 cs huile sésame, 1 cc agave. TM 10 sec / V7.
Végane : tofu mariné soja-sésame (cru). Classique : crevettes airfryer 190°C · 8 min.
Montage : légumes + menthe dans les boîtes, protéines marinées, sauce au pot. PAS de soja/gingembre/citron dans la boîte.`;

export const MEAL_JSON_SHAPE = `{
  "title": "Bowl fraîcheur courgettes, vinaigrette soja-gingembre-agave",
  "shared_ingredients": [
    { "name": "Courgette", "weight_g": 180, "visual_unit": "1 pièce", "prep": "spaghettis KitchenAid" },
    { "name": "Carotte", "weight_g": 80, "visual_unit": "1 pièce", "prep": "râpé fin KitchenAid" },
    { "name": "Chou rouge", "weight_g": 80, "visual_unit": "1/4 chou", "prep": "râpé fin" },
    { "name": "Edamame décortiqués", "grams_alexis": 90, "grams_elodie": 70, "visual_unit": "1 poignée" },
    { "name": "Menthe fraîche", "weight_g": 15, "visual_unit": "1/2 botte", "prep": "ciselée" },
    { "name": "Sauce soja", "weight_g": 18, "visual_unit": "1 cs" },
    { "name": "Citron vert", "weight_g": 30, "visual_unit": "1/2 pièce", "prep": "jus" },
    { "name": "Huile de sésame", "weight_g": 8, "visual_unit": "1/2 cs" },
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
    { "section": "Assemblage", "steps": ["Boîtes : courgettes, carottes, chou, edamame, menthe. Tofu pressé mariné Alexis / crevettes Élodie. Sauce au pot — pas de soja ni citron dans la boîte."] }
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
grams_alexis / grams_elodie obligatoires sur féculents, légumes, légumineuses. Sauces = weight_g unique (voir COACH NUTRITION).
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
Chaque titre NOMME la sauce / marinade du plat. Si marinade ET sauce de service : les deux groupes, explosés. INTERDIT d'ajouter une vinaigrette moutarde-citron-huile en plus.

step_groups : n'inclure un robot QUE s'il apporte quelque chose. Omettre un bloc vide.
Airfryer seulement si vraie cuisson (jamais le tofu en semaine) — OBLIGATOIRE si crevettes / falafels / poulet dans les ingrédients. Jamais de gazpacho à l'airfryer.
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
Portions : grams_alexis / grams_elodie selon COACH NUTRITION (sauf sauces / vinaigrettes : dosage foyer unique).
Week-end : tofu poêlé / four / airfryer OK. Simili-carnés OK.
Houmous = sous-recette pois chiches + tahini + citron + ail + cumin (jamais un pot).
${themeConstraintLine(theme, 4)}
ORDRE JSON STRICT — les 4 dans le thème, sans exception :
1. recipes[0] = Samedi DÉJEUNER (cibles midi COACH NUTRITION)
2. recipes[1] = Samedi DÎNER LOW CAL (cibles soir, huile serrée, féculent allégé, protéine gardée)
3. recipes[2] = Dimanche DÉJEUNER (cibles midi COACH NUTRITION)
4. recipes[3] = Dimanche DÎNER LOW CAL (cibles soir, huile serrée, féculent allégé, protéine gardée)
Chaque titre NOMME la sauce / marinade du plat. Marinade + sauce de service = deux groupes. INTERDIT d'ajouter une vinaigrette moutarde-citron-huile en plus. step_groups : n'inclure un robot QUE s'il apporte quelque chose ; omettre un bloc vide.
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
grams_alexis / grams_elodie selon COACH NUTRITION (sauf sauces : dosage foyer unique).
Les 2 portions sont sur des jours ALTERNÉS, jamais consécutifs.
Tofu : presser, mariner, servir frais (cuisson seulement si dessert).
Type : ${pair.mealType}${pair.lowCalorie ? ", DÎNER LOW CAL (cibles soir, huile serrée, féculent allégé, protéine gardée)" : " (déjeuner, cibles midi par profil)"}.
Houmous = sous-recette pois chiches + tahini + citron + ail + cumin (jamais un pot).
${themeLine}
Chaque titre NOMME la sauce / marinade du plat. Marinade + sauce de service = deux groupes. INTERDIT d'ajouter une vinaigrette moutarde-citron-huile en plus. step_groups : robot seulement si valeur ajoutée ; omettre un bloc vide.
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
Portions grams_alexis / grams_elodie selon COACH NUTRITION (sauf sauces : dosage foyer unique).
${slot.lowCalorie || slot.mealType === "diner" ? "Dîner low calorie (cibles soir, huile serrée, féculent allégé, protéine gardée)." : "Déjeuner : cibles midi par profil."}
Houmous = sous-recette pois chiches + tahini + citron + ail + cumin.
${themeLine}
Sous-recettes + weight_g + visual_unit + réglages appareils : obligatoires.
Chaque titre NOMME la sauce / marinade du plat. Marinade + sauce de service = deux groupes. INTERDIT d'ajouter une vinaigrette moutarde-citron-huile en plus. step_groups : robot seulement si valeur ajoutée ; omettre un bloc vide.

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
      return `PETIT-DÉJEUNER du jour. Vise ~25 % des kcal journalières de CHAQUE profil (bloc COACH NUTRITION, daily). Express OK (overnight oats, scramble tofu/œufs, toast). Tartinade / sauce maison si pertinent.`;
    case "collation":
      return `COLLATION du jour. Vise ~15 % des kcal journalières. Dense en protéine, pas un snack industriel sucré.`;
    case "diner":
      return `DÎNER du jour, LOW CAL : cibles soir COACH NUTRITION (hors dessert). Huile serrée, féculent allégé, protéine gardée.`;
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
    ? `THÈME DESSERT : « ${theme.trim()} ». Le titre et un ingrédient majeur incarnent ce thème. INTERDIT un plat salé.${evening ? " Version LIGHT du thème (riz au lait → konjac / tofu soyeux, jamais du vrai riz)." : ""}`
    : evening
      ? "Pas de thème imposé — dessert soir light (mousse tofu soyeux, crème konjac, cacao, vanille, agrume)."
      : "Pas de thème imposé — invente un dessert maison (clafoutis, fondant, tarte, mousse, liégeois…).";
  const bias = formatCoachBiasForPrompt(coachBias);
  const memory = formatPastMealsForPrompt(pastMeals);
  const head = evening
    ? `Tu es Gem Chef pâtissier light. Dessert SOIR batch foyer : très faible calorie, gourmand, actionnable.
1 SEUL dessert pour PLUSIEURS soirs. JSON = 1 part / personne.
Alexis vegan : tofu soyeux / konjac OK. INTERDIT lait animal, beurre, œufs, fromage, gélatine, miel, pâte brisée, crème.
Élodie : même base vegan. Pas de mascarpone.
Tofu soyeux : CUISSON / mixage autorisés. Konjac / shirataki : rincer, égoutter, parfumer (vanille, cacao, agrume) — jamais du vrai riz à côté.
Plafond ~70 kcal / part. INTERDIT vinaigrette, moutarde, satay, bowl, wrap, falafel, plat salé.
MÊME dessert, MÊMES ingrédients. INTERDIT deux versions. Perte = extras denses plus petits. visual_unit = grammes (1 cs sirop ≈ 20 g).`
    : `Tu es Gem Chef pâtissier. Dessert midi batch foyer : condensé, gourmand, actionnable.
1 SEUL dessert maison pour PLUSIEURS déjeuners. JSON = 1 part / personne (pas le total fournée).
Alexis vegan : tofu soyeux cuit / mixé / four OK. INTERDIT lait animal, beurre, œufs, fromage, gélatine, miel.
Élodie : même base vegan de préférence. Sinon œufs / skyr / fromage blanc UNIQUEMENT dans profile_2_ingredients.
Tofu soyeux : CUISSON autorisée. Tient 3 à 5 jours au frigo, portions individuelles.
INTERDIT : vinaigrette, moutarde, satay, nuoc, pesto, marinade, sauce soja, vrai riz (sauf konjac du PRODUIT FOYER), tofu ferme, bowl, wrap, falafel, plat salé.
MÊME dessert pour Alexis et Élodie. MÊMES ingrédients (grammes différents OK). INTERDIT deux recettes (érythritol vs sirop d'érable, purée d'amande / pépites seulement pour Élodie).
La personne en PERTE a les PLUS PETITES portions des extras denses (sirop, oléagineux, chocolat), jamais plus.
visual_unit = grammes réels : 1 cs sirop ≈ 20 g, 1 cs purée d'amande ≈ 18 g, 1 poignée amandes ≈ 15 g, 1 cs pépites ≈ 12 g, 1 cs lait ≈ 15 g. INTERDIT 2 cs = 99 g.
profile_2_ingredients : UNIQUEMENT œufs / skyr / fromage blanc si le dessert le demande. Pas une « version gourmande Élodie ».`;
  return `${head}
Four / TM seulement s'ils servent. visual_unit sur chaque ingrédient. Titre = le dessert seulement.
Si un PRODUIT FOYER est fourni, il EST l'ingrédient star (grammes visibles). Thème « riz au lait » + konjac = riz au lait AU KONJAC, sans riz céréale.

${kitchenContext ? `${kitchenContext}\n` : ""}
${themeLine}
${memory ? `\n${memory}\n` : ""}
${bias ? `\n${bias}\n` : ""}
Réponds UNIQUEMENT en JSON valide, sans markdown :
{
  "title": "${evening ? "Riz au lait konjac vanille" : "Clafoutis cerises tofu soyeux"}",
  "shared_ingredients": [
    { "name": "${evening ? "Riz konjac" : "Tofu soyeux"}", "grams_alexis": ${evening ? 140 : 80}, "grams_elodie": ${evening ? 120 : 80}, "visual_unit": "${evening ? "1/2 sachet" : "1/3 bloc"}" },
    { "name": "${evening ? "Lait d'avoine" : "Cerises"}", "grams_alexis": ${evening ? 60 : 60}, "grams_elodie": ${evening ? 50 : 50}, "visual_unit": "${evening ? "4 cs" : "8 pièces"}" },
    { "name": "${evening ? "Vanille" : "Farine"}", "weight_g": ${evening ? 2 : 20}, "visual_unit": "${evening ? "1/2 cc" : "2 cs"}" }
  ],
  "profile_1_ingredients": [],
  "profile_2_ingredients": [],
  "step_groups": [
    { "section": "${evening ? "Plaque" : "Four"}", "steps": ["${evening ? "Rincer le konjac. Vanille + lait : 3 min à frémissement. Lier." : "180°C chaleur tournante · 25 min."}"] },
    { "section": "Assemblage", "steps": ["${evening ? "Portions individuelles, frigo 4 j." : "Moules individuels, cerises au fond, appareil. Cuire. Frigo 4 j."}"] }
  ],
  "tips_and_cautions": ["Conserve 4 jours au frigo, portions individuelles."]
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
PRIORITÉ n°1 : plus light / moins calorique, tout en restant gourmand et cuisinable.
Exemples (si ça correspond au rôle) :
- sirop d'érable / miel / agave / sucre → Érythritol, Stévia, Extrait de vanille
- purée d'amande / beurre de cajou → tofu soyeux, compote de pomme, yaourt soja
- pépites / chocolat → cacao non sucré, zeste d'agrume, cannelle
- oléagineux en morceaux → fruits rouges, cacao, amandes effilées (moins dense)

INTERDIT plat salé, vinaigrette, moutarde, satay, bowl.
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
visual_unit = grammes réels : 1 cs sirop ≈ 20 g, 1 cs érythritol ≈ 8 g, 1 cs purée d'amande ≈ 18 g, 1 cs cacao ≈ 5 g. INTERDIT 2 cs = 99 g.
MÊME dessert, MÊMES ingrédients pour Alexis et Élodie (grammes différents OK). INTERDIT deux versions.
Si le remplacant est un édulcorant light (érythritol, stévia), RETIRE sirop / miel / sucre / agave.
Perte = extras denses plus petits. Tofu soyeux cuisson OK. INTERDIT vinaigrette, moutarde, plat salé.
Alexis vegan : pas de lait animal, beurre, œufs, miel.
Four / TM seulement s'ils servent. Titre = le dessert seulement.

${kitchenContext ? `${kitchenContext}\n` : ""}
${memory ? `\n${memory}\n` : ""}
Réponds UNIQUEMENT en JSON valide, sans markdown :
{
  "title": "${meal.baseName.replace(/"/g, "")}",
  "shared_ingredients": [
    { "name": "Tofu soyeux", "grams_alexis": 80, "grams_elodie": 80, "visual_unit": "1/3 bloc" }
  ],
  "profile_1_ingredients": [],
  "profile_2_ingredients": [],
  "step_groups": [
    { "section": "${evening ? "Plaque" : "Four"}", "steps": ["${evening ? "Rincer le konjac. Vanille + lait : 3 min à frémissement. Lier." : "180°C chaleur tournante · 25 min."}"] },
    { "section": "Assemblage", "steps": ["${evening ? "Portions individuelles, frigo 4 j." : "Moules individuels. Frigo 4 j."}"] }
  ],
  "tips_and_cautions": ["Conserve 4 jours au frigo, portions individuelles."]
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
    `Génère 1 SEUL repas FRAIS pour AUJOURD'HUI — pas un batch de la semaine, pas un couple Lun+Mer.
Règle : 1 recette = 1 portion / personne (comme un repas week-end). INTERDIT de doubler.
MÊME plat pour Alexis et Élodie. grams_alexis / grams_elodie selon COACH NUTRITION (sauf sauces : un seul dosage foyer). INTERDIT deux recettes.
PAS de dessert, yaourt sucré, granola dessert (déjà sur la carte Aujourd'hui).
${todaySlotBrief(mealType)}
Repas du jour (pas une session batch Lun–Ven) : tofu cuit et simili-carnés OK si le plat le demande.
Houmous / satay / pesto / vinaigrette = sous-recette maison dosée.
${themeConstraintLine(theme, 1)}
Chaque titre NOMME la sauce / marinade du plat. Marinade + sauce de service = deux groupes. INTERDIT d'ajouter une vinaigrette moutarde-citron-huile en plus. step_groups : robot seulement si valeur ajoutée ; omettre un bloc vide.
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
