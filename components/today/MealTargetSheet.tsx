"use client";

import { X } from "lucide-react";
import { MEAL_TYPE_OPTIONS } from "@/lib/meal-items";
import type { MealType } from "@/lib/types";

export function MealTargetSheet({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (type: MealType) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
      <div className="w-full max-w-[430px] rounded-t-[24px] bg-white p-4 pb-8 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[17px] font-semibold">Saisie rapide</h3>
          <button type="button" onClick={onClose} className="rounded-full bg-health-bg p-1.5">
            <X size={16} />
          </button>
        </div>
        <p className="mb-4 text-[15px] leading-snug">
          À quel repas souhaitez-vous ajouter cet aliment&nbsp;?
        </p>
        <div className="grid gap-2">
          {MEAL_TYPE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelect(option.id)}
              className="rounded-card bg-health-bg py-3.5 text-[15px] font-semibold"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
