"use client";

import { X } from "lucide-react";
import { pairForSlot, WEEK_DAYS } from "@/lib/weekly-plan";
import type { PlannedMeal } from "@/lib/types";
import { mealTypeLabel } from "@/lib/utils";

export function PickMealSlotSheet({
  plan,
  title = "Générer un repas",
  hint = "En semaine, la génération couvre les 2 créneaux du batch. Le week-end, un seul repas frais.",
  onClose,
  onSelect,
}: {
  plan: PlannedMeal[];
  title?: string;
  hint?: string;
  onClose: () => void;
  onSelect: (slotId: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
      <div className="max-h-[80vh] w-full max-w-[430px] overflow-y-auto rounded-t-[24px] bg-white p-4 pb-8 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[17px] font-semibold">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-full bg-health-bg p-1.5">
            <X size={16} />
          </button>
        </div>
        <p className="mb-3 text-[13px] leading-snug text-health-muted">{hint}</p>
        <div className="space-y-3">
          {WEEK_DAYS.map((day) => {
            const meals = plan.filter((meal) => meal.day === day);
            return (
              <div key={day}>
                <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-health-muted">
                  {day}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {meals.map((meal) => (
                    <button
                      key={meal.id}
                      type="button"
                      onClick={() => onSelect(meal.id)}
                      className="rounded-card bg-health-bg px-3 py-3 text-left"
                    >
                      <span className="block text-[13px] font-semibold">{mealTypeLabel(meal.mealType)}</span>
                      <span className="mt-0.5 line-clamp-2 block text-[11px] text-health-muted">
                        {pairForSlot(meal.id)?.label ?? "1 repas frais"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
