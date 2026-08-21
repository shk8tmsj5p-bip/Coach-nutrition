import { parseGeminiJson } from "@/lib/gemini/meals";
import { generateGeminiFlash } from "@/lib/gemini/flash";
import type { DetectedIngredient, DietType, Macros, QtyUnit } from "@/lib/types";

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
  { keys: ["lait d avoine", "lait avoine", "lait vegetal d avoine", "lait vegetal avoine"], label: "Lait d'avoine", kcal: 43, protein: 0.8, carbs: 6.6, fat: 1.5, defaultG: 200 },
  { keys: ["flocons d'avoine", "flocons avoine", "flocons"], kcal: 370, protein: 13, carbs: 59, fat: 7, defaultG: 50 },
  { keys: ["avoine"], label: "Avoine", kcal: 370, protein: 13, carbs: 59, fat: 7, defaultG: 50 },
  { keys: ["lait soja", "lait de soja"], kcal: 35, protein: 3.3, carbs: 1.2, fat: 1.8, defaultG: 200 },
  { keys: ["cafe au lait", "cafe"], label: "Café", kcal: 2, protein: 0.3, carbs: 0, fat: 0, defaultG: 200 },
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

function tokenHit(text: string, token: string) {
  if (token.length < 3) return false;
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`).test(text);
}

function skipOatFlakes(text: string) {
  return /\blait\b/.test(text) || /\bcafe\b/.test(text) || /\bboisson\b/.test(text);
}

function matchFood(chunk: string): FoodRef | undefined {
  const text = norm(chunk);
  const hideFlakes = skipOatFlakes(text);
  let best: { food: FoodRef; len: number } | undefined;
  for (const food of FOODS) {
    const isOatSolid =
      food.keys.some((key) => /flocon/.test(norm(key))) ||
      food.keys.every((key) => norm(key) === "avoine");
    if (hideFlakes && isOatSolid) continue;
    for (const key of food.keys) {
      const token = norm(key);
      if (!tokenHit(text, token)) continue;
      if (!best || token.length > best.len) best = { food, len: token.length };
    }
  }
  return best?.food;
}

function num(raw: string) {
  return Number(raw.replace(",", "."));
}

const UNIT_TOKEN =
  "carreaux?|carr[eé]s?|tranches?|pi[eè]ces?|cuill[eè]res?\\s*[àa]\\s*soupe|cuill[eè]res?\\s*[àa]\\s*caf[eé]|cs|cc|grammes?|gr\\.?|ml|g";

export function parseQtyUnit(raw: string): QtyUnit | null {
  const u = norm(raw).replace(/\s+/g, " ").trim();
  if (!u) return null;
  if (/^carreau|^carre\b|^carr[eé]/.test(u)) return "carreau";
  if (/^tranch/.test(u)) return "tranche";
  if (/^pi[eè]ce/.test(u)) return "piece";
  if (/soupe|^cs$/.test(u)) return "cs";
  if (/caf|^cc$/.test(u)) return "cc";
  if (/^ml$/.test(u)) return "ml";
  if (/^g$|^gr$|^gramme/.test(u)) return "g";
  return null;
}

export function gramsPerUnit(unit: QtyUnit, food?: FoodRef) {
  if (unit === "g" || unit === "ml") return 1;
  if (unit === "cs") return 10;
  if (unit === "cc") return 5;
  if (unit === "carreau") return 10;
  if (unit === "tranche") return food?.defaultG ?? 40;
  if (unit === "piece") return food?.defaultG ?? 80;
  return food?.defaultG ?? 10;
}

export function qtyLabel(qty: number, unit: QtyUnit) {
  const n = Number.isInteger(qty) ? String(qty) : String(qty).replace(".", ",");
  if (unit === "tranche") return qty <= 1 ? "1 tranche" : `${n} tranches`;
  if (unit === "carreau") return qty <= 1 ? "1 carreau" : `${n} carreaux`;
  if (unit === "piece") return qty <= 1 ? "1 pièce" : `${n} pièces`;
  if (unit === "ml") return `${Math.round(qty)} ml`;
  if (unit === "cs") return `${n} cs`;
  if (unit === "cc") return `${n} cc`;
  return `${Math.round(qty)} g`;
}

export function unitShortLabel(unit: QtyUnit) {
  if (unit === "tranche") return "tr.";
  if (unit === "carreau") return "car.";
  if (unit === "piece") return "pce";
  return unit;
}

export function qtyStep(unit: QtyUnit) {
  return unit === "g" || unit === "ml" ? 5 : 1;
}

export type ParsedLogLine = {
  name: string;
  qty: number;
  unit: QtyUnit;
  grams: number;
};

function countFromWord(raw: string) {
  if (/^une?$/i.test(raw)) return 1;
  return num(raw);
}

function parseGramsFromChunk(chunk: string, unit: QtyUnit, qty: number, food?: FoodRef) {
  const paren = chunk.match(/\((\d+(?:[.,]\d+)?)\s*g\)/i);
  if (paren) return Math.max(1, Math.round(num(paren[1])));
  if (unit === "g" || unit === "ml") return Math.max(1, Math.round(qty));
  return Math.max(1, Math.round(qty * gramsPerUnit(unit, food)));
}

function parseGrams(chunk: string, food?: FoodRef) {
  return parseLogLine(chunk, food).grams;
}

export function parseLogLine(line: string, foodHint?: FoodRef): ParsedLogLine {
  const trimmed = line.trim();
  const food = foodHint ?? matchFood(trimmed);

  const colon = trimmed.match(
    new RegExp(
      `^(.*?)\\s*:\\s*(\\d+(?:[.,]\\d+)?|une?)\\s*(${UNIT_TOKEN})\\s*(?:\\((\\d+(?:[.,]\\d+)?)\\s*g\\))?\\s*$`,
      "i",
    ),
  );
  if (colon) {
    const unit = parseQtyUnit(colon[3]) ?? "g";
    const qty = countFromWord(colon[2]);
    const grams = colon[4]
      ? Math.max(1, Math.round(num(colon[4])))
      : parseGramsFromChunk(trimmed, unit, qty, food);
    return { name: titleName(colon[1].trim()) || foodName(food, trimmed), qty, unit, grams };
  }

  const trailing = trimmed.match(
    new RegExp(
      `^(.*?)\\s+(\\d+(?:[.,]\\d+)?|une?)\\s*(${UNIT_TOKEN})\\s*(?:\\((\\d+(?:[.,]\\d+)?)\\s*g\\))?\\s*$`,
      "i",
    ),
  );
  if (trailing) {
    const unit = parseQtyUnit(trailing[3]) ?? "g";
    const qty = countFromWord(trailing[2]);
    const grams = trailing[4]
      ? Math.max(1, Math.round(num(trailing[4])))
      : parseGramsFromChunk(trimmed, unit, qty, food);
    const name = leftoverName(trailing[1]) || foodName(food, trimmed);
    return { name, qty, unit, grams };
  }

  const leading = trimmed.match(
    new RegExp(`^(\\d+(?:[.,]\\d+)?|une?)\\s*(${UNIT_TOKEN})\\s+(?:de\\s+|d'|d’)?(.+)$`, "i"),
  );
  if (leading) {
    const unit = parseQtyUnit(leading[2]) ?? "g";
    const qty = countFromWord(leading[1]);
    const grams = parseGramsFromChunk(trimmed, unit, qty, food);
    return { name: foodName(food, leading[3]), qty, unit, grams };
  }

  const grams = food?.defaultG ?? 80;
  return { name: foodName(food, trimmed), qty: grams, unit: "g", grams };
}

