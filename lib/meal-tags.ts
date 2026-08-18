import type { PlannedMeal } from "@/lib/types";
import { uniqueWeekdayBatches, weekendFreshMeals } from "@/lib/weekly-plan";

export type TaggedMeal = {
  tag: string;
  meal: PlannedMeal;
};

export function taggedUniqueMeals(plan: PlannedMeal[]): TaggedMeal[] {
  const unique = [...uniqueWeekdayBatches(plan), ...weekendFreshMeals(plan)];
  return unique.map((meal, index) => ({ tag: `P${index + 1}`, meal }));
}

export function planTagByMealId(plan: PlannedMeal[]): Map<string, string> {
  const tagged = taggedUniqueMeals(plan);
  const byBatch = new Map(tagged.map((row) => [row.meal.batchId, row.tag]));
  const map = new Map<string, string>();
  for (const meal of plan) {
    const tag = byBatch.get(meal.batchId);
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
