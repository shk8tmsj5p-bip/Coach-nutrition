import type { DetectedIngredient, Macros, MealEntry, MealType, QtyUnit } from "@/lib/types";
import { formatLogLine, parseLogLine, applyTrustedNutrition, scaleDetected, scaleDetectedQty } from "@/lib/food-log";
import {
  isDessertItemLine,
  isEmptyDessertMarker,
  stripDessertPrefix,
} from "@/lib/meal-templates";

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
  qty: number;
  unit: QtyUnit;
}

function asEditable(item: DetectedIngredient, dessert?: boolean): EditableItem {
  return {
    ...item,
    qty: item.qty ?? item.grams,
    unit: item.unit ?? "g",
    carbs: item.carbs ?? 0,
    fat: item.fat ?? 0,
    dessert,
  };
}

export function parseMealItems(meal: MealEntry): EditableItem[] {
  const lines =
    meal.items && meal.items.length > 0
      ? meal.items.filter((line) => !isEmptyDessertMarker(line))
      : meal.name
        ? [meal.name]
        : ["Aliment"];

  return lines.map((line, index) => {
    const dessert = isDessertItemLine(line);
    const cleaned = dessert ? stripDessertPrefix(line) : line;
    const spec = parseLogLine(cleaned);
    return asEditable(
      applyTrustedNutrition({
        id: `${meal.id}-${index}`,
        name: spec.name,
        grams: spec.grams,
        qty: spec.qty,
        unit: spec.unit,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      }),
      dessert,
    );
  });
}

export function scaleItem(item: EditableItem, grams: number): EditableItem {
  return asEditable(scaleDetected(item, grams), item.dessert);
}

export function scaleItemQty(item: EditableItem, qty: number): EditableItem {
  return asEditable(scaleDetectedQty(item, qty), item.dessert);
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
      const line = formatLogLine(
        stripDessertPrefix(item.name).trim(),
        item.qty ?? item.grams,
        item.unit ?? "g",
        item.grams,
      );
      return item.dessert ? `Dessert : ${line}` : line;
    });
  if (opts?.markEmptyDessert && !items.some((item) => item.dessert)) {
    lines.push("Dessert : —");
  }
  return lines;
}
