"use client";

import { Camera, History, Images, Sparkles, Trash2, X } from "lucide-react";
import { RecipeTag } from "@/components/repas/RecipeTag";
import { ImagePickButton } from "@/components/today/ImagePickButton";
import { WEEKDAYS, toggleWeekday } from "@/lib/sport-routine";
import {
  DESSERT_SOIR_PRESETS,
  DESSERT_THEME_PRESETS,
  dessertTagOf,
  formatDessertDays,
  type WeekLunchDessert,
} from "@/lib/week-dessert";
import type { DessertProduct, DessertSlot } from "@/lib/dessert-product";
import type { PlannedMeal, Weekday } from "@/lib/types";
import { cn } from "@/lib/utils";

export function DessertBatchCard({
  slot,
  dessert,
  draft,
  theme,
  weekdays,
  product,
  review,
  busy,
  warning,
  onSlotChange,
  onThemeChange,
  onWeekdaysChange,
  onPickPhoto,
  onReviewChange,
  onKeepProduct,
  onClearProduct,
  onPropose,
  onConfirm,
  onDiscardDraft,
  onOpen,
  onRemove,
  onHistory,
}: {
  slot: DessertSlot;
  dessert: WeekLunchDessert | null;
  draft: PlannedMeal | null;
  theme: string;
  weekdays: Weekday[];
  product: DessertProduct | null;
  review: DessertProduct | null;
  busy: boolean;
  warning?: string | null;
  onSlotChange: (slot: DessertSlot) => void;
  onThemeChange: (value: string) => void;
  onWeekdaysChange: (days: Weekday[]) => void;
  onPickPhoto: (file: File) => void;
  onReviewChange: (next: DessertProduct) => void;
  onKeepProduct: () => void;
  onClearProduct: () => void;
  onPropose: () => void;
  onConfirm: () => void;
  onDiscardDraft: () => void;
  onOpen: () => void;
  onRemove: () => void;
  onHistory?: () => void;
}) {
  const shown = draft ?? dessert?.meal ?? null;
  const alexisKcal = shown?.alexis.calories ?? 0;
  const elodieKcal = shown?.elodie.calories ?? 0;
  const evening = slot === "soir";
  const presets = evening ? DESSERT_SOIR_PRESETS : DESSERT_THEME_PRESETS;
  const tag = dessertTagOf(slot);

  return (
    <div className="mt-3 rounded-card bg-white p-3 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold">{evening ? "Dessert soir · cette semaine" : "Dessert midi · cette semaine"}</p>
        <RecipeTag recipeNo={tag} compact />
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1 rounded-full bg-health-bg p-0.5">
        {(["midi", "soir"] as const).map((item) => (
          <button
            key={item}
            type="button"
            disabled={busy}
            onClick={() => onSlotChange(item)}
            className={cn(
              "rounded-full py-1.5 text-[12px] font-semibold",
              slot === item ? "bg-white text-health-ink shadow-sm dark:bg-health-card" : "text-health-muted",
            )}
          >
            {item === "midi" ? "Midi" : "Soir light"}
          </button>
        ))}
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-health-muted">
        {evening
          ? "Très faible calorie (~60 kcal) : tofu soyeux, konjac. Photo d’un paquet pour l’intégrer (ex. riz au lait au konjac)."
          : "Fournée maison pour plusieurs déjeuners. Photo d’un produit (konjac, tofu soyeux…) pour en faire la star."}
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
        placeholder={evening ? "Thème · Riz au lait, cacao, vanille…" : "Thème (optionnel) · Chocolat, fruits…"}
        className="mt-2 w-full rounded-card bg-health-bg px-3 py-2.5 text-[14px] outline-none"
      />
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {presets.map((preset) => (
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

      <div className="mt-2 grid grid-cols-2 gap-2">
        <ImagePickButton icon={Camera} label="Paquet" capture compact disabled={busy} onPick={onPickPhoto} />
        <ImagePickButton icon={Images} label="Photothèque" compact disabled={busy} onPick={onPickPhoto} />
      </div>

      {product ? (
        <div className="mt-2 flex items-start justify-between gap-2 rounded-2xl bg-health-bg px-3 py-2">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold leading-snug">{product.name}</p>
            <p className="text-[11px] text-health-muted">
              {product.kcalPer100g} kcal/100 g · portion {product.typicalGrams} g
              {product.roleHint ? ` · ${product.roleHint}` : ""}
            </p>
          </div>
          <button type="button" onClick={onClearProduct} className="shrink-0 p-1 text-health-muted" aria-label="Retirer le produit">
            <X size={16} />
          </button>
        </div>
      ) : null}

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
        <p className="mt-3 text-[13px] text-health-muted">
          {evening ? "Aucun dessert soir cette semaine." : "Aucun dessert prévu cette semaine."}
        </p>
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

      {onHistory ? (
        <button
          type="button"
          disabled={busy}
          onClick={onHistory}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-card bg-health-bg py-2.5 text-[13px] font-semibold disabled:opacity-50"
        >
          <History size={14} />
          Historique desserts
        </button>
      ) : null}

      {review ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-3xl bg-white p-4 shadow-xl dark:bg-health-card">
            <p className="text-[15px] font-semibold">Produit reconnu</p>
            <p className="mt-1 text-[12px] text-health-muted">Vérifie le nom et les kcal/100 g avant de générer.</p>
            <label className="mt-3 block text-[11px] font-semibold text-health-muted">Nom</label>
            <input
              value={review.name}
              onChange={(e) => onReviewChange({ ...review, name: e.target.value })}
              className="mt-1 w-full rounded-card bg-health-bg px-3 py-2.5 text-[14px] outline-none"
            />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[11px] font-semibold text-health-muted">kcal / 100 g</span>
                <input
                  inputMode="decimal"
                  value={String(review.kcalPer100g).replace(".", ",")}
                  onChange={(e) => {
                    const n = Number(e.target.value.replace(",", "."));
                    if (Number.isFinite(n) && n >= 0) onReviewChange({ ...review, kcalPer100g: n });
                  }}
                  className="mt-1 w-full rounded-card bg-health-bg px-3 py-2.5 text-[14px] outline-none"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold text-health-muted">Portion g</span>
                <input
                  inputMode="decimal"
                  value={String(review.typicalGrams).replace(".", ",")}
                  onChange={(e) => {
                    const n = Number(e.target.value.replace(",", "."));
                    if (Number.isFinite(n) && n > 0) onReviewChange({ ...review, typicalGrams: n });
                  }}
                  className="mt-1 w-full rounded-card bg-health-bg px-3 py-2.5 text-[14px] outline-none"
                />
              </label>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={onClearProduct} className="rounded-card bg-health-bg py-2.5 text-[13px] font-semibold">
                Annuler
              </button>
              <button
                type="button"
                onClick={onKeepProduct}
                className="rounded-card bg-health-ink py-2.5 text-[13px] font-semibold text-white"
              >
                Garder pour la recette
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
