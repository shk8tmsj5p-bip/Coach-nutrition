"use client";

import { Clock, X } from "lucide-react";
import { recentFoodLine, type RecentFood } from "@/lib/recent-foods";

export function RecentsSheet({
  foods,
  confirming,
  onClose,
  onPick,
}: {
  foods: RecentFood[];
  confirming: boolean;
  onClose: () => void;
  onPick: (food: RecentFood) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
      <div className="max-h-[78vh] w-full max-w-[430px] overflow-y-auto rounded-t-[24px] bg-white p-4 pb-8 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[17px] font-semibold">Récents</h3>
          <button type="button" onClick={onClose} className="rounded-full bg-health-bg p-1.5">
            <X size={16} />
          </button>
        </div>
        <p className="mb-3 text-[13px] leading-snug text-health-muted">
          Derniers aliments de ce profil, avec le grammage de la dernière fois.
        </p>
        {foods.length === 0 ? (
          <p className="text-[14px] text-health-muted">Rien encore dans les 14 derniers jours.</p>
        ) : (
          <div className="grid gap-1.5">
            {foods.map((food) => (
              <button
                key={food.key}
                type="button"
                disabled={confirming}
                onClick={() => onPick(food)}
                className="flex items-center gap-3 rounded-card bg-health-bg px-3 py-3 text-left disabled:opacity-50"
              >
                <Clock size={16} className="shrink-0 text-health-muted" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{food.name}</span>
                  <span className="mt-0.5 block truncate text-[12px] tabular-nums text-health-muted">
                    {recentFoodLine(food).replace(/^[^:]+:\s*/, "")} · {Math.round(food.calories)} kcal
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
