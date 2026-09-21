"use client";

import { X } from "lucide-react";
import { RecipeTag } from "@/components/repas/RecipeTag";
import { planTagByMealId } from "@/lib/meal-tags";
import { pairForSlot, WEEK_DAYS, isEmptyMeal } from "@/lib/weekly-plan";
import type { PlannedMeal } from "@/lib/types";
import { cn, mealTypeLabel } from "@/lib/utils";

export function PickMealSlotSheet({
  plan,
  title = "Générer un repas",
  hint = "Un plat déjà posé affiche son tag (P1, P2…). Le générer le remplace. En semaine, ça couvre les 2 créneaux du batch ; le week-end, un seul repas frais.",
  notice,
  onClose,
  onSelect,
}: {
  plan: PlannedMeal[];
  title?: string;
  hint?: string;
  notice?: string;
  onClose: () => void;
  onSelect: (slotId: string) => void;
}) {
  const tags = planTagByMealId(plan);

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/30">
      <div className="max-h-[80vh] w-full max-w-[430px] overflow-y-auto rounded-t-[24px] bg-white p-4 pb-8 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[17px] font-semibold">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-full bg-health-bg p-1.5">
            <X size={16} />
          </button>
        </div>
        <p className="mb-3 text-[13px] leading-snug text-health-muted">{hint}</p>
        {notice ? (
          <p className="mb-3 rounded-2xl bg-amber-50 px-3 py-2 text-[12px] leading-snug text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            {notice}
          </p>
        ) : null}
        <div className="space-y-3">
          {WEEK_DAYS.map((day) => {
            const meals = plan.filter((meal) => meal.day === day);
            return (
              <div key={day}>
                <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-health-muted">
                  {day}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {meals.map((meal) => {
                    const empty = isEmptyMeal(meal);
                    const tag = tags.get(meal.id);
                    const pair = pairForSlot(meal.id);
                    const cover = pair?.label ?? "1 repas frais";
                    return (
                      <button
                        key={meal.id}
                        type="button"
                        onClick={() => onSelect(meal.id)}
                        className={cn(
                          "rounded-card px-3 py-3 text-left",
                          empty ? "bg-health-bg" : "bg-health-bg ring-1 ring-health-line",
                        )}
                      >
                        <span className="flex items-center justify-between gap-1">
                          <span className="text-[13px] font-semibold">{mealTypeLabel(meal.mealType)}</span>
                          {tag ? <RecipeTag recipeNo={tag} compact /> : null}
                        </span>
                        <span
                          className={cn(
                            "mt-0.5 line-clamp-2 block text-[11px] leading-snug",
                            empty ? "text-health-muted" : "font-medium",
                          )}
                        >
                          {empty ? "Libre" : meal.baseName}
                        </span>
                        <span className="mt-0.5 block text-[10px] leading-snug text-health-muted">
                          {empty ? cover : pair ? `Écrase ${pair.label}` : "Ce repas seulement"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
