import { parseGeminiJson } from "@/lib/gemini/meals";
import { generateGeminiFlash } from "@/lib/gemini/flash";
import type { DetectedIngredient, DietType, Macros } from "@/lib/types";

type FoodRef = {
  keys: string[];
  label?: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  defaultG: number;
};

/** Valeurs / 100 g. Portions par défaut si l'utilisateur ne donne pas de grammes. */
const FOODS: FoodRef[] = [
  { keys: ["pain bûcheron", "pain bucheron", "pain complet", "pain"], kcal: 255, protein: 9, carbs: 47, fat: 3.5, defaultG: 40 },
  { keys: ["flocons d'avoine", "avoine", "flocons"], kcal: 370, protein: 13, carbs: 59, fat: 7, defaultG: 50 },
  { keys: ["lait soja", "soja"], kcal: 35, protein: 3.3, carbs: 1.2, fat: 1.8, defaultG: 200 },
  { keys: ["chia"], kcal: 486, protein: 17, carbs: 42, fat: 31, defaultG: 10 },
  { keys: ["myrtilles", "myrtille"], kcal: 57, protein: 0.7, carbs: 14, fat: 0.3, defaultG: 80 },
  { keys: ["framboises", "framboise"], kcal: 52, protein: 1.2, carbs: 12, fat: 0.7, defaultG: 80 },
  { keys: ["fraises", "fraise"], kcal: 32, protein: 0.7, carbs: 8, fat: 0.3, defaultG: 80 },
  { keys: ["granola"], kcal: 470, protein: 10, carbs: 64, fat: 20, defaultG: 30 },
  { keys: ["fromage blanc"], kcal: 47, protein: 8, carbs: 4, fat: 0.2, defaultG: 200 },
  { keys: ["tofu soyeux"], kcal: 55, protein: 5.3, carbs: 2.3, fat: 2.7, defaultG: 150 },
  { keys: ["whey vegan", "whey"], kcal: 380, protein: 80, carbs: 6, fat: 5, defaultG: 25 },
  { keys: ["chocolat noir", "chocolat"], kcal: 580, protein: 8, carbs: 45, fat: 42, defaultG: 15 },
  { keys: ["bacon végétal", "bacon vegan", "bacon"], label: "Bacon végétal", kcal: 250, protein: 18, carbs: 4, fat: 18, defaultG: 20 },
  { keys: ["margarine saint hubert", "saint hubert"], label: "Margarine Saint Hubert", kcal: 720, protein: 0.2, carbs: 0.4, fat: 80, defaultG: 10 },
  { keys: ["margarine"], label: "Margarine", kcal: 720, protein: 0.2, carbs: 0.4, fat: 80, defaultG: 10 },
  { keys: ["beurre"], kcal: 745, protein: 0.7, carbs: 0.1, fat: 82, defaultG: 10 },
  { keys: ["houmous", "hummus"], kcal: 250, protein: 8, carbs: 14, fat: 17, defaultG: 40 },
  { keys: ["confiture"], kcal: 250, protein: 0.4, carbs: 62, fat: 0.1, defaultG: 20 },
  { keys: ["fromage"], kcal: 330, protein: 22, carbs: 1, fat: 27, defaultG: 30 },
  { keys: ["skyr"], kcal: 62, protein: 11, carbs: 4, fat: 0.2, defaultG: 200 },
  { keys: ["yaourt", "yogurt"], kcal: 60, protein: 4, carbs: 6, fat: 1.5, defaultG: 125 },
  { keys: ["œuf", "oeuf"], kcal: 143, protein: 13, carbs: 1, fat: 10, defaultG: 55 },
  { keys: ["banane"], kcal: 89, protein: 1.1, carbs: 23, fat: 0.3, defaultG: 120 },
  { keys: ["pomme"], kcal: 52, protein: 0.3, carbs: 14, fat: 0.2, defaultG: 150 },
  { keys: ["riz"], kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, defaultG: 180 },
  { keys: ["pâtes", "pates"], kcal: 160, protein: 6, carbs: 31, fat: 1, defaultG: 180 },
  { keys: ["tofu"], kcal: 145, protein: 16, carbs: 2, fat: 9, defaultG: 150 },
  { keys: ["poulet"], kcal: 165, protein: 31, carbs: 0, fat: 3.6, defaultG: 150 },
  { keys: ["huile"], kcal: 884, protein: 0, carbs: 0, fat: 100, defaultG: 10 },
];

function norm(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, " ");
}

function matchFood(chunk: string): FoodRef | undefined {
  const text = norm(chunk);
  let best: { food: FoodRef; len: number } | undefined;
  for (const food of FOODS) {
    for (const key of food.keys) {
      const token = norm(key);
      if (!text.includes(token)) continue;
      if (!best || token.length > best.len) best = { food, len: token.length };
    }
  }
  return best?.food;
}

