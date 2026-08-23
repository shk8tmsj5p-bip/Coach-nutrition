import { parseGeminiJson } from "@/lib/gemini/meals";
import { generateGeminiFlash } from "@/lib/gemini/flash";
import { estimateIngredientMacros } from "@/lib/recipe-macros";
import type { DetectedIngredient, DietType, Macros, QtyUnit } from "@/lib/types";

type FoodRef = {
  keys: string[];
  label?: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  defaultG: number;
  defaultUnit?: QtyUnit;
};

/** Valeurs / 100 g (CIQUAL / USDA). `defaultG` = 1 pièce / portion typique comestible. */
const FOODS: FoodRef[] = [
  { keys: ["pain bûcheron", "pain bucheron", "pain complet", "pain"], label: "Pain bûcheron", kcal: 255, protein: 9, carbs: 47, fat: 3.5, defaultG: 40, defaultUnit: "tranche" },
  { keys: ["lait d avoine", "lait avoine", "lait vegetal d avoine", "lait vegetal avoine"], label: "Lait d'avoine", kcal: 43, protein: 0.8, carbs: 6.6, fat: 1.5, defaultG: 200, defaultUnit: "ml" },
  { keys: ["flocons d avoine", "flocons d'avoine", "flocon d avoine", "flocon d'avoine", "flocons avoine", "flocon avoine", "flocons", "flocon"], label: "Flocons d'avoine", kcal: 370, protein: 13, carbs: 59, fat: 7, defaultG: 50, defaultUnit: "g" },
  { keys: ["avoine"], label: "Flocons d'avoine", kcal: 370, protein: 13, carbs: 59, fat: 7, defaultG: 50, defaultUnit: "g" },
  { keys: ["lait soja", "lait de soja"], label: "Lait de soja", kcal: 35, protein: 3.3, carbs: 1.2, fat: 1.8, defaultG: 200, defaultUnit: "ml" },
  { keys: ["cafe au lait", "cafe"], label: "Café", kcal: 2, protein: 0.3, carbs: 0, fat: 0, defaultG: 200, defaultUnit: "ml" },
  { keys: ["chia"], label: "Graines de chia", kcal: 486, protein: 17, carbs: 42, fat: 31, defaultG: 10, defaultUnit: "g" },
  { keys: ["myrtilles", "myrtille"], label: "Myrtilles", kcal: 57, protein: 0.7, carbs: 14, fat: 0.3, defaultG: 80, defaultUnit: "g" },
  { keys: ["framboises", "framboise"], label: "Framboises", kcal: 52, protein: 1.2, carbs: 12, fat: 0.7, defaultG: 80, defaultUnit: "g" },
  { keys: ["fraises", "fraise"], label: "Fraises", kcal: 32, protein: 0.7, carbs: 8, fat: 0.3, defaultG: 80, defaultUnit: "g" },
  { keys: ["granola"], label: "Granola", kcal: 470, protein: 10, carbs: 64, fat: 20, defaultG: 30, defaultUnit: "g" },
  { keys: ["fromage blanc"], label: "Fromage blanc", kcal: 47, protein: 8, carbs: 4, fat: 0.2, defaultG: 200, defaultUnit: "g" },
  { keys: ["tofu soyeux"], label: "Tofu soyeux", kcal: 55, protein: 5.3, carbs: 2.3, fat: 2.7, defaultG: 150, defaultUnit: "g" },
  { keys: ["whey vegan", "whey"], label: "Whey vegan", kcal: 380, protein: 80, carbs: 6, fat: 5, defaultG: 25, defaultUnit: "g" },
  { keys: ["chocolat noir", "chocolat"], label: "Chocolat noir", kcal: 580, protein: 8, carbs: 45, fat: 42, defaultG: 10, defaultUnit: "carreau" },
  { keys: ["bacon vegetal", "bacon vegan", "bacon vg", "bacon végétal", "bacon"], label: "Bacon végétal", kcal: 250, protein: 18, carbs: 4, fat: 18, defaultG: 20, defaultUnit: "tranche" },
  { keys: ["margarine saint hubert", "saint hubert"], label: "Margarine Saint Hubert", kcal: 720, protein: 0.2, carbs: 0.4, fat: 80, defaultG: 10, defaultUnit: "cs" },
  { keys: ["margarine vegetale", "margarine végétale", "margarine"], label: "Margarine végétale", kcal: 720, protein: 0.2, carbs: 0.4, fat: 80, defaultG: 10, defaultUnit: "cs" },
  { keys: ["beurre de sesame", "tahini", "tahin"], label: "Beurre de sésame", kcal: 595, protein: 17, carbs: 21, fat: 54, defaultG: 15, defaultUnit: "cs" },
  { keys: ["beurre"], label: "Beurre", kcal: 745, protein: 0.7, carbs: 0.1, fat: 82, defaultG: 10, defaultUnit: "cs" },
  { keys: ["houmous", "hummus"], label: "Houmous", kcal: 250, protein: 8, carbs: 14, fat: 17, defaultG: 40, defaultUnit: "cs" },
  { keys: ["confiture"], label: "Confiture", kcal: 250, protein: 0.4, carbs: 62, fat: 0.1, defaultG: 20, defaultUnit: "cs" },
  { keys: ["fromage"], label: "Fromage", kcal: 330, protein: 22, carbs: 1, fat: 27, defaultG: 30, defaultUnit: "g" },
  { keys: ["skyr"], label: "Skyr", kcal: 62, protein: 11, carbs: 4, fat: 0.2, defaultG: 200, defaultUnit: "g" },
  { keys: ["yaourt", "yogurt"], label: "Yaourt", kcal: 60, protein: 4, carbs: 6, fat: 1.5, defaultG: 125, defaultUnit: "g" },
  { keys: ["œuf", "oeuf"], label: "Œuf", kcal: 143, protein: 13, carbs: 1, fat: 10, defaultG: 55, defaultUnit: "piece" },
  { keys: ["banane"], label: "Banane", kcal: 89, protein: 1.1, carbs: 23, fat: 0.3, defaultG: 110, defaultUnit: "piece" },
  { keys: ["pomme"], label: "Pomme", kcal: 52, protein: 0.3, carbs: 14, fat: 0.2, defaultG: 150, defaultUnit: "piece" },
  { keys: ["poire"], label: "Poire", kcal: 57, protein: 0.4, carbs: 15, fat: 0.1, defaultG: 150, defaultUnit: "piece" },
  { keys: ["orange"], label: "Orange", kcal: 47, protein: 0.9, carbs: 12, fat: 0.1, defaultG: 150, defaultUnit: "piece" },
  { keys: ["kiwi"], label: "Kiwi", kcal: 61, protein: 1.1, carbs: 15, fat: 0.5, defaultG: 75, defaultUnit: "piece" },
  { keys: ["avocat"], label: "Avocat", kcal: 160, protein: 2, carbs: 9, fat: 15, defaultG: 100, defaultUnit: "piece" },
  { keys: ["riz"], label: "Riz cuit", kcal: 130, protein: 2.7, carbs: 28, fat: 0.3, defaultG: 180, defaultUnit: "g" },
  { keys: ["pâtes", "pates"], label: "Pâtes cuites", kcal: 160, protein: 6, carbs: 31, fat: 1, defaultG: 180, defaultUnit: "g" },
  { keys: ["tofu"], label: "Tofu", kcal: 145, protein: 16, carbs: 2, fat: 9, defaultG: 150, defaultUnit: "g" },
  { keys: ["poulet"], label: "Poulet", kcal: 165, protein: 31, carbs: 0, fat: 3.6, defaultG: 150, defaultUnit: "g" },
  { keys: ["huile"], label: "Huile", kcal: 884, protein: 0, carbs: 0, fat: 100, defaultG: 10, defaultUnit: "cs" },
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
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:s|x)?(?:$|[^a-z0-9])`).test(text);
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

/** 1 décimale. Pas de plancher 1 g / 75 g — 1,5 g est valide. */
export function clampGrams(n: number) {
  if (!Number.isFinite(n) || n <= 0) return 0.1;
  return Math.round(n * 10) / 10;
}

export function formatQtyNumber(n: number) {
  const value = clampGrams(n);
  return Number.isInteger(value) ? String(value) : String(value).replace(".", ",");
}

export function qtyLabel(qty: number, unit: QtyUnit) {
  const n = formatQtyNumber(qty);
  const plural = qty > 1;
  if (unit === "tranche") return `${n} tranche${plural ? "s" : ""}`;
  if (unit === "carreau") return `${n} carreau${plural ? "x" : ""}`;
  if (unit === "piece") return `${n} pièce${plural ? "s" : ""}`;
  if (unit === "ml") return `${n} ml`;
  if (unit === "cs") return `${n} cs`;
  if (unit === "cc") return `${n} cc`;
  return `${n} g`;
}

export function unitShortLabel(unit: QtyUnit) {
  if (unit === "tranche") return "tr.";
  if (unit === "carreau") return "car.";
  if (unit === "piece") return "pce";
  return unit;
}

export function qtyStep(unit: QtyUnit) {
  if (unit === "g" || unit === "ml") return 1;
  if (unit === "piece" || unit === "tranche") return 0.5;
  return 1;
}

export type ParsedLogLine = {
  name: string;
  qty: number;
  unit: QtyUnit;
  grams: number;
};

function countFromWord(raw: string) {
  const n = norm(raw).replace(/\s+/g, " ").trim();
  if (/^une?$/.test(n)) return 1;
  if (/^deux$/.test(n)) return 2;
  if (/^demi/.test(n) || n === "1/2" || n === "½" || n === "0.5" || n === "0,5") return 0.5;
  return num(raw);
}

function parseHalfPrefix(chunk: string): { rest: string } | null {
  const m = chunk
    .trim()
    .match(/^(?:une?\s+)?(?:demi(?:e)?(?:-|\s+)?|1\s*\/\s*2\s+|½\s+|0[.,]5\s+)(?:de\s+|d'|d’)?(.+)$/i);
  if (!m?.[1]) return null;
  return { rest: m[1].trim() };
}

function parseCountPrefix(chunk: string): { qty: number; rest: string } | null {
  const m = chunk.trim().match(/^(\d+(?:[.,]\d+)?|une?|deux)\s+(?:de\s+|d'|d’)?(.+)$/i);
  if (!m) return null;
  const rest = m[2].trim();
  if (!rest || parseQtyUnit(rest.split(/\s+/)[0] ?? "")) return null;
  return { qty: countFromWord(m[1]), rest };
}

function isWholeItem(food: FoodRef) {
  return /banane|pomme|poire|orange|kiwi|avocat|oeuf|œuf/.test(norm(food.keys[0]));
}

function portionOf(food: FoodRef | undefined, qty: number, unit: QtyUnit, gramsHint?: number) {
  const typical = clampGrams(qty * gramsPerUnit(unit, food));
  if (!gramsHint || !food) return typical;
  return clampGrams(gramsHint);
}

function parseGramsFromChunk(chunk: string, unit: QtyUnit, qty: number, food?: FoodRef) {
  const paren = chunk.match(/\((\d+(?:[.,]\d+)?)\s*g\)/i);
  if (paren) return clampGrams(num(paren[1]));
  if (unit === "g" || unit === "ml") return clampGrams(qty);
  return clampGrams(qty * gramsPerUnit(unit, food));
}

function parseGrams(chunk: string, food?: FoodRef) {
  return parseLogLine(chunk, food).grams;
}

export function parseLogLine(line: string, foodHint?: FoodRef): ParsedLogLine {
  const trimmed = line.trim();
  const food = foodHint ?? matchFood(trimmed);

  const colon = trimmed.match(
    new RegExp(
      `^(.*?)\\s*:\\s*(\\d+(?:[.,]\\d+)?|une?|demi(?:e)?)\\s*(${UNIT_TOKEN})\\s*(?:\\((\\d+(?:[.,]\\d+)?)\\s*g\\))?\\s*$`,
      "i",
    ),
  );
  if (colon) {
    const unit = parseQtyUnit(colon[3]) ?? "g";
    const qty = countFromWord(colon[2]);
    const grams = colon[4]
      ? clampGrams(num(colon[4]))
      : parseGramsFromChunk(trimmed, unit, qty, food);
    return { name: titleName(colon[1].trim()) || foodName(food, trimmed), qty, unit, grams };
  }

  const trailing = trimmed.match(
    new RegExp(
      `^(.*?)\\s+(\\d+(?:[.,]\\d+)?|une?|demi(?:e)?)\\s*(${UNIT_TOKEN})\\s*(?:\\((\\d+(?:[.,]\\d+)?)\\s*g\\))?\\s*$`,
      "i",
    ),
  );
  if (trailing) {
    const unit = parseQtyUnit(trailing[3]) ?? "g";
    const qty = countFromWord(trailing[2]);
    const grams = trailing[4]
      ? clampGrams(num(trailing[4]))
      : parseGramsFromChunk(trimmed, unit, qty, food);
    const name = leftoverName(trailing[1]) || foodName(food, trimmed);
    return { name, qty, unit, grams };
  }

  const leading = trimmed.match(
    new RegExp(`^(\\d+(?:[.,]\\d+)?|une?|demi(?:e)?)\\s*(${UNIT_TOKEN})\\s+(?:de\\s+|d'|d’)?(.+)$`, "i"),
  );
  if (leading) {
    const unit = parseQtyUnit(leading[2]) ?? "g";
    const qty = countFromWord(leading[1]);
    const grams = parseGramsFromChunk(trimmed, unit, qty, food);
    return { name: foodName(food, leading[3]), qty, unit, grams };
  }

  const half = parseHalfPrefix(trimmed);
  if (half) {
    const named = foodHint ?? matchFood(half.rest);
    const grams = portionOf(named, 0.5, "piece");
    return {
      name: foodName(named, half.rest),
      qty: 0.5,
      unit: named ? "piece" : "g",
      grams,
    };
  }

  const counted = parseCountPrefix(trimmed);
  if (counted) {
    const named = foodHint ?? matchFood(counted.rest) ?? matchFood(trimmed);
    if (named) {
      return {
        name: foodName(named, counted.rest),
        qty: counted.qty,
        unit: "piece",
        grams: portionOf(named, counted.qty, "piece"),
      };
    }
  }

  const grams = food?.defaultG ?? 80;
  const unit = defaultUnitOf(food);
  return {
    name: foodName(food, trimmed),
    qty: unit === "g" || unit === "ml" ? grams : 1,
    unit,
    grams,
  };
}

