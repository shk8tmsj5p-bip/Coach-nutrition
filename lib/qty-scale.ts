import type { PlannedMeal } from "@/lib/types";

export type QtyMode = "repas" | "batch";

export function cookScale(meal: PlannedMeal, mode: QtyMode) {
  if (mode === "repas") return 1;
  return meal.servingsPerPerson || 1;
}

export function cookQtyCaption(meal: PlannedMeal, mode: QtyMode) {
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
