import { shoppingDisplayName } from "@/lib/shopping-from-plan";
import { storage } from "@/lib/storage";
import { isEmptyMeal } from "@/lib/weekly-plan";
import type { PlannedMeal } from "@/lib/types";

export type StockGroup = "frais" | "surgeles" | "epicerie" | "restes";
export type StockIntensity = "use" | "empty";

export type StockItem = {
  id: string;
  name: string;
  quantity: string;
  group: StockGroup;
};

export type HouseholdStock = {
  items: StockItem[];
  useStock: boolean;
  intensity: StockIntensity;
};

export const STOCK_GROUPS: { id: StockGroup; label: string }[] = [
  { id: "frais", label: "Frais" },
  { id: "surgeles", label: "Surgelés" },
  { id: "epicerie", label: "Épicerie" },
  { id: "restes", label: "Restes" },
];

export const STOCK_QUICK_ADD = [
  "Tofu ferme",
  "Pois chiches",
  "Lentilles",
  "Riz",
  "Épinards surgelés",
  "Patate douce",
  "Edamame",
];

export const DEFAULT_STOCK: HouseholdStock = {
  items: [],
  useStock: true,
  intensity: "use",
};

const STORAGE_KEY = "household-stock";

function fold(text: string) {
  return text
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function asGroup(value: unknown): StockGroup {
  return STOCK_GROUPS.some((item) => item.id === value) ? (value as StockGroup) : "epicerie";
}

function asIntensity(value: unknown): StockIntensity {
  return value === "empty" ? "empty" : "use";
}

function slugId(name: string) {
  const slug = fold(name).replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  return `stock-${slug || "item"}-${Date.now().toString(36)}`;
}

export function parseStockItem(raw: unknown): StockItem | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const name = String(rec.name ?? "").trim();
  if (!name) return null;
  return {
    id: String(rec.id ?? "").trim() || slugId(name),
    name,
    quantity: String(rec.quantity ?? rec.qty ?? "").trim(),
    group: asGroup(rec.group),
  };
}

export function parseHouseholdStock(raw: unknown): HouseholdStock {
  const rec = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const list = Array.isArray(rec.items) ? rec.items : Array.isArray(raw) ? raw : [];
  const items: StockItem[] = [];
  const seen = new Set<string>();
  for (const row of list) {
    const item = parseStockItem(row);
    if (!item) continue;
    const key = fold(item.name);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }
  return {
    items,
    useStock: rec.useStock !== false,
    intensity: asIntensity(rec.intensity),
  };
}

export function loadLocalStock(): HouseholdStock {
  return parseHouseholdStock(storage.getJSON<unknown>(STORAGE_KEY, DEFAULT_STOCK));
}

export function saveLocalStock(stock: HouseholdStock) {
  storage.setJSON(STORAGE_KEY, stock);
}

export function formatStockItem(item: StockItem) {
  return item.quantity ? `${item.name} (${item.quantity})` : item.name;
}

export function addStockItem(
  stock: HouseholdStock,
  input: { name: string; quantity?: string; group?: StockGroup },
): HouseholdStock {
  const name = input.name.trim();
  if (!name) return stock;
  const key = fold(name);
  const existing = stock.items.find((item) => fold(item.name) === key);
  const nextItem: StockItem = {
    id: existing?.id ?? slugId(name),
    name,
    quantity: (input.quantity ?? existing?.quantity ?? "").trim(),
    group: input.group ?? existing?.group ?? "epicerie",
  };
  return {
    ...stock,
    items: existing
      ? stock.items.map((item) => (item.id === existing.id ? nextItem : item))
      : [...stock.items, nextItem],
  };
}

export function removeStockItem(stock: HouseholdStock, id: string): HouseholdStock {
  return { ...stock, items: stock.items.filter((item) => item.id !== id) };
}

export function removeStockItems(stock: HouseholdStock, ids: string[]): HouseholdStock {
  const drop = new Set(ids);
  return { ...stock, items: stock.items.filter((item) => !drop.has(item.id)) };
}

export function stockIsActive(stock: HouseholdStock) {
  return stock.useStock && stock.items.length > 0;
}

function leftoverNeedle(name: string) {
  return fold(name)
    .replace(/^restes?\s*/, "")
    .replace(/^p\d+\s*/, "")
    .trim();
}

export function namesMatchStock(stockName: string, candidate: string) {
  const a = fold(shoppingDisplayName(stockName));
  const b = fold(shoppingDisplayName(candidate));
  const raw = fold(candidate);
  if (!a) return false;
  if (a === b || a === raw) return true;
  if (a.length >= 4 && (b.includes(a) || raw.includes(a))) return true;
  if (b.length >= 4 && a.includes(b)) return true;
  const rest = leftoverNeedle(stockName);
  if (rest.length >= 4 && (raw.includes(rest) || b.includes(rest) || fold(candidate).includes(rest))) {
    return true;
  }
  return false;
}

export function stockItemMatchesMeal(item: StockItem, meal: PlannedMeal) {
  if (isEmptyMeal(meal)) return false;
  if (namesMatchStock(item.name, meal.baseName)) return true;
  return meal.ingredients.some((ing) => namesMatchStock(item.name, ing.name));
}

export function stockItemsUsedInMeals(items: StockItem[], meals: PlannedMeal[]) {
  return items.filter((item) => meals.some((meal) => stockItemMatchesMeal(item, meal)));
}

export function stockItemsUsedInNames(items: StockItem[], names: string[]) {
  const candidates = names.map((name) => name.trim()).filter(Boolean);
  return items.filter((item) => candidates.some((name) => namesMatchStock(item.name, name)));
}

/** Recettes vraiment nouvelles / régénérées (1 par batch). */
export function newlyGeneratedMeals(previous: PlannedMeal[], next: PlannedMeal[]) {
  const changed = next.filter((meal) => {
    if (isEmptyMeal(meal)) return false;
    const old = previous.find((item) => item.id === meal.id);
    return !old || isEmptyMeal(old) || old.baseName !== meal.baseName;
  });
  const seen = new Set<string>();
  return changed.filter((meal) => {
    const key = meal.batchId || meal.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function formatStockForPrompt(stock: HouseholdStock) {
  if (!stockIsActive(stock)) return "";
  const lines = stock.items
    .map((item) => {
      const group = STOCK_GROUPS.find((row) => row.id === item.group)?.label ?? item.group;
      return `- ${formatStockItem(item)} · ${group}`;
    })
    .join("\n");
  const mode =
    stock.intensity === "empty"
      ? `MODE VIDER LE STOCK : maximise l'usage de CES ingrédients. Courses = uniquement ce qui manque pour une recette cohérente (herbe, agrume, sauce maison). Interdit d'ajouter une 2e protéine « pour le fun » hors stock. Dans tips_and_cautions : « utilise le reste de … ».`
      : `MODE S'EN SERVIR : CHAQUE recette DOIT mettre en vedette AU MOINS 1 ingrédient du stock (titre + base partagée + une étape dédiée). Tu PEUX compléter par des courses (herbe fraîche, citron, sauce maison).`;
  return `STOCK FOYER (déjà à la maison — ce n'est PAS la liste de courses) :
${lines}
${mode}
Le thème (s'il est fourni) S'AJOUTE au stock : l'ingrédient stock est la star, le thème le cadre. Un reste de plat ([P2], curry…) se réemploie dans un autre assemblage, jamais le même titre.`;
}
