import { isEmptyDessertMarker } from "@/lib/meal-templates";
import type { MealEntry, MealType, ProfileId } from "@/lib/types";

export function slotOfProfile(list: MealEntry[], profileId: ProfileId, type: MealType) {
  return list.find((meal) => meal.profileId === profileId && meal.type === type);
}

export function isFilledMeal(meal: MealEntry | undefined) {
  if (!meal || meal.isSkipped) return false;
  const items = (meal.items ?? []).filter(
    (line) => line.trim() && !isEmptyDessertMarker(line),
  );
  if (items.length > 0) return true;
  if (meal.macros.calories > 0) return true;
  const name = meal.name.trim().toLowerCase();
  return name.length > 0 && name !== "repas sauté";
}

/** Rempli ou sauté — les quatre créneaux sont « rangés ». */
export function isAccountedMeal(meal: MealEntry | undefined) {
  if (!meal) return false;
  if (meal.isSkipped) return true;
  return isFilledMeal(meal);
}
