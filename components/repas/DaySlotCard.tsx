"use client";

import { Card } from "@/components/ui/Card";
import { RecipeTag } from "@/components/repas/RecipeTag";
import { isEmptyMeal } from "@/lib/weekly-plan";
import type { PlannedMeal } from "@/lib/types";
import { mealTypeLabel } from "@/lib/utils";

export function DaySlotCard({
  meal,
  planTag,
  busy,
  onGenerate,
}: {
  meal: PlannedMeal;
  planTag?: string;
  busy?: boolean;
  onGenerate: () => void;
}) {
  const empty = isEmptyMeal(meal);

  return (
    <Card className="py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-health-muted">
        {mealTypeLabel(meal.mealType)}
        {meal.lowCalorie ? " · low cal" : ""}
      </p>
      <p className="mt-0.5 text-[15px] font-semibold leading-snug">
        {planTag ? <RecipeTag recipeNo={planTag} className="mr-1.5 align-middle" /> : null}
        {empty ? "Aucun repas" : meal.baseName}
      </p>
      {empty ? (
        <button
          type="button"
          disabled={busy}
          onClick={onGenerate}
          className="mt-2 rounded-full bg-health-bg px-3 py-1.5 text-[12px] font-semibold disabled:opacity-50"
        >
          Générer
        </button>
      ) : (
        <p className="mt-0.5 text-[12px] text-health-muted">{meal.coverLabel}</p>
      )}
    </Card>
  );
}
