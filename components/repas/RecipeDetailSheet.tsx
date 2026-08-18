"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { RecipeTag } from "@/components/repas/RecipeTag";
import { MealPlanCard } from "@/components/repas/MealPlanCard";
import { QtyScaleToggle } from "@/components/repas/QtyScaleToggle";
import type { QtyMode } from "@/lib/qty-scale";
import type { PlannedMeal, ViewMode } from "@/lib/types";

export function RecipeDetailSheet({
  meal,
  planTag,
  view,
  busy,
  qtyMode,
  onQtyMode,
  currentTheme,
  onClose,
  onRegenerate,
  onSwapIngredient,
  onDelete,
  onMove,
}: {
  meal: PlannedMeal;
  planTag?: string;
  view: ViewMode;
  busy?: boolean;
  qtyMode: QtyMode;
  onQtyMode: (mode: QtyMode) => void;
  currentTheme: string;
  onClose: () => void;
  onRegenerate: (theme: string) => void;
  onSwapIngredient: () => void;
  onDelete: () => void;
  onMove: () => void;
}) {
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenTheme, setRegenTheme] = useState(currentTheme);

  useEffect(() => {
    setRegenOpen(false);
    setRegenTheme(currentTheme.trim() || meal.theme || "");
  }, [meal.id, currentTheme, meal.theme]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
      <div className="flex max-h-[88vh] w-full max-w-[430px] flex-col overflow-hidden rounded-t-[24px] bg-health-bg shadow-card">
        <div className="flex shrink-0 items-center justify-between bg-health-bg px-4 pb-2 pt-4">
          <h3 className="flex items-center gap-2 text-[17px] font-semibold">
            Recette
            {planTag ? <RecipeTag recipeNo={planTag} /> : null}
          </h3>
          <button type="button" onClick={onClose} className="rounded-full bg-white p-1.5 shadow-card">
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-10">
          <QtyScaleToggle mode={qtyMode} onChange={onQtyMode} />
          <div className="mt-3">
            <MealPlanCard
              key={`${meal.batchId}-${qtyMode}`}
              meal={meal}
              planTag={planTag}
              view={view}
              busy={busy}
              qtyMode={qtyMode}
              defaultOpen
              onRegenerate={() => setRegenOpen(true)}
              onSwapIngredient={onSwapIngredient}
              onDelete={onDelete}
              onMove={onMove}
            />
          </div>

          {regenOpen && (
            <div className="mt-3 rounded-card bg-white p-3 shadow-card">
              <p className="text-[13px] font-semibold">Régénérer ce plat</p>
              <p className="mt-1 text-[12px] leading-snug text-health-muted">
                Tu peux imposer un thème pour cette recette seulement (ex. Français, Tomate, Bowl).
              </p>
              <input
                value={regenTheme}
                onChange={(e) => setRegenTheme(e.target.value)}
                placeholder="Thème (optionnel)"
                className="mt-2 w-full rounded-card bg-health-bg px-3 py-2.5 text-[14px] outline-none"
              />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRegenOpen(false)}
                  className="rounded-full bg-health-bg py-2.5 text-[13px] font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    onRegenerate(regenTheme.trim());
                    setRegenOpen(false);
                  }}
                  className="rounded-full bg-health-ink py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
                >
                  {busy ? "Génération…" : "Régénérer"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