export function formatLogLine(name: string, qty: number, unit: QtyUnit, grams: number) {
  const clean = name.trim() || "Aliment";
  const g = clampGrams(grams);
  const q = clampGrams(qty);
  if (unit === "ml") return `${clean} : ${formatQtyNumber(q)}ml`;
  if (unit === "cs") return `${clean} : ${formatQtyNumber(q)} cs (${formatQtyNumber(g)}g)`;
  if (unit === "cc") return `${clean} : ${formatQtyNumber(q)} cc (${formatQtyNumber(g)}g)`;
  if (unit === "carreau") return `${clean} : ${qtyLabel(q, "carreau")} (${formatQtyNumber(g)}g)`;
  return `${clean} : ${formatQtyNumber(g)}g`;
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
    .replace(/\b(une?|de|du|des|la|le|les)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return titleName(name);
}

function titleName(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "Aliment";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function catalogName(food: FoodRef) {
  return food.label ?? titleName(food.keys[0]);
}

function defaultUnitOf(food?: FoodRef): QtyUnit {
  if (!food) return "g";
  if (food.defaultUnit) return food.defaultUnit;
  if (isWholeItem(food)) return "piece";
  return "g";
}

function foodName(food: FoodRef | undefined, chunk: string) {
  if (food) return catalogName(food);
  return leftoverName(chunk) || "Aliment";
}

function macrosAt(food: FoodRef | undefined, grams: number, name = "") {
  if (food) {
    return {
      calories: Math.max(0, Math.round((food.kcal * grams) / 100)),
      protein: Math.max(0, Math.round((food.protein * grams) / 100)),
      carbs: Math.max(0, Math.round((food.carbs * grams) / 100)),
      fat: Math.max(0, Math.round((food.fat * grams) / 100)),
    };
  }
  return estimateIngredientMacros(name || "aliment", grams);
}

function splitChunks(text: string) {
  const protectedFractions = text.replace(/(\d+)\s*\/\s*(\d+)/g, "$1\u2044$2");
  return protectedFractions
    .split(
      /\s*(?:,|;|\+|\/|\n|\s+avec\s+|\s+et\s+|\s+puis\s+|\s+tartin\S*\s+de\s+|\s+napp\S*\s+de\s+|\s+garni\S*\s+de\s+|\s+recouvert\S*\s+de\s+)\s*/gi,
    )
    .map((chunk) =>
      chunk
        .replace(/\u2044/g, "/")
        .replace(/^(de la|du|de l'|d'|des|le|la|les)\s+/i, "")
        .trim(),
    )
    .filter((chunk) => chunk.length > 1);
}

export function parseFoodTextLocal(text: string): DetectedIngredient[] {
  const chunks = splitChunks(text.trim());
  const parts = chunks.length > 0 ? chunks : [text.trim() || "Aliment"];
  return parts.map((chunk, index) => {
    const food = matchFood(chunk);
    const parsed = parseLogLine(chunk, food);
    return applyTrustedNutrition({
      id: `t-${Date.now()}-${index}`,
      name: parsed.name,
      grams: parsed.grams,
      qty: parsed.qty,
      unit: parsed.unit,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    });
  });
}

export function applyTrustedNutrition(item: DetectedIngredient): DetectedIngredient {
  const food = matchFood(item.name);
  const name = food ? catalogName(food) : item.name;
  let unit = item.unit ?? defaultUnitOf(food);
  let grams = clampGrams(item.grams);
  let qty = item.qty ?? (unit === "g" || unit === "ml" ? grams : 1);

  // Pièce / tranche → grammes. Le poulet n'est pas un fruit.
  if (unit === "piece" || unit === "tranche") {
    if (!grams && food) grams = clampGrams((item.qty ?? 1) * gramsPerUnit(unit, food));
    unit = "g";
    qty = grams;
  }

  if (food && (unit === "g" || unit === "ml")) {
    return { ...item, name, grams, qty: unit === "g" ? grams : qty, unit, ...macrosAt(food, grams, name) };
  }

  if (food) {
    grams = portionOf(food, qty, unit, item.grams);
    return { ...item, name, grams, qty, unit, ...macrosAt(food, grams, name) };
  }

  const table = macrosAt(undefined, grams, name);
  const density = item.grams > 0 ? (item.calories * 100) / item.grams : 0;
  if (density >= 20 && density <= 900 && item.calories > 0) {
    if (grams === clampGrams(item.grams)) return { ...item, name, grams, qty, unit };
    const ratio = grams / item.grams;
    return {
      ...item,
      name,
      grams,
      qty,
      unit,
      calories: Math.max(0, Math.round(item.calories * ratio)),
      protein: Math.max(0, Math.round(item.protein * ratio)),
      carbs: Math.max(0, Math.round((item.carbs ?? 0) * ratio)),
      fat: Math.max(0, Math.round((item.fat ?? 0) * ratio)),
    };
  }
  return { ...item, name, grams, qty, unit, ...table };
}

export function scaleDetected(item: DetectedIngredient, grams: number): DetectedIngredient {
  const next = clampGrams(grams);
  const unit = item.unit === "ml" ? "ml" : item.unit === "cs" || item.unit === "cc" || item.unit === "carreau" ? item.unit : "g";
  const qty = unit === "g" || unit === "ml" ? next : item.qty;
  const food = matchFood(item.name);
  if (food) {
    return { ...item, name: catalogName(food), grams: next, qty, unit, ...macrosAt(food, next, catalogName(food)) };
  }
  const ratio = item.grams > 0 ? next / item.grams : 1;
  return {
    ...item,
    grams: next,
    qty,
    unit,
    calories: Math.max(0, Math.round(item.calories * ratio)),
    protein: Math.max(0, Math.round(item.protein * ratio)),
    carbs: Math.max(0, Math.round((item.carbs ?? 0) * ratio)),
    fat: Math.max(0, Math.round((item.fat ?? 0) * ratio)),
  };
}

export function scaleDetectedQty(item: DetectedIngredient, qty: number): DetectedIngredient {
  const unit = item.unit ?? "g";
  const from = Math.max(0.01, item.qty ?? (unit === "g" || unit === "ml" ? item.grams : 1));
  const nextQty = clampGrams(qty);
  const grams = clampGrams((item.grams / from) * nextQty);
  return { ...scaleDetected(item, grams), qty: nextQty, unit: unit === "piece" || unit === "tranche" ? "g" : unit };
}

/** Reverse from kcal → grams (density of the current portion), then qty. */
export function scaleDetectedKcal(item: DetectedIngredient, kcal: number): DetectedIngredient {
  const target = Math.max(1, Math.round(kcal));
  const density = item.grams > 0 && item.calories > 0 ? item.calories / item.grams : 0;
  if (density <= 0) {
    const ratio = item.calories > 0 ? target / item.calories : 1;
    return {
      ...item,
      calories: target,
      protein: Math.max(0, Math.round(item.protein * ratio)),
      carbs: Math.max(0, Math.round((item.carbs ?? 0) * ratio)),
      fat: Math.max(0, Math.round((item.fat ?? 0) * ratio)),
    };
  }
  const grams = clampGrams(target / density);
  const next = scaleDetected(item, grams);
  const unit = next.unit ?? "g";
  if (unit === "g" || unit === "ml") return next;
  const fromG = Math.max(0.1, item.grams);
  const fromQ = Math.max(0.01, item.qty ?? 1);
  const qty = clampGrams((fromQ / fromG) * grams);
  return { ...next, qty };
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
  const macros = macrosAt(food, parsed.grams, parsed.name);
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
  if (ai.length === 0) return local.map(applyTrustedNutrition);
  if (local.length > ai.length && local.length >= 2) {
    return local.map(applyTrustedNutrition);
  }
  const hasExplicitG = /(\d+(?:[.,]\d+)?)\s*(g|gr\.?|grammes?)\b/i.test(text);
  const hasVisualQty =
    /(\d+(?:[.,]\d+)?|une?|demi(?:e)?)\s*(carreaux?|carr[eé]s?|tranches?|pi[eè]ces?|cs|cc)\b/i.test(
      text,
    ) || /(?:demi(?:e)?|1\s*\/\s*2|½)/i.test(text);
  return ai.map((item, index) => {
    const loc = local[index];
    const base = { ...item, name: item.name || loc?.name || item.name };
    if (!loc) return applyTrustedNutrition(base);
    const preferLocalGrams =
      loc.grams !== item.grams &&
      (hasExplicitG ||
        hasVisualQty ||
        Boolean(loc.unit && loc.unit !== "g" && loc.unit !== "ml"));
    if (!preferLocalGrams) return applyTrustedNutrition(base);
    return applyTrustedNutrition({
      ...base,
      grams: loc.grams,
      qty: loc.qty,
      unit: loc.unit,
    });
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
    const grams = clampGrams(Number(row.grams) || 0);
    if (!name || grams <= 0) return;
    const parsedUnit = parseQtyUnit(String(row.unit ?? "g")) ?? "g";
    const unit = parsedUnit === "piece" || parsedUnit === "tranche" ? "g" : parsedUnit;
    out.push({
      id: `ai-${Date.now()}-${index}`,
      name,
      grams,
      qty: unit === "g" || unit === "ml" ? grams : Number(row.qty) > 0 ? Number(row.qty) : 1,
      unit,
      calories: Math.max(0, Math.round(Number(row.calories) || 0)),
      protein: Math.max(0, Math.round(Number(row.protein) || 0)),
      carbs: Math.max(0, Math.round(Number(row.carbs) || 0)),
      fat: Math.max(0, Math.round(Number(row.fat) || 0)),
    });
  });
  return out;
}

export function foodLogPrompt(text: string, diet: DietType) {
  return `Tu identifies et sépares les aliments d'une saisie libre en français. Tu n'inventes PAS les calories.
Régime : ${diet === "vegan" ? "vegan (aucun produit animal)" : "omnivore"}.

Texte : """${text}"""

Règles :
- Découpe CHAQUE aliment séparé par avec, et, +, virgule, tartiné de, nappé de.
- Exemple : "1 tranche de pain bûcheron avec margarine végétale et 1 tranche de bacon VG"
  → 3 ingrédients : Pain bûcheron (1 tranche, 40 g) + Margarine végétale (1 cs, 10 g) + Bacon végétal (1 tranche, 20 g).
- N'ajoute JAMAIS un aliment absent du texte.
- "lait d'avoine" / "café au lait d'avoine" = BOISSON. "flocon(s) d'avoine" = flocons (solide), nom exact « Flocons d'avoine ».
- Noms catalogue, sans répétition : « Flocons d'avoine » (pas « Flocons d'avoine flocon »), « Pain bûcheron », « Margarine végétale », « Bacon végétal », « Banane ».
- Viande, poisson, tofu, fromage, riz, pâtes, pain : unit "g" uniquement. JAMAIS pièce, tranche, ni fruit.
- Fruit / œuf : convertis en grammes (banane ≈ 110 g, demi ≈ 55 g, œuf ≈ 55 g). unit "g".
- Si un poids est écrit (1,5 g / 50 g), UTILISE exactement ce gramme, même tout petit.
- Portions si rien n'est pesé : banane ≈ 110 g, pain ≈ 40 g, margarine 1 cs ≈ 10 g, bacon VG ≈ 20 g, flocons d'avoine ≈ 50 g, œuf ≈ 55 g, chocolat 1 carreau ≈ 10 g, poulet selon le texte en grammes (pas de minimum).
- calories / protein / carbs / fat = 0 (table CIQUAL côté serveur).

JSON strict :
{ "ingredients": [{ "name": "Pain bûcheron", "qty": 40, "unit": "g", "grams": 40, "calories": 0, "protein": 0, "carbs": 0, "fat": 0 }] }`;
}

export async function analyzeFoodText(text: string, diet: DietType): Promise<DetectedIngredient[]> {
  const fallback = parseFoodTextLocal(text).map(applyTrustedNutrition);
  try {
    const raw = await generateGeminiFlash({
      parts: [{ text: foodLogPrompt(text, diet) }],
      temperature: 0.1,
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
- Poids en grammes UNIQUEMENT (unit "g"). Poulet, tofu, viande : jamais pièce / tranche / fruit.
- Estime un poids réaliste pour la portion SUR L'ASSIETTE — aucun minimum (40 g de poulet est valide).
- Banane entière ≈ 110 g, demi ≈ 55 g (jamais 200 g+ pour une demi).
- calories / protein / carbs / fat = 0 (le serveur calcule via table CIQUAL).
- Noms en français, génériques (Banane, Pain, Tofu, Poulet), sans le poids dans le name.
- Si la photo est floue, donne quand même les aliments les plus probables.
- Ne sors pas de JSON.

JSON strict :
{ "ingredients": [{ "name": "Poulet", "qty": 40, "unit": "g", "grams": 40, "calories": 0, "protein": 0, "carbs": 0, "fat": 0 }] }`;
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
  const parsed = mapGeminiIngredients(parseGeminiJson(raw)).map(applyTrustedNutrition);
  if (parsed.length === 0) {
    throw new Error("Aucun aliment reconnu sur la photo.");
  }
  return parsed;
}
