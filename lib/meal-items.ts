import type { DetectedIngredient, Macros, MealEntry, MealType } from "@/lib/types";
import { normalizeIngredientLines } from "@/lib/food-log";
import {
  isDessertItemLine,
  isEmptyDessertMarker,
  stripDessertPrefix,
} from "@/lib/meal-templates";

const GRAMS_RE = /(\d+(?:[.,]\d+)?)\s*g\b/i;

export const MEAL_TYPE_OPTIONS: { id: MealType; label: string }[] = [
  { id: "petit-dejeuner", label: "Petit-déjeuner" },
  { id: "dejeuner", label: "Déjeuner" },
  { id: "diner", label: "Dîner" },
  { id: "collation", label: "Collation" },
];

export interface EditableItem extends DetectedIngredient {
  carbs: number;
  fat: number;
  dessert?: boolean;
}

function round1(value: number) {
  return Math.max(0, Math.round(value * 10) / 10);
}

function shareMacros(items: Omit<EditableItem, "calories" | "protein" | "carbs" | "fat">[], macros: Macros): EditableItem[] {
  const totalGrams = items.reduce((sum, item) => sum + item.grams, 0) || items.length || 1;
  return items.map((item) => {
    const share = item.grams / totalGrams;
    return {
      ...item,
      calories: Math.round(macros.calories * share),
      protein: round1(macros.protein * share),
      carbs: round1(macros.carbs * share),
      fat: round1(macros.fat * share),
    };
  });
}

export function parseMealItems(meal: MealEntry): EditableItem[] {
  const lines =
    meal.items && meal.items.length > 0
      ? meal.items.filter((line) => !isEmptyDessertMarker(line))
      : meal.name
        ? [meal.name]
        : ["Aliment"];

  const parsed = lines.map((line, index) => {
    const dessert = isDessertItemLine(line);
    const cleaned = dessert ? stripDessertPrefix(line) : line;
    const match = cleaned.match(GRAMS_RE);
    const grams = match ? Number(match[1].replace(",", ".")) : 100;
    const name = cleaned.replace(GRAMS_RE, "").replace(/[·,;\-]+$/, "").trim() || cleaned;
    return { id: `${meal.id}-${index}`, name, grams, dessert };
  });

  const plat = parsed.filter((item) => !item.dessert);
  const dessert = parsed.filter((item) => item.dessert);
  if (dessert.length === 0) return shareMacros(parsed, meal.macros);
  if (plat.length === 0) return shareMacros(dessert, meal.macros);

  const dessertMacros = normalizeIngredientLines(
    dessert.map((item) => `${item.name} ${Math.round(item.grams)}g`),
  ).macros;
  const platMacros: Macros = {
    calories: Math.max(0, meal.macros.calories - dessertMacros.calories),
    protein: Math.max(0, meal.macros.protein - dessertMacros.protein),
    carbs: Math.max(0, meal.macros.carbs - dessertMacros.carbs),
    fat: Math.max(0, meal.macros.fat - dessertMacros.fat),
  };

  const byId = new Map<string, EditableItem>();
  for (const item of shareMacros(plat, platMacros)) byId.set(item.id, item);
  for (const item of shareMacros(dessert, dessertMacros)) byId.set(item.id, item);
  return parsed.map((item) => byId.get(item.id)!);
}

export function scaleItem(item: EditableItem, grams: number): EditableItem {
  const nextGrams = Math.max(1, grams);
  const ratio = item.grams > 0 ? nextGrams / item.grams : 1;
  return {
    ...item,
    grams: nextGrams,
    calories: Math.round(item.calories * ratio),
    protein: round1(item.protein * ratio),
    carbs: round1(item.carbs * ratio),
    fat: round1(item.fat * ratio),
  };
}

export function sumEditableMacros(items: EditableItem[]): Macros {
  return items.reduce(
    (acc, item) => ({
      calories: acc.calories + item.calories,
      protein: acc.protein + item.protein,
      carbs: acc.carbs + item.carbs,
      fat: acc.fat + item.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export function serializeItems(items: EditableItem[], opts?: { markEmptyDessert?: boolean }): string[] {
  const lines = items
    .filter((item) => item.name.trim())
    .map((item) => {
      const line = `${stripDessertPrefix(item.name).trim()} ${Math.round(item.grams)}g`;
      return item.dessert ? `Dessert : ${line}` : line;
    });
  if (opts?.markEmptyDessert && !items.some((item) => item.dessert)) {
    lines.push("Dessert : —");
  }
  return lines;
}
