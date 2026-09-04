"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { ingredientsForView, pairForSlot } from "@/lib/weekly-plan";
import { isWeekLunchDessert } from "@/lib/week-dessert";
import type { PlannedMeal, ViewMode } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SwapIngredientSheet({
  meal,
  view,
  busy,
  onClose,
  onSuggest,
  onPick,
}: {
  meal: PlannedMeal;
  view: ViewMode;
  busy: boolean;
  onClose: () => void;
  onSuggest: (ingredientId: string, ingredientName: string) => Promise<string[]>;
  onPick: (ingredientId: string, replacement: string) => Promise<void>;
}) {
  const options = useMemo(() => ingredientsForView(meal.ingredients, view), [meal.ingredients, view]);
  const [selectedId, setSelectedId] = useState(options[0]?.id ?? "");
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const selected = options.find((item) => item.id === selectedId);
  const dessert = isWeekLunchDessert(meal);
  const pair = dessert ? null : pairForSlot(meal.id);

  async function loadAlts(id: string, name: string) {
    setLoading(true);
    setSuggestions(null);
    try {
      const next = await onSuggest(id, name);
      setSuggestions(next);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/30">
      <div className="w-full max-w-[430px] rounded-t-[24px] bg-white p-4 pb-8 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[17px] font-semibold">Échanger un ingrédient</h3>
          <button type="button" onClick={onClose} className="rounded-full bg-health-bg p-1.5">
            <X size={16} />
          </button>
        </div>
        <p className="mb-3 text-[13px] leading-snug text-health-muted">
          {meal.baseName}
          {dessert
            ? " · 3 idées, les plus light d'abord (ex. sirop → érythritol)."
            : pair
              ? ` · le batch ${pair.label} sera réadapté.`
              : ""}
        </p>

        <p className="mb-1.5 text-[12px] font-medium text-health-muted">Ingrédient à retirer</p>
        <div className="mb-3 max-h-[28vh] space-y-1.5 overflow-y-auto">
          {options.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setSelectedId(item.id);
                void loadAlts(item.id, item.name);
              }}
              className={cn(
                "w-full rounded-card px-3 py-2.5 text-left text-[14px]",
                selectedId === item.id ? "bg-health-ink text-white" : "bg-health-bg",
              )}
            >
              {item.name}
              {item.role !== "shared" && (
                <span className="ml-1 text-[11px] opacity-70">
                  {item.role === "alexis" ? "Alexis" : "Élodie"}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading && (
          <p className="rounded-card bg-health-bg py-3 text-center text-[14px] text-health-muted">
            {dessert ? "3 alternatives plus light…" : "3 alternatives cohérentes…"}
          </p>
        )}

        {!suggestions && !loading && (
          <button
            type="button"
            disabled={!selected || busy}
            onClick={() => selected && void loadAlts(selected.id, selected.name)}
            className="w-full rounded-card bg-health-ink py-3 text-[15px] font-semibold text-white disabled:opacity-50"
          >
            Proposer 3 alternatives
          </button>
        )}

        {suggestions && (
          <>
            <p className="mb-2 text-[12px] font-medium text-health-muted">
              Remplacer « {selected?.name} » par
            </p>
            <div className="grid gap-2">
              {suggestions.map((alt, index) => (
                <button
                  key={`${index}-${alt}`}
                  type="button"
                  disabled={busy}
                  onClick={() => void onPick(selectedId, alt)}
                  className="rounded-card bg-health-bg py-3 text-[15px] font-semibold disabled:opacity-50"
                >
                  {alt}
                </button>
              ))}
            </div>
            {suggestions.length < 3 ? (
              <p className="mt-2 text-center text-[12px] text-health-muted">
                Moins de 3 idées — retape l’ingrédient pour relancer.
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
