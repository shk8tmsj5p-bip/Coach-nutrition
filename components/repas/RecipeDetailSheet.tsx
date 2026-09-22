"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { RecipeTag } from "@/components/repas/RecipeTag";
import { MealPlanCard } from "@/components/repas/MealPlanCard";
import { FavoriteHeart } from "@/components/today/FavoriteHeart";
import { RejectMealButton } from "@/components/today/RejectMealButton";
import { qtyModeChoices, qtyModeShortLabel, type QtyMode } from "@/lib/qty-scale";
import type { PlannedMeal } from "@/lib/types";
import { isWeekLunchDessert } from "@/lib/week-dessert";
import { cn } from "@/lib/utils";

export function RecipeDetailSheet({
  meal,
  planTag,
  busy,
  qtyMode,
  onQtyMode,
  currentTheme,
  onClose,
  onRegenerate,
  onSwapIngredient,
  onDelete,
  onMove,
  favoriteOn,
  onToggleFavorite,
  rejectedOn,
  onToggleRejected,
}: {
  meal: PlannedMeal;
  planTag?: string;
  busy?: boolean;
  qtyMode: QtyMode;
  onQtyMode: (mode: QtyMode) => void;
  currentTheme: string;
  onClose: () => void;
  onRegenerate: (theme: string) => void;
  onSwapIngredient?: () => void;
  onDelete?: () => void;
  onMove?: () => void;
  favoriteOn?: boolean;
  onToggleFavorite?: () => void;
  rejectedOn?: boolean;
  onToggleRejected?: () => void;
}) {
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenTheme, setRegenTheme] = useState(currentTheme);
  const [qtyPickOpen, setQtyPickOpen] = useState(false);
  const qtyChoices = qtyModeChoices(meal);

  useEffect(() => {
    setRegenOpen(false);
    setQtyPickOpen(false);
    setRegenTheme(currentTheme.trim() || meal.theme || "");
  }, [meal.id, currentTheme, meal.theme]);

  useEffect(() => {
    onQtyMode("batch");
  }, [meal.id, onQtyMode]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
      <div className="flex max-h-[88vh] w-full max-w-[430px] flex-col overflow-hidden rounded-t-[24px] bg-health-bg shadow-card">
        <div className="flex shrink-0 items-center justify-between bg-health-bg px-4 pb-2 pt-4">
          <h3 className="flex min-w-0 items-center gap-2 text-[17px] font-semibold">
            Recette
            {planTag ? <RecipeTag recipeNo={planTag} onClick={() => setQtyPickOpen(true)} /> : null}
            <button
              type="button"
              onClick={() => setQtyPickOpen(true)}
              className="truncate rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-health-muted shadow-card"
            >
              {qtyModeShortLabel(meal, qtyMode)}
            </button>
          </h3>
          <div className="flex items-center gap-2">
            {onToggleFavorite ? (
              <FavoriteHeart
                on={Boolean(favoriteOn)}
                onClick={onToggleFavorite}
                className={favoriteOn ? "shadow-card" : "bg-white shadow-card"}
              />
            ) : null}
            {onToggleRejected ? (
              <RejectMealButton
                on={Boolean(rejectedOn)}
                onClick={onToggleRejected}
                className={rejectedOn ? "shadow-card" : "bg-white shadow-card"}
              />
            ) : null}
            <button type="button" onClick={onClose} className="rounded-full bg-white p-1.5 shadow-card">
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-10">
          <div className="mt-1">
            <MealPlanCard
              key={`${meal.batchId}-${qtyMode}`}
              meal={meal}
              planTag={planTag}
              busy={busy}
              qtyMode={qtyMode}
              defaultOpen
              onRegenerate={() => setRegenOpen(true)}
              onSwapIngredient={onSwapIngredient}
              onDelete={onDelete}
              onMove={onMove}
              onPlanTagClick={() => setQtyPickOpen(true)}
            />
          </div>

          {regenOpen && (
            <div className="mt-3 rounded-card bg-white p-3 shadow-card">
              <p className="text-[13px] font-semibold">
                {isWeekLunchDessert(meal) ? "Régénérer ce dessert" : "Régénérer ce plat"}
              </p>
              <p className="mt-1 text-[12px] leading-snug text-health-muted">
                {isWeekLunchDessert(meal)
                  ? "Tu peux imposer un thème pour ce dessert seulement (ex. Chocolat, Fruits, Tofu soyeux)."
                  : "Tu peux imposer un thème pour cette recette seulement (ex. Français, Tomate, Bowl)."}
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

      {qtyPickOpen ? (
        <div
          className="absolute inset-0 z-[60] flex items-end justify-center bg-black/40"
          onClick={() => setQtyPickOpen(false)}
        >
          <div
            className="w-full max-w-[430px] rounded-t-[24px] bg-health-bg px-4 pb-[max(16px,var(--safe-bottom))] pt-4 shadow-card"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-[15px] font-semibold">
              Quantités{planTag ? ` · ${planTag.replace(/^\[|\]$/g, "")}` : ""}
            </p>
            <p className="mt-1 text-[12px] leading-snug text-health-muted">
              {qtyChoices.length > 1
                ? "Choisis une assiette, ou tout ce qu’il faut cuisiner."
                : "Plat frais : une assiette / pers."}
            </p>
            <div className="mt-3 space-y-2">
              {qtyChoices.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => {
                    onQtyMode(row.id);
                    setQtyPickOpen(false);
                  }}
                  className={cn(
                    "w-full rounded-card px-3 py-3 text-left shadow-card",
                    qtyMode === row.id ? "bg-health-ink text-white" : "bg-white",
                  )}
                >
                  <span className="block text-[15px] font-semibold">{row.label}</span>
                  <span
                    className={cn(
                      "mt-0.5 block text-[12px] leading-snug",
                      qtyMode === row.id ? "text-white/80" : "text-health-muted",
                    )}
                  >
                    {row.detail}
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setQtyPickOpen(false)}
              className="mt-3 w-full rounded-full bg-white py-2.5 text-[13px] font-semibold shadow-card"
            >
              Fermer
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
