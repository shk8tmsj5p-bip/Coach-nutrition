"use client";

import { Card, SectionTitle } from "@/components/ui/Card";
import { RecipeTag } from "@/components/repas/RecipeTag";
import { groupPlanByDay, isEmptyMeal } from "@/lib/weekly-plan";
import type { PlannedMeal } from "@/lib/types";
import { mealTypeLabel } from "@/lib/utils";

export function WeekAgenda({
  plan,
  tags,
  busy,
  onOpen,
  onGenerate,
}: {
  plan: PlannedMeal[];
  tags: Map<string, string>;
  busy?: boolean;
  onOpen: (meal: PlannedMeal, tag: string) => void;
  onGenerate: (slotId: string) => void;
}) {
  const days = groupPlanByDay(plan);

  return (
    <div>
      <SectionTitle>Planning</SectionTitle>
      <Card className="p-3">
        <div className="space-y-3">
          {days.map(([day, meals]) => (
            <div key={day}>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-health-muted">
                {day}
              </p>
              <div className="space-y-1">
                {meals.map((meal) => {
                  const empty = isEmptyMeal(meal);
                  const tag = tags.get(meal.id);
                  const slot = mealTypeLabel(meal.mealType);
                  if (empty) {
                    return (
                      <button
                        key={meal.id}
                        type="button"
                        disabled={busy}
                        onClick={() => onGenerate(meal.id)}
                        className="flex w-full items-baseline gap-2 rounded-xl bg-health-bg px-2.5 py-1.5 text-left disabled:opacity-50"
                      >
                        <span className="w-8 shrink-0 text-[11px] font-semibold text-health-muted">
                          {slot === "Déjeuner" ? "Déj" : slot === "Dîner" ? "Dîn" : slot.slice(0, 3)}
                        </span>
                        <span className="text-[13px] text-health-muted">Aucun repas · Générer</span>
                      </button>
                    );
                  }
                  return (
                    <button
                      key={meal.id}
                      type="button"
                      onClick={() => tag && onOpen(meal, tag)}
                      className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left hover:bg-health-bg"
                    >
                      <span className="w-8 shrink-0 text-[11px] font-semibold text-health-muted">
                        {slot === "Déjeuner" ? "Déj" : slot === "Dîner" ? "Dîn" : slot.slice(0, 3)}
                      </span>
                      {tag ? <RecipeTag recipeNo={tag} className="shrink-0" /> : null}
                      <span className="min-w-0 truncate text-[13px] font-medium leading-snug">
                        {meal.baseName}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
