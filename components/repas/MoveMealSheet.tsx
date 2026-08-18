"use client";

import { X } from "lucide-react";
import { WEEK_DAYS } from "@/lib/weekly-plan";
import type { PlannedMeal } from "@/lib/types";
import { mealTypeLabel } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function MoveMealSheet({
  meal,
  plan,
  onClose,
  onConfirm,
}: {
  meal: PlannedMeal;
  plan: PlannedMeal[];
  onClose: () => void;
  onConfirm: (target: { dayIndex: number; mealType: "dejeuner" | "diner" }) => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/30">
      <div className="max-h-[80vh] w-full max-w-[430px] overflow-y-auto rounded-t-[24px] bg-white p-4 pb-8 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[17px] font-semibold">Déplacer</h3>
          <button type="button" onClick={onClose} className="rounded-full bg-health-bg p-1.5">
            <X size={16} />
          </button>
        </div>
        <p className="mb-3 text-[13px] leading-snug text-health-muted">
          Choisis le jour et le créneau. Le contenu du créneau cible est échangé instantanément.
        </p>
        <div className="space-y-3">
          {WEEK_DAYS.map((day, dayIndex) => {
            const slots = plan.filter((item) => item.dayIndex === dayIndex);
            return (
              <div key={day}>
                <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-health-muted">
                  {day}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {slots.map((slot) => {
                    const current = slot.id === meal.id;
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        disabled={current}
                        onClick={() => onConfirm({ dayIndex: slot.dayIndex, mealType: slot.mealType })}
                        className={cn(
                          "rounded-card px-3 py-3 text-left",
                          current ? "bg-health-ink text-white" : "bg-health-bg",
                        )}
                      >
                        <span className="block text-[13px] font-semibold">
                          {mealTypeLabel(slot.mealType)}
                        </span>
                        <span
                          className={cn(
                            "mt-0.5 line-clamp-2 block text-[11px]",
                            current ? "text-white/80" : "text-health-muted",
                          )}
                        >
                          {current ? "Créneau actuel" : slot.baseName}
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