function num(raw: string) {
  return Number(raw.replace(",", "."));
}

function parseGrams(chunk: string, food?: FoodRef) {
  const grams = chunk.match(/(\d+(?:[.,]\d+)?)\s*(g|gr\.?|grammes?)\b/i);
  if (grams) return Math.max(1, Math.round(num(grams[1])));
  const ml = chunk.match(/(\d+(?:[.,]\d+)?)\s*ml\b/i);
  if (ml) return Math.max(1, Math.round(num(ml[1])));
  const slices = chunk.match(/(\d+|une?)\s*tranch/i);
  if (slices) {
    const n = /une?/i.test(slices[1]) ? 1 : Number(slices[1]);
    return (food?.defaultG ?? 40) * n;
  }
  if (/tranch/i.test(chunk)) return food?.defaultG ?? 40;
  const tbsp = chunk.match(/(\d+)\s*(cs|c\.?\s*s\.?|cuillères?\s+à\s+soupe)/i);
  if (tbsp) return Number(tbsp[1]) * 10;
  const tsp = chunk.match(/(\d+)\s*(cc|c\.?\s*c\.?|cuillères?\s+à\s+café)/i);
  if (tsp) return Number(tsp[1]) * 5;
  return food?.defaultG ?? 80;
}

function titleName(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "Aliment";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function leftoverName(chunk: string) {
  const name = chunk
    .replace(/\b(\d+(?:[.,]\d+)?)\s*(g|gr\.?|grammes?|ml|cl|cs|cc)\b/gi, " ")
    .replace(/\b(\d+|une?)\s*tranch\w*\b/gi, " ")
    .replace(/\b(une?|de|d'|d’|du|des|la|le|les)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return titleName(name);
}

function foodName(food: FoodRef | undefined, chunk: string) {
  if (!food) return leftoverName(chunk);
  const catalog = food.label ?? titleName(food.keys[0]);
  let rest = norm(leftoverName(chunk));
  for (const key of [...food.keys].sort((a, b) => b.length - a.length)) {
    rest = rest.replace(norm(key), " ");
  }
  rest = rest.replace(/\s+/g, " ").trim();
  if (!rest) return catalog;
  return `${catalog} ${titleName(rest)}`;
}

/** Toujours `Nom 60g` / `Pain bûcheron 1 tranche` / `Lait soja 200ml`. */
function visualQty(chunk: string, grams: number) {
  const ml = chunk.match(/(\d+(?:[.,]\d+)?)\s*ml\b/i);
  if (ml) return `${Math.round(num(ml[1]))}ml`;
  const g = chunk.match(/(\d+(?:[.,]\d+)?)\s*(g|gr\.?|grammes?)\b/i);
  if (g) return `${Math.round(num(g[1]))}g`;
  const slices = chunk.match(/(\d+|une?)\s*tranch/i);
  if (slices) {
    const n = /une?/i.test(slices[1]) ? 1 : Number(slices[1]);
    return n <= 1 ? "1 tranche" : `${n} tranches`;
  }
  if (/tranch/i.test(chunk)) return "1 tranche";
  const tbsp = chunk.match(/(\d+)\s*(cs|c\.?\s*s\.?|cuillères?\s+à\s+soupe)/i);
  if (tbsp) return `${tbsp[1]} cs`;
  const tsp = chunk.match(/(\d+)\s*(cc|c\.?\s*c\.?|cuillères?\s+à\s+café)/i);
  if (tsp) return `${tsp[1]} cc`;
  return `${grams}g`;
}

function macrosAt(food: FoodRef | undefined, grams: number) {
  const kcal = food?.kcal ?? 130;
  const protein = food?.protein ?? 4;
  const carbs = food?.carbs ?? 15;
  const fat = food?.fat ?? 5;
  return {
    calories: Math.max(1, Math.round((kcal * grams) / 100)),
    protein: Math.max(0, Math.round((protein * grams) / 100)),
    carbs: Math.max(0, Math.round((carbs * grams) / 100)),
    fat: Math.max(0, Math.round((fat * grams) / 100)),
  };
}

function splitChunks(text: string) {
  return text
    .split(
      /\s*(?:,|;|\+|\/|\n|\s+avec\s+|\s+et\s+|\s+puis\s+|\s+tartin\S*\s+de\s+|\s+napp\S*\s+de\s+|\s+garni\S*\s+de\s+|\s+recouvert\S*\s+de\s+)\s*/gi,
    )
    .map((chunk) => chunk.replace(/^(de la|du|de l'|d'|des|le|la|les)\s+/i, "").trim())
    .filter((chunk) => chunk.length > 1);
}

export function parseFoodTextLocal(text: string): DetectedIngredient[] {
  const chunks = splitChunks(text.trim());
  const parts = chunks.length > 0 ? chunks : [text.trim() || "Aliment"];
  return parts.map((chunk, index) => {
    const food = matchFood(chunk);
    const grams = parseGrams(chunk, food);
    const macros = macrosAt(food, grams);
    return {
      id: `t-${Date.now()}-${index}`,
      name: foodName(food, chunk),
      grams,
      ...macros,
    };
  });
}

export function scaleDetected(item: DetectedIngredient, grams: number): DetectedIngredient {
  const next = Math.max(1, Math.round(grams));
  const ratio = item.grams > 0 ? next / item.grams : 1;
  return {
    ...item,
    grams: next,
    calories: Math.max(0, Math.round(item.calories * ratio)),
    protein: Math.max(0, Math.round(item.protein * ratio)),
    carbs: Math.max(0, Math.round((item.carbs ?? 0) * ratio)),
    fat: Math.max(0, Math.round((item.fat ?? 0) * ratio)),
  };
}

export function macrosFromIngredients(ingredients: DetectedIngredient[]) {
  return ingredients.reduce(
    (acc, item) => ({
      calories: acc.calories + item.calories,
      protein: acc.protein + item.protein,
      carbs: acc.carbs + (item.carbs ?? 0),
      fat: acc.fat + (item.fat ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export function formatIngredientLine(raw: string): { line: string } & Macros {
  const chunk = raw.trim();
  const food = matchFood(chunk);
  const grams = parseGrams(chunk, food);
  const macros = macrosAt(food, grams);
  return {
    line: `${foodName(food, chunk)} ${visualQty(chunk, grams)}`,
    ...macros,
  };
}

export type QtyUnit = "g" | "ml" | "tranche" | "cs" | "cc";

export function parseIngredientQty(line: string): { name: string; qty: number; unit: QtyUnit } {
  const trimmed = line.trim();
  const ml = trimmed.match(/^(.*?)\s+(\d+(?:[.,]\d+)?)\s*ml$/i);
  if (ml) return { name: ml[1].trim(), qty: Math.round(num(ml[2])), unit: "ml" };
  const g = trimmed.match(/^(.*?)\s+(\d+(?:[.,]\d+)?)\s*g$/i);
  if (g) return { name: g[1].trim(), qty: Math.round(num(g[2])), unit: "g" };
  const tr = trimmed.match(/^(.*?)\s+(\d+)\s*tranches?$/i);
  if (tr) return { name: tr[1].trim(), qty: Number(tr[2]), unit: "tranche" };
  const cs = trimmed.match(/^(.*?)\s+(\d+)\s*cs$/i);
  if (cs) return { name: cs[1].trim(), qty: Number(cs[2]), unit: "cs" };
  const cc = trimmed.match(/^(.*?)\s+(\d+)\s*cc$/i);
  if (cc) return { name: cc[1].trim(), qty: Number(cc[2]), unit: "cc" };
  const food = matchFood(trimmed);
  return { name: foodName(food, trimmed), qty: parseGrams(trimmed, food), unit: "g" };
}

export function lineWithQty(name: string, qty: number, unit: QtyUnit) {
  const n = Math.max(1, Math.round(qty));
  if (unit === "tranche") return `${name} ${n <= 1 ? "1 tranche" : `${n} tranches`}`;
  if (unit === "ml") return `${name} ${n}ml`;
  if (unit === "cs") return `${name} ${n} cs`;
  if (unit === "cc") return `${name} ${n} cc`;
  return `${name} ${n}g`;
}

export function setLineQuantity(line: string, qty: number) {
  const parsed = parseIngredientQty(line);
  return formatIngredientLine(lineWithQty(parsed.name, Math.max(1, qty), parsed.unit)).line;
}

export function qtyStep(unit: QtyUnit) {
  return unit === "g" || unit === "ml" ? 5 : 1;
}

export function qtyLabel(qty: number, unit: QtyUnit) {
  if (unit === "tranche") return qty <= 1 ? "1 tranche" : `${qty} tranches`;
  if (unit === "ml") return `${qty} ml`;
  if (unit === "cs") return `${qty} cs`;
  if (unit === "cc") return `${qty} cc`;
  return `${qty} g`;
}

export function normalizeIngredientLines(raws: string[]): { lines: string[]; macros: Macros } {
  const macros: Macros = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const lines: string[] = [];
  const seen = new Set<string>();
  const chunks = raws.flatMap((raw) => {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    const parts = splitChunks(trimmed);
    return parts.length > 0 ? parts : [trimmed];
  });
  for (const chunk of chunks) {
    const next = formatIngredientLine(chunk);
    const key = next.line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(next.line);
    macros.calories += next.calories;
    macros.protein += next.protein;
    macros.carbs += next.carbs;
    macros.fat += next.fat;
  }
  return { lines, macros };
}

export function mergeFoodLogResult(
  ai: DetectedIngredient[],
  local: DetectedIngredient[],
  text: string,
): DetectedIngredient[] {
  if (ai.length === 0) return local;
  if (local.length > ai.length) return local;
  const hasExplicitG = /(\d+(?:[.,]\d+)?)\s*(g|gr\.?|grammes?)\b/i.test(text);
  if (!hasExplicitG) return ai;
  return ai.map((item, index) => {
    const loc = local[index];
    if (!loc || loc.grams === item.grams) return item;
    return scaleDetected(item, loc.grams);
  });
}

function mapGeminiIngredients(raw: unknown): DetectedIngredient[] {
  if (!raw || typeof raw !== "object") return [];
  const rec = raw as Record<string, unknown>;
  const list = Array.isArray(rec.ingredients) ? rec.ingredients : [];
  const out: DetectedIngredient[] = [];
  list.forEach((item, index) => {
    if (!item || typeof item !== "object") return;
    const row = item as Record<string, unknown>;
    const name = String(row.name ?? "").trim();
    const grams = Math.max(1, Math.round(Number(row.grams) || 0));
    if (!name || grams <= 0) return;
    out.push({
      id: `ai-${Date.now()}-${index}`,
      name,
      grams,
      calories: Math.max(0, Math.round(Number(row.calories) || 0)),
      protein: Math.max(0, Math.round(Number(row.protein) || 0)),
      carbs: Math.max(0, Math.round(Number(row.carbs) || 0)),
      fat: Math.max(0, Math.round(Number(row.fat) || 0)),
    });
  });
  return out;
}

export function foodLogPrompt(text: string, diet: DietType) {
  return `Tu estimes la nutrition d'une saisie libre en français.
Régime : ${diet === "vegan" ? "vegan (aucun produit animal)" : "omnivore"}.

Texte : """${text}"""

Règles :
- Découpe en ingrédients distincts (avec, et, +, virgule, "de la").
- "tranche de pain bûcheron avec de la margarine" = 2 ingrédients (pain + margarine).
- Si un poids est écrit (20 g, 20gr, 20 grammes), UTILISE exactement ce gramme.
- Sinon estime une portion réaliste (1 tranche de pain ≈ 40 g, 1 cs margarine ≈ 10 g).
- Donne calories / protéines / glucides / lipides pour CETTE quantité, pas pour 100 g.
- Noms propres, sans le poids dans le nom.

JSON strict :
{ "ingredients": [{ "name": "Pain bûcheron", "grams": 40, "calories": 102, "protein": 4, "carbs": 19, "fat": 1 }] }`;
}

export async function analyzeFoodText(text: string, diet: DietType): Promise<DetectedIngredient[]> {
  const fallback = parseFoodTextLocal(text);
  try {
    const raw = await generateGeminiFlash({
      parts: [{ text: foodLogPrompt(text, diet) }],
      temperature: 0.2,
    });
    const parsed = mapGeminiIngredients(parseGeminiJson(raw));
    return mergeFoodLogResult(parsed, fallback, text);
  } catch {
    return fallback;
  }
}

export function foodPhotoPrompt(diet: DietType) {
  return `Tu analyses une PHOTO de repas / encas. Estime ce qui a été mangé.
Régime : ${diet === "vegan" ? "vegan (aucun produit animal — si tu vois fromage/viande, reste sur l'alternative végétale visible ou note l'aliment vu)" : "omnivore"}.

Règles :
- Liste CHAQUE aliment visible (pain, margarine, fruit, plat, boisson).
- Estime un poids réaliste en grammes pour la portion SUR L'ASSIETTE / dans la main.
- Donne calories / protéines / glucides / lipides pour CETTE quantité, pas pour 100 g.
- Noms en français, propres, sans le poids dans le name.
- Si la photo est floue, donne quand même les aliments les plus probables.
- Ne sors pas de JSON.

JSON strict :
{ "ingredients": [{ "name": "Pain bûcheron", "grams": 40, "calories": 102, "protein": 4, "carbs": 19, "fat": 1 }] }`;
}

export async function analyzeFoodPhoto(
  imageBase64: string,
  mimeType: string,
  diet: DietType,
): Promise<DetectedIngredient[]> {
  const raw = await generateGeminiFlash({
    parts: [
      { text: foodPhotoPrompt(diet) },
      { inlineData: { mimeType: mimeType || "image/jpeg", data: imageBase64 } },
    ],
    temperature: 0.2,
  });
  const parsed = mapGeminiIngredients(parseGeminiJson(raw));
  if (parsed.length === 0) {
    throw new Error("Aucun aliment reconnu sur la photo.");
  }
  return parsed;
}
