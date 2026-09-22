"use client";

import { Camera, History, Images, Sparkles, X } from "lucide-react";
import { ImagePickButton } from "@/components/today/ImagePickButton";
import { cn } from "@/lib/utils";
import type { RecipeFit } from "@/lib/recipe-photo";

export function GenerateControls({
  theme,
  onThemeChange,
  busy,
  onGenerateWeekdays,
  onGenerateWeekend,
  onGenerateSingle,
  onHistory,
  recipePreview,
  recipeFit,
  onRecipeFitChange,
  onPickRecipePhoto,
  onClearRecipePhoto,
}: {
  theme: string;
  onThemeChange: (value: string) => void;
  busy: boolean;
  recipePreview?: string | null;
  recipeFit: RecipeFit;
  onRecipeFitChange: (fit: RecipeFit) => void;
  onPickRecipePhoto: (file: File) => void;
  onClearRecipePhoto: () => void;
  onGenerateWeekdays: () => void;
  onGenerateWeekend: () => void;
  onGenerateSingle: () => void;
  onHistory: () => void;
}) {
  return (
    <div>
      <label className="text-[11px] font-semibold uppercase tracking-wide text-health-muted">
        Thème (optionnel)
      </label>
      <div className="relative mt-1.5">
        <input
          value={theme}
          onChange={(e) => onThemeChange(e.target.value)}
          placeholder="Ex. Coréen, thaï, tomate, bowl…"
          className="w-full rounded-card bg-health-bg px-3 py-2.5 pr-10 text-[14px] outline-none"
        />
        {theme.trim() ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onThemeChange("")}
            className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-health-muted disabled:opacity-40"
            aria-label="Effacer le thème"
          >
            <X size={16} />
          </button>
        ) : null}
      </div>

      <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-health-muted">
        Photo d’une recette
      </label>
      <div className="mt-1.5 grid grid-cols-2 gap-2">
        <ImagePickButton
          icon={Camera}
          label="Appareil"
          capture
          compact
          disabled={busy}
          onPick={onPickRecipePhoto}
        />
        <ImagePickButton
          icon={Images}
          label="Photothèque"
          compact
          disabled={busy}
          onPick={onPickRecipePhoto}
        />
      </div>
      {recipePreview ? (
        <div className="mt-2 flex items-center gap-2 rounded-2xl bg-health-bg p-2">
          {/* blob preview — not a remote URL */}
          <img
            src={recipePreview}
            alt="Recette photographiée"
            className="h-14 w-14 shrink-0 rounded-xl object-cover"
          />
          <p className="min-w-0 flex-1 text-[12px] font-semibold leading-snug">Recette photo · à reprendre</p>
          <button
            type="button"
            disabled={busy}
            onClick={onClearRecipePhoto}
            className="shrink-0 p-1 text-health-muted disabled:opacity-40"
            aria-label="Retirer la photo"
          >
            <X size={16} />
          </button>
        </div>
      ) : null}
      <div className="mt-2 grid grid-cols-2 gap-1 rounded-full bg-health-bg p-0.5">
        {(
          [
            { id: "as-is" as const, label: "Tel quel" },
            { id: "adapt" as const, label: "Réadapter" },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={busy || !recipePreview}
            onClick={() => onRecipeFitChange(item.id)}
            className={cn(
              "rounded-full py-1.5 text-[12px] font-semibold disabled:opacity-40",
              recipePreview && recipeFit === item.id
                ? "bg-white text-health-ink shadow-sm dark:bg-health-card"
                : "text-health-muted",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <GenButton disabled={busy} onClick={onGenerateWeekdays}>
          {busy ? "Génération…" : "Générer Lun–Ven"}
        </GenButton>
        <GenButton disabled={busy} onClick={onGenerateWeekend}>
          Week-end
        </GenButton>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={onGenerateSingle}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-card bg-health-ink py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
      >
        <Sparkles size={14} />
        {recipePreview ? "Mettre cette recette" : "Générer un repas"}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onHistory}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-card bg-health-bg py-2.5 text-[13px] font-semibold disabled:opacity-50"
      >
        <History size={14} />
        Historique des plats
      </button>
    </div>
  );
}

function GenButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-card bg-health-bg py-2.5 text-[13px] font-semibold disabled:opacity-50"
    >
      {children}
    </button>
  );
}
