import type { PlannedMeal } from "@/lib/types";
import { dessertWeekdaysOf, isWeekLunchDessert } from "@/lib/week-dessert";

export type QtyMode = "repas" | "batch";

export function cookScale(meal: PlannedMeal, mode: QtyMode) {
  if (mode === "repas") return 1;
  if (isWeekLunchDessert(meal)) return Math.max(1, dessertWeekdaysOf(meal).length);
  return meal.servingsPerPerson || 1;
}

export function cookQtyCaption(meal: PlannedMeal, mode: QtyMode) {
  if (isWeekLunchDessert(meal)) {
    const n = dessertWeekdaysOf(meal).length;
    if (mode === "repas") return "Recette · 1 part / pers. (un midi)";
    return `Recette · total à cuisiner · ${n} midi${n > 1 ? "s" : ""} × 2 pers.`;
  }
  if (mode === "repas") {
    return meal.servingsPerPerson === 2
      ? "Recette · 1 repas / pers. (batch : bascule sur Total à cuisiner)"
      : "Recette · 1 repas / pers.";
  }
  if (meal.servingsPerPerson === 2) {
    return "Recette · total à cuisiner · 4 assiettes (2 pers. × 2 repas)";
  }
  return "Recette · total à cuisiner · 2 assiettes (1 repas foyer)";
}
