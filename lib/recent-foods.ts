import { applyTrustedNutrition, formatDetectedLine, parseLogLine } from "@/lib/food-log";
import { isDessertItemLine, isEmptyDessertMarker } from "@/lib/meal-templates";
import type { DetectedIngredient, MealEntry, ProfileId, QtyUnit } from "@/lib/types";

export type DatedMeal = MealEntry & { date: string };

export type RecentFood = {
  key: string;
  name: string;
  grams: number;
  qty: number;
  unit: QtyUnit;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

function foldName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/œ/g, "oe")
    .replace(/['’]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function linesOf(meal: MealEntry): string[] {
  if (meal.items && meal.items.length > 0) return meal.items;
  return meal.name.trim() ? [meal.name] : [];
}

export function recentFoodsFromMeals(meals: DatedMeal[], profileId: ProfileId, limit = 12): RecentFood[] {
  const ordered = [...meals]
    .filter((meal) => meal.profileId === profileId && !meal.isSkipped && meal.source !== "plan")
    .sort((a, b) => {
      const byDate = b.date.localeCompare(a.date);
      if (byDate) return byDate;
      return (b.time ?? "").localeCompare(a.time ?? "");
    });
  const byKey = new Map<string, RecentFood>();
  for (const meal of ordered) {
    for (const line of linesOf(meal)) {
      if (!line.trim() || isDessertItemLine(line) || isEmptyDessertMarker(line)) continue;
      const parsed = parseLogLine(line);
      const name = parsed.name.trim();
      const key = foldName(name);
      if (!key || key === "aliment" || key === "repas saute") continue;
      if (byKey.has(key)) continue;
      const trusted = applyTrustedNutrition({
        id: `recent-${key}`,
        name,
        grams: parsed.grams,
        qty: parsed.qty,
        unit: parsed.unit,
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      });
      byKey.set(key, {
        key,
        name: trusted.name,
        grams: trusted.grams,
        qty: trusted.qty ?? parsed.qty,
        unit: trusted.unit ?? parsed.unit,
        calories: trusted.calories,
        protein: trusted.protein,
        carbs: trusted.carbs ?? 0,
        fat: trusted.fat ?? 0,
      });
      if (byKey.size >= limit) {
        return [...byKey.values()];
      }
    }
  }
  return [...byKey.values()];
}

export function recentFoodToDetected(food: RecentFood): DetectedIngredient {
  return {
    id: `recent-${food.key}`,
    name: food.name,
    grams: food.grams,
    qty: food.qty,
    unit: food.unit,
    calories: food.calories,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
  };
}

export function recentFoodLine(food: RecentFood) {
  return formatDetectedLine(recentFoodToDetected(food));
}
