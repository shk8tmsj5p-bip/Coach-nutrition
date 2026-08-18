import type { DetectedIngredient, Macros, MealEntry, MealType } from "@/lib/types";

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
}

function round1(value: number) {
  return Math.max(0, Math.round(value * 10) / 10);
}

export function parseMealItems(meal: MealEntry): EditableItem[] {
  const lines =
    meal.items && meal.items.length > 0 ? meal.items : meal.name ? [meal.name] : ["Aliment"];

  const parsed = lines.map((line, index) => {
    const match = line.match(GRAMS_RE);
    const grams = match ? Number(match[1].replace(",", ".")) : 100;
    const name = line.replace(GRAMS_RE, "").replace(/[·,;\-]+$/, "").trim() || line;
    return { id: `${meal.id}-${index}`, name, grams, calories: 0, protein: 0, carbs: 0, fat: 0 };
  });

  const totalGrams = parsed.reduce((sum, item) => sum + item.grams, 0) || parsed.length;

  return parsed.map((item) => {
    const share = item.grams / totalGrams;
    return {
      ...item,
      calories: Math.round(meal.macros.calories * share),
      protein: round1(meal.macros.protein * share),
      carbs: round1(meal.macros.carbs * share),
      fat: round1(meal.macros.fat * share),
    };
  });
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

export function serializeItems(items: EditableItem[]): string[] {
  return items.map((item) => `${item.name} ${Math.round(item.grams)}g`);
}
