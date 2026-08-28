"use client";

import { Sparkles, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function GenerateControls({
  theme,
  onThemeChange,
  busy,
  canClear,
  onGenerateWeekdays,
  onGenerateWeekend,
  onGenerateSingle,
  onClearWeek,
  coachHint,
  suggestions = [],
  onShuffle,
}: {
  theme: string;
  onThemeChange: (value: string) => void;
  busy: boolean;
  canClear?: boolean;
  coachHint?: string;
  suggestions?: string[];
  onShuffle?: () => void;
  onGenerateWeekdays: () => void;
  onGenerateWeekend: () => void;
  onGenerateSingle: () => void;
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
      <input
        value={theme}
        onChange={(e) => onThemeChange(e.target.value)}
        placeholder="Ex. Coréen, thaï, tomate, bowl…"
        className="mt-1.5 w-full rounded-card bg-health-bg px-3 py-2.5 text-[14px] outline-none"
      />
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
        Générer un repas
      </button>
      <p className="mt-2 text-[11px] leading-relaxed text-health-muted">
        Semaine vide par défaut. Un thème (Coréen, Thaï…) s’applique à TOUS les plats.
        Stock on : Gem part de ce que vous avez. Lun–Ven : 2 déjeuners + 2 dîners low cal + Ven même base. Week-end : 4 repas. Compte 1 à 2 min pour Lun–Ven.
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
