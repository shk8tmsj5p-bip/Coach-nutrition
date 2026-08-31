"use client";

import { X } from "lucide-react";
import { WEEK_DAYS, isEmptyMeal } from "@/lib/weekly-plan";
import type { PlannedMeal } from "@/lib/types";
import { mealTypeLabel } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function MoveMealSheet({
  meal,
  plan,
  title = "Déplacer",
  caption = "Choisis le jour et le créneau. Le contenu du créneau cible est échangé instantanément.",
  hideEmpty = false,
  onClose,
  onConfirm,
}: {
  meal: PlannedMeal;
  plan: PlannedMeal[];
  title?: string;
  caption?: string;
  hideEmpty?: boolean;
  onClose: () => void;
  onConfirm: (target: { dayIndex: number; mealType: "dejeuner" | "diner" }) => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/30">
      <div className="max-h-[calc(100dvh-var(--safe-top)-12px)] w-full max-w-[430px] overflow-y-auto rounded-t-[24px] bg-white p-4 pb-8 shadow-card">
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
        <p className="mb-3 text-[13px] leading-snug text-health-muted">{caption}</p>
        <div className="space-y-3">
          {WEEK_DAYS.map((day, dayIndex) => {
            const slots = plan.filter((item) => {
              if (item.dayIndex !== dayIndex) return false;
              if (item.id === meal.id) return true;
              if (hideEmpty && isEmptyMeal(item)) return false;
              return true;
            });
            if (slots.length === 0) return null;
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
