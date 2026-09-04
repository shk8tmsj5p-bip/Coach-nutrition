import type { PlannedMeal } from "@/lib/types";
import { normalizeTitle } from "@/lib/recipe-diversity";
import { isEmptyMeal } from "@/lib/weekly-plan";

export type TaggedMeal = {
  tag: string;
  meal: PlannedMeal;
};

/** Same dish = same [P…] tag, even after moving a slot to another day. */
export function recipeTagKey(meal: PlannedMeal) {
  return normalizeTitle(meal.baseName);
}

export function taggedUniqueMeals(plan: PlannedMeal[]): TaggedMeal[] {
  const seen = new Set<string>();
  const out: TaggedMeal[] = [];
  for (const meal of plan) {
    if (isEmptyMeal(meal)) continue;
    const key = recipeTagKey(meal);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ tag: `P${out.length + 1}`, meal });
  }
  return out;
}

export function planTagByMealId(plan: PlannedMeal[]): Map<string, string> {
  const tagged = taggedUniqueMeals(plan);
  const byRecipe = new Map(tagged.map((row) => [recipeTagKey(row.meal), row.tag]));
  const map = new Map<string, string>();
  for (const meal of plan) {
    if (isEmptyMeal(meal)) continue;
    const tag = byRecipe.get(recipeTagKey(meal));
    if (tag) map.set(meal.id, tag);
  }
  return map;
}

export function bracketTag(tag: string) {
  return `[${tag}]`;
}

export function formatTagList(tags: string[]) {
  const uniq = [...new Set(tags.filter(Boolean))];
  if (uniq.length === 0) return "";
  return `[${uniq.join(", ")}]`;
}
