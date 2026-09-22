"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { RecipeTag } from "@/components/repas/RecipeTag";
import { planTagByMealId } from "@/lib/meal-tags";
import { pairForSlot, WEEK_DAYS, isEmptyMeal } from "@/lib/weekly-plan";
import type { PlannedMeal } from "@/lib/types";
import { cn, mealTypeLabel } from "@/lib/utils";

function slotIsEmpty(meal: PlannedMeal) {
  const name = meal.baseName?.trim() ?? "";
  if (name && name !== "Aucun repas") return false;
  return isEmptyMeal(meal);
}

export function PickMealSlotSheet({
  plan,
  title = "Générer un repas",
  hint = "En semaine, ça remplace aussi le créneau pair.",
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
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const tags = planTagByMealId(plan);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="max-h-[min(80vh,calc(100dvh-var(--safe-top)-12px))] w-full max-w-[430px] overflow-y-auto rounded-t-[24px] bg-health-card p-4 pb-[max(24px,var(--safe-bottom))] shadow-card"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[17px] font-semibold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-health-bg"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>
        <p className="mb-3 text-[13px] leading-snug text-health-muted">{hint}</p>
        {notice ? (
          <p className="mb-3 rounded-2xl bg-amber-50 px-3 py-2 text-[12px] leading-snug text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            {notice}
          </p>
        ) : null}
        <div className="space-y-3">
          {WEEK_DAYS.map((day, dayIndex) => {
            const meals = plan.filter((meal) => meal.dayIndex === dayIndex);
            if (meals.length === 0) return null;
            return (
              <div key={day}>
                <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-health-muted">
                  {day}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {meals.map((meal) => {
                    const empty = slotIsEmpty(meal);
                    const tag = tags.get(meal.id);
                    const pair = pairForSlot(meal.id);
                    return (
                      <button
                        key={meal.id}
                        type="button"
                        onClick={() => onSelect(meal.id)}
                        className="rounded-card bg-health-bg px-3 py-3 text-left"
                      >
                        <span className="block text-[11px] font-semibold uppercase tracking-wide text-health-muted">
                          {mealTypeLabel(meal.mealType)}
                        </span>
                        {empty ? (
                          <span className="mt-1 block text-[13px] text-health-muted">Libre</span>
                        ) : (
                          <span className="mt-1 flex min-w-0 items-start gap-1.5">
                            {tag ? <RecipeTag recipeNo={tag} className="mt-0.5 shrink-0" /> : null}
                            <span className="min-w-0 text-[14px] font-semibold leading-snug text-health-ink">
                              {meal.baseName}
                            </span>
                          </span>
                        )}
                        <span className="mt-1 block text-[11px] leading-snug text-health-muted">
                          {pair ? (empty ? pair.label : `Écrase ${pair.label}`) : "1 repas frais"}
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
    </div>,
    document.body,
  );
}
