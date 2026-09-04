"use client";

import { useMemo, useState } from "react";
import { CakeSlice, History, Search, Utensils, X } from "lucide-react";
import { formatShortDate, formatWeekRange, isoWeekday } from "@/lib/dates";
import {
  groupHistoryByTitle,
  hideRejectedHistory,
  searchMealHistory,
  type HistoryKind,
  type MealHistoryItem,
} from "@/lib/meal-history";
import { isRejectedTitle, type RejectedRecipe } from "@/lib/rejected";
import { cn } from "@/lib/utils";

function versionWhen(item: MealHistoryItem) {
  if (!item.weekStart) return "Favori";
  if (isoWeekday(item.weekStart) === 1) return `sem. ${formatWeekRange(item.weekStart)}`;
  return formatShortDate(item.weekStart);
}

function versionMeta(item: MealHistoryItem) {
  const when = versionWhen(item);
  const theme = item.theme !== "Autre" ? `${item.theme} · ` : "";
  const soir = item.kind === "dessert" && item.dessertSlot === "soir" ? " · soir" : "";
  return `${theme}${when}${soir}`;
}

export function MealHistorySheet({
  items,
  rejected = [],
  loading,
  busy,
  initialKind = "plat",
  title = "Historique",
  caption = "Un titre peut avoir plusieurs semaines. Tape la version que tu veux. Le cœur (Favoris) reste à part.",
  onClose,
  onPick,
}: {
  items: MealHistoryItem[];
  rejected?: RejectedRecipe[];
  loading?: boolean;
  busy?: boolean;
  initialKind?: HistoryKind;
  title?: string;
  caption?: string;
  onClose: () => void;
  onPick: (item: MealHistoryItem) => void;
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<HistoryKind>(initialKind);
  const visible = useMemo(() => hideRejectedHistory(items, rejected), [items, rejected]);
  const groups = useMemo(() => {
    const pool = visible.filter((item) => item.kind === kind);
    return groupHistoryByTitle(searchMealHistory(pool, query));
  }, [visible, kind, query]);
  const bannedHere = items.some((item) => item.kind === kind && isRejectedTitle(rejected, item.title));

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/30">
      <div className="flex max-h-[82vh] w-full max-w-[430px] flex-col overflow-hidden rounded-t-[24px] bg-white shadow-card">
        <div className="shrink-0 px-4 pb-2 pt-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[17px] font-semibold">{title}</h3>
            <button type="button" onClick={onClose} className="rounded-full bg-health-bg p-1.5" aria-label="Fermer">
              <X size={16} />
            </button>
          </div>
          <p className="mb-3 text-[13px] leading-snug text-health-muted">{caption}</p>
          <div className="mb-2 grid grid-cols-2 gap-1 rounded-full bg-health-bg p-0.5">
            {(
              [
                { id: "plat" as const, label: "Plats", icon: Utensils },
                { id: "dessert" as const, label: "Desserts", icon: CakeSlice },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setKind(tab.id)}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-full py-1.5 text-[12px] font-semibold",
                  kind === tab.id ? "bg-white text-health-ink shadow-sm dark:bg-health-card" : "text-health-muted",
                )}
              >
                <tab.icon size={13} />
                {tab.label}
              </button>
            ))}
          </div>
          <label className="relative block">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-health-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un titre, un thème, un ingrédient…"
              className="w-full rounded-card bg-health-bg py-2.5 pl-9 pr-3 text-[14px] outline-none"
            />
          </label>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(16px,var(--safe-bottom))]">
          {loading ? (
            <p className="py-6 text-center text-[13px] text-health-muted">Chargement de l’historique…</p>
          ) : groups.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-health-muted">
              {query.trim()
                ? `Rien pour « ${query.trim()} ».`
                : bannedHere
                  ? kind === "dessert"
                    ? "Les desserts bannis sont dans Plus jamais."
                    : "Les plats bannis sont dans Plus jamais."
                  : kind === "dessert"
                    ? "Pas encore de dessert en historique."
                    : "Pas encore de plat en historique."}
            </p>
          ) : (
            <div className="grid gap-1.5 pb-4">
              {groups.map((group) =>
                group.items.length === 1 ? (
                  <HistoryRow
                    key={group.items[0].id}
                    item={group.items[0]}
                    busy={busy}
                    onPick={onPick}
                  />
                ) : (
                  <div key={group.key} className="rounded-card bg-health-bg px-3 py-2.5">
                    <p className="text-[14px] font-semibold leading-snug">{group.title}</p>
                    <p className="mt-0.5 text-[11px] text-health-muted">
                      {group.items.length} versions · la plus récente en haut
                    </p>
                    <div className="mt-2 grid gap-1">
                      {group.items.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          disabled={busy}
                          onClick={() => onPick(item)}
                          className="rounded-xl bg-white px-2.5 py-2 text-left text-[12px] font-medium leading-snug disabled:opacity-50 dark:bg-health-card"
                        >
                          {versionMeta(item)}
                        </button>
                      ))}
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HistoryRow({
  item,
  busy,
  onPick,
}: {
  item: MealHistoryItem;
  busy?: boolean;
  onPick: (item: MealHistoryItem) => void;
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => onPick(item)}
      className="flex items-start gap-2.5 rounded-card bg-health-bg px-3 py-3 text-left disabled:opacity-50"
    >
      <History size={16} className="mt-0.5 shrink-0 text-health-muted" />
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold leading-snug">{item.title}</span>
        <span className="mt-0.5 block text-[12px] text-health-muted">{versionMeta(item)}</span>
      </span>
    </button>
  );
}