export function formatLogLine(name: string, qty: number, unit: QtyUnit, grams: number) {
  const clean = name.trim() || "Aliment";
  const g = Math.max(1, Math.round(grams));
  const q = Math.max(unit === "g" || unit === "ml" ? 1 : 0.5, qty);
  if (unit === "g") return `${clean} : ${g}g`;
  if (unit === "ml") return `${clean} : ${Math.round(q)}ml`;
  return `${clean} : ${qtyLabel(q, unit)} (${g}g)`;
}

export function formatDetectedLine(item: DetectedIngredient) {
  const unit = item.unit ?? "g";
  const qty = item.qty ?? item.grams;
  return formatLogLine(item.name, qty, unit, item.grams);
}

function leftoverName(chunk: string) {
  const name = chunk
    .replace(/\(\d+(?:[.,]\d+)?\s*g\)/gi, " ")
    .replace(new RegExp(`\\b(\\d+(?:[.,]\\d+)?|une?)\\s*(${UNIT_TOKEN})\\b`, "gi"), " ")
    .replace(/\b(une?|de|d'|d’|du|des|la|le|les)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return titleName(name);
}

function titleName(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "Aliment";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function foodName(food: FoodRef | undefined, chunk: string) {
  const leftover = leftoverName(chunk);
  if (leftover && leftover.toLowerCase() !== "aliment") return leftover;
  if (food) return food.label ?? titleName(food.keys[0]);
  return leftover;
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
    const parsed = parseLogLine(chunk, food);
    const macros = macrosAt(food, parsed.grams);
    return {
      id: `t-${Date.now()}-${index}`,
      name: parsed.name,
      grams: parsed.grams,
      qty: parsed.qty,
      unit: parsed.unit,
      ...macros,
    };
  });
}

export function scaleDetected(item: DetectedIngredient, grams: number): DetectedIngredient {
  const next = Math.max(1, Math.round(grams));
  const ratio = item.grams > 0 ? next / item.grams : 1;
  const unit = item.unit ?? "g";
  return {
    ...item,
    grams: next,
    qty: unit === "g" || unit === "ml" ? next : item.qty,
    calories: Math.max(0, Math.round(item.calories * ratio)),
    protein: Math.max(0, Math.round(item.protein * ratio)),
    carbs: Math.max(0, Math.round((item.carbs ?? 0) * ratio)),
    fat: Math.max(0, Math.round((item.fat ?? 0) * ratio)),
  };
}

export function scaleDetectedQty(item: DetectedIngredient, qty: number): DetectedIngredient {
  const unit = item.unit ?? "g";
  const from = Math.max(0.01, item.qty ?? (unit === "g" || unit === "ml" ? item.grams : 1));
  const nextQty = Math.max(unit === "g" || unit === "ml" ? 1 : 0.5, qty);
  const grams = Math.max(1, Math.round((item.grams / from) * nextQty));
  return { ...scaleDetected(item, grams), qty: nextQty, unit };
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
  const parsed = parseLogLine(chunk, food);
  const macros = macrosAt(food, parsed.grams);
  return {
    line: formatLogLine(parsed.name, parsed.qty, parsed.unit, parsed.grams),
    ...macros,
  };
}

export function parseIngredientQty(line: string): ParsedLogLine {
  return parseLogLine(line);
}

export function setLineQuantity(line: string, qty: number) {
  const parsed = parseLogLine(line);
  const next = scaleDetectedQty(
    {
      id: "tmp",
      name: parsed.name,
      grams: parsed.grams,
      qty: parsed.qty,
      unit: parsed.unit,
      calories: 100,
      protein: 0,
    },
    qty,
  );
  return formatLogLine(parsed.name, next.qty ?? qty, parsed.unit, next.grams);
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
  const hasExplicitG = /(\d+(?:[.,]\d+)?)\s*(g|gr\.?|grammes?)\b/i.test(text);
  const hasVisualQty =
    /(\d+(?:[.,]\d+)?|une?)\s*(carreaux?|carr[eé]s?|tranches?|pi[eè]ces?|cs|cc)\b/i.test(text);
  return ai.map((item, index) => {
    const loc = local[index];
    if (!loc) return item;
    const preferLocalGrams =
      loc.grams !== item.grams &&
      (hasExplicitG ||
        (hasVisualQty && Boolean(loc.unit && loc.unit !== "g" && loc.unit !== "ml")));
    const base = { ...item, name: item.name || loc.name };
    if (!preferLocalGrams) return base;
    return { ...scaleDetected(base, loc.grams), qty: loc.qty, unit: loc.unit };
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
      qty: Number(row.qty) > 0 ? Number(row.qty) : grams,
      unit: parseQtyUnit(String(row.unit ?? "g")) ?? "g",
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
- Découpe en ingrédients distincts SEULEMENT s'ils sont clairement séparés (avec, et, +, virgule).
- N'ajoute JAMAIS un aliment absent du texte.
- "lait d'avoine", "lait végétal d'avoine", "café au lait d'avoine" = BOISSON (lait d'avoine / café), PAS des flocons d'avoine.
- Une phrase courte = UN seul ingrédient. Garde un nom proche de la saisie utilisateur.
- "tranche de pain bûcheron avec de la margarine" = 2 ingrédients (pain + margarine).
- Si un poids est écrit (20 g, 20gr, 20 grammes), UTILISE exactement ce gramme.
- Si une quantité visuelle est écrite (1 carreau, 2 tranches, 1 cs, 1 pièce), garde qty + unit et estime les grammes de CETTE quantité (1 carreau de chocolat ≈ 10 g, 1 tranche de pain ≈ 40 g, 1 cs ≈ 10 g).
- Sinon estime une portion réaliste (café au lait d'avoine ≈ 200 ml de lait, pas 50 g de flocons).
- Donne calories / protéines / glucides / lipides pour CETTE quantité, pas pour 100 g.
- Noms propres, sans le poids dans le nom.

JSON strict :
{ "ingredients": [{ "name": "Chocolat noir", "qty": 1, "unit": "carreau", "grams": 10, "calories": 58, "protein": 1, "carbs": 5, "fat": 4 }] }`;
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
