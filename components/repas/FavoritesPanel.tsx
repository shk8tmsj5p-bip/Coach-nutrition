"use client";

import { useEffect, useMemo, useState } from "react";
import { Heart, Search, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { MealPlanCard } from "@/components/repas/MealPlanCard";
import type { FavoriteRecipe } from "@/lib/favorites";
import { groupFavoritesByTheme, searchFavorites, themeLabel } from "@/lib/favorites";
import type { ViewMode } from "@/lib/types";

export function FavoritesPanel({
  list,
  view,
  onOpen,
}: {
  list: FavoriteRecipe[];
  view: ViewMode;
  onOpen: (item: FavoriteRecipe) => void;
}) {
  const [query, setQuery] = useState("");
  const groups = useMemo(
    () => groupFavoritesByTheme(searchFavorites(list, query)),
    [list, query],
  );

  if (list.length === 0) {
    return (
      <Card className="mt-3">
        <p className="text-[14px] font-semibold">Aucun favori pour l’instant</p>
        <p className="mt-1 text-[13px] leading-relaxed text-health-muted">
          Sur Aujourd’hui, le cœur d’un déjeuner ou dîner (plat de la semaine) le garde ici.
        </p>
      </Card>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      <label className="relative block">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-health-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un plat, un thème, un ingrédient…"
          className="w-full rounded-card bg-white py-2.5 pl-9 pr-3 text-[14px] shadow-card outline-none"
        />
      </label>
      {groups.length === 0 ? (
        <p className="px-0.5 text-[13px] text-health-muted">Aucun favori pour « {query} ».</p>
      ) : (
        groups.map((group) => (
          <div key={group.theme}>
            <p className="mb-1.5 px-0.5 text-[12px] font-semibold uppercase tracking-wide text-health-muted">
              {group.theme}
            </p>
            <div className="space-y-1.5">
              {group.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onOpen(item)}
                  className="flex w-full items-start gap-2 rounded-card bg-white px-3 py-3 text-left shadow-card"
                >
                  <Heart size={14} className="mt-0.5 shrink-0 text-coral-dark" fill="currentColor" />
                  <span className="min-w-0">
                    <span className="block text-[14px] font-semibold leading-snug">{item.title}</span>
                    <span className="mt-0.5 block text-[12px] text-health-muted">
                      {item.recipe.mealType === "diner" ? "Dîner" : "Déjeuner"}
                      {item.recipe.lowCalorie ? " · low cal" : ""}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export function FavoriteRecipeSheet({
  item,
  view,
  busy,
  onClose,
  onPlace,
  onRemove,
  onSaveMeta,
}: {
  item: FavoriteRecipe;
  view: ViewMode;
  busy?: boolean;
  onClose: () => void;
  onPlace: () => void;
  onRemove: () => void;
  onSaveMeta: (patch: { title: string; theme: string }) => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [theme, setTheme] = useState(item.theme === "Autre" ? "" : item.theme);

  useEffect(() => {
    setTitle(item.title);
    setTheme(item.theme === "Autre" ? "" : item.theme);
  }, [item.id, item.title, item.theme]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
      <div className="flex max-h-[88vh] w-full max-w-[430px] flex-col overflow-hidden rounded-t-[24px] bg-health-bg shadow-card">
        <div className="flex shrink-0 items-center justify-between bg-health-bg px-4 pb-2 pt-4">
          <h3 className="text-[17px] font-semibold">Favori</h3>
          <button type="button" onClick={onClose} className="rounded-full bg-white p-1.5 shadow-card">
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-10">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-health-muted">Titre</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-card bg-white px-3 py-2.5 text-[14px] outline-none"
          />
          <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wide text-health-muted">
            Thème
          </label>
          <input
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="Ex. Italien, Bowl, Asiatique…"
            className="mt-1 w-full rounded-card bg-white px-3 py-2.5 text-[14px] outline-none"
          />
          <button
            type="button"
            onClick={() => onSaveMeta({ title: title.trim() || item.title, theme: themeLabel(theme) })}
            className="mt-2 text-[12px] font-semibold"
          >
            Enregistrer titre / thème
          </button>

          <div className="mt-3">
            <MealPlanCard meal={{ ...item.recipe, baseName: title || item.title, theme: themeLabel(theme) }} view={view} defaultOpen />
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={onPlace}
            className="mt-3 flex w-full items-center justify-center rounded-card bg-health-ink py-3 text-[15px] font-semibold text-white disabled:opacity-50"
          >
            Mettre dans la semaine
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onRemove}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-card bg-red-50 py-2.5 text-[13px] font-semibold text-red-600 disabled:opacity-50"
          >
            <Heart size={14} />
            Retirer des favoris
          </button>
        </div>
      </div>
    </div>
  );
}
