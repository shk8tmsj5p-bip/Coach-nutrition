import type { PlannedMeal } from "@/lib/types";

const DESSERT_TITLE_RE =
  /fondant|clafoutis|\btarte\b|gâteau|gateau|moelleux|liégeois|liegeois|brownie|cookie|crumble|mousse|tiramisu|\bflan\b|panna cotta|financier|madeleine|compote|chocolat intense|dessert midi/i;

export function isDessertRecipe(meal: PlannedMeal | null | undefined) {
  if (!meal) return false;
  if (meal.id === "week-lunch-dessert") return true;
  if (String(meal.batchId ?? "").startsWith("dessert-batch:")) return true;
  if (meal.day === "Dessert midi") return true;
  return DESSERT_TITLE_RE.test(meal.baseName);
}
