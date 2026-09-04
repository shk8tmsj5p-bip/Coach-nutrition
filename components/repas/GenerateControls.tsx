"use client";

import { Camera, History, Images, Sparkles, Trash2, X } from "lucide-react";
import { ImagePickButton } from "@/components/today/ImagePickButton";
import { cn } from "@/lib/utils";
import type { RecipeFit } from "@/lib/recipe-photo";

export function GenerateControls({
  theme,
  onThemeChange,
  busy,
  canClear,
  onGenerateWeekdays,
  onGenerateWeekend,
  onGenerateSingle,
  onHistory,
  onClearWeek,
  coachHint,
  suggestions = [],
  onShuffle,
  recipePreview,
  recipeFit,
  onRecipeFitChange,
  onPickRecipePhoto,
  onClearRecipePhoto,
}: {
  theme: string;
  onThemeChange: (value: string) => void;
  busy: boolean;
  canClear?: boolean;
  coachHint?: string;
  suggestions?: string[];
  onShuffle?: () => void;
  recipePreview?: string | null;
  recipeFit: RecipeFit;
  onRecipeFitChange: (fit: RecipeFit) => void;
  onPickRecipePhoto: (file: File) => void;
  onClearRecipePhoto: () => void;
  onGenerateWeekdays: () => void;
  onGenerateWeekend: () => void;
  onGenerateSingle: () => void;
  onHistory: () => void;
  onClearWeek: () => void;
}) {
  return (
    <div className="mt-4 rounded-card bg-white p-3 shadow-card">
      <button
        type="button"
        disabled={busy || !canClear}
        onClick={onClearWeek}
        className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-card bg-red-50 py-2.5 text-[13px] font-semibold text-red-600 disabled:opacity-40"
      >
        <Trash2 size={14} />
        Vider la semaine
      </button>
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
      {suggestions.length > 0 ? (
        <div className="mt-2">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-[11px] text-health-muted">Pistes du moment · vos critères</p>
            {onShuffle ? (
              <button
                type="button"
                disabled={busy}
                onClick={onShuffle}
                className="text-[11px] font-semibold text-health-ink disabled:opacity-40"
              >
                Autres pistes
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((item) => (
              <button
                key={item}
                type="button"
                disabled={busy}
                onClick={() => onThemeChange(theme === item ? "" : item)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                  theme === item ? "bg-health-ink text-white" : "bg-health-bg text-health-muted",
                )}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-health-muted">
        Photo d’une recette
      </label>
      <p className="mt-0.5 text-[11px] leading-snug text-health-muted">
        Livre, écran ou plat. Même recette pour vous deux. Ensuite : tel quel, ou réadaptée à vos objectifs.
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
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
      <p className="mt-1 text-[11px] leading-snug text-health-muted">
        {recipePreview
          ? recipeFit === "as-is"
            ? "Fidèle à la photo. Alexis reste vegan sur la protéine si besoin."
            : "On garde le plat, on cale portions, dîner light, aversions, batch."
          : "Choix actif une fois la photo ajoutée. Sans photo, Gem suit le thème et vos cibles."}
      </p>

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
        Historique plats & desserts
      </button>
      <p className="mt-2 text-[11px] leading-relaxed text-health-muted">
        Semaine vide par défaut. Un thème (Coréen, Thaï…) s’applique à TOUS les plats.
        Photo : un repas (ou le couple batch semaine). Stock on : Gem part de ce que vous avez. Lun–Ven : 2
        déjeuners + 2 dîners low cal + Ven même base. Week-end : 4 repas. Compte 1 à 2 min pour Lun–Ven.
        {coachHint ? ` ${coachHint}` : ""}
      </p>
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
      className={cn(
        "rounded-card bg-health-bg py-2.5 text-[13px] font-semibold disabled:opacity-50",
      )}
    >
      {children}
    </button>
  );
}
