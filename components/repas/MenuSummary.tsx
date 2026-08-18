"use client";

import { Card, SectionTitle } from "@/components/ui/Card";
import { RecipeTag } from "@/components/repas/RecipeTag";
import { taggedUniqueMeals } from "@/lib/meal-tags";
import type { PlannedMeal } from "@/lib/types";
import { mealTypeLabel } from "@/lib/utils";
import { WEEKEND_INDEXES } from "@/lib/weekly-plan";

export function MenuSummary({
  plan,
  onSelect,
}: {
  plan: PlannedMeal[];
  onSelect?: (meal: PlannedMeal, tag: string) => void;
}) {
  const items = taggedUniqueMeals(plan);
  if (items.length === 0) return null;

  return (
    <div>
      <SectionTitle>Résumé du menu</SectionTitle>
      <Card>
        <div className="space-y-1">
          {items.map(({ tag, meal }) => {
            const weekend = WEEKEND_INDEXES.includes(meal.dayIndex);
            const inner = (
              <>
                <RecipeTag recipeNo={tag} className="mt-0.5 shrink-0" />
                <div className="min-w-0 text-left">
                  <p className="text-[14px] font-semibold leading-snug">{meal.baseName}</p>
                  <p className="text-[12px] text-health-muted">
                    {weekend
                      ? `${meal.day} · ${mealTypeLabel(meal.mealType)} · frais ×1`
                      : meal.coverLabel}
                    {meal.lowCalorie ? " · low cal" : ""}
                  </p>
                </div>
              </>
            );
            if (!onSelect) {
              return (
                <div key={`${tag}-${meal.batchId}`} className="flex items-start gap-2">
                  {inner}
                </div>
              );
            }
            return (
              <button
                key={`${tag}-${meal.batchId}`}
                type="button"
                onClick={() => onSelect(meal, tag)}
                className="flex w-full items-start gap-2 rounded-2xl px-1 py-1.5 -mx-1 hover:bg-health-bg"
              >
                {inner}
              </button>
            );
          })}
        </div>
        {onSelect ? (
          <p className="mt-2 text-[11px] text-health-muted">Touche P1, P2… pour la recette détaillée.</p>
        ) : null}
      </Card>
    </div>
  );
}
