"use client";

import { Sparkles, Trash2 } from "lucide-react";
import { RecipeTag } from "@/components/repas/RecipeTag";
import { WEEKDAYS, toggleWeekday } from "@/lib/sport-routine";
import {
  DESSERT_THEME_PRESETS,
  formatDessertDays,
  type WeekLunchDessert,
} from "@/lib/week-dessert";
import type { PlannedMeal, Weekday } from "@/lib/types";
import { cn } from "@/lib/utils";

export function DessertBatchCard({
  dessert,
  draft,
  theme,
  weekdays,
  busy,
  warning,
  onThemeChange,
  onWeekdaysChange,
  onPropose,
  onConfirm,
  onDiscardDraft,
  onOpen,
  onRemove,
}: {
  dessert: WeekLunchDessert | null;
  draft: PlannedMeal | null;
  theme: string;
  weekdays: Weekday[];
  busy: boolean;
  warning?: string | null;
  onThemeChange: (value: string) => void;
  onWeekdaysChange: (days: Weekday[]) => void;
  onPropose: () => void;
  onConfirm: () => void;
  onDiscardDraft: () => void;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const shown = draft ?? dessert?.meal ?? null;
  const alexisKcal = shown?.alexis.calories ?? 0;
  const elodieKcal = shown?.elodie.calories ?? 0;

  return (
    <div className="mt-3 rounded-card bg-white p-3 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold">Dessert midi · cette semaine</p>
        <RecipeTag recipeNo="D" compact />
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-health-muted">
        Une fournée maison (clafoutis, fondant, tarte…) pour plusieurs déjeuners. Gemini Pro lit
        Paramètres + cibles dessert midi.
      </p>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {WEEKDAYS.map((day) => {
          const on = weekdays.includes(day.id);
          return (
            <button
              key={day.id}
              type="button"
              disabled={busy}
              onClick={() => onWeekdaysChange(toggleWeekday(weekdays, day.id))}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                on ? "bg-health-ink text-white" : "bg-health-bg text-health-muted",
              )}
            >
              {day.label}
            </button>
          );
        })}
      </div>

      <input
        value={theme}
        onChange={(e) => onThemeChange(e.target.value)}
        placeholder="Thème (optionnel) · Chocolat, fruits…"
        className="mt-2 w-full rounded-card bg-health-bg px-3 py-2.5 text-[14px] outline-none"
      />
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {DESSERT_THEME_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            disabled={busy}
            onClick={() => onThemeChange(preset)}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-semibold",
              theme === preset ? "bg-health-ink text-white" : "bg-health-bg text-health-muted",
            )}
          >
            {preset}
          </button>
        ))}
      </div>

      {shown ? (
        <button type="button" onClick={onOpen} className="mt-3 w-full rounded-2xl bg-health-bg px-3 py-2.5 text-left">
          <p className="text-[14px] font-semibold leading-snug">{shown.baseName}</p>
          <p className="mt-0.5 text-[12px] text-health-muted">
            {formatDessertDays(weekdays)} · Alexis {alexisKcal} kcal · Élodie {elodieKcal} kcal
          </p>
          {draft ? (
            <p className="mt-1 text-[11px] font-semibold text-coral">Proposition — à valider</p>
          ) : null}
        </button>
      ) : (
        <p className="mt-3 text-[13px] text-health-muted">Aucun dessert prévu cette semaine.</p>
      )}

      {warning ? <p className="mt-2 text-[12px] text-coral">{warning}</p> : null}

      {draft ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onDiscardDraft}
            className="rounded-card bg-health-bg py-2.5 text-[13px] font-semibold"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="rounded-card bg-health-ink py-2.5 text-[13px] font-semibold text-white"
          >
            Mettre dans la semaine
          </button>
        </div>
      ) : (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            disabled={busy || weekdays.length === 0}
            onClick={onPropose}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-card bg-health-ink py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
          >
            <Sparkles size={14} />
            {busy ? "Génération…" : dessert ? "Nouvelle proposition" : "Proposer un dessert"}
          </button>
          {dessert ? (
            <button
              type="button"
              disabled={busy}
              onClick={onRemove}
              className="rounded-card bg-red-50 px-3 py-2.5 text-red-600"
              aria-label="Retirer le dessert"
            >
              <Trash2 size={16} />
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
