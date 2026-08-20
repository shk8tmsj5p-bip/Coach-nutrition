import { canFavoriteMeal, favoriteIdFromTitle, themeLabel } from "@/lib/favorites";
import { normalizeTitle } from "@/lib/recipe-diversity";
import type { PlannedMeal } from "@/lib/types";

export type RejectedRecipe = {
  id: string;
  title: string;
  theme: string;
  savedAt: string;
};

export function canRejectMeal(meal: PlannedMeal | null | undefined): meal is PlannedMeal {
  return canFavoriteMeal(meal);
}

export function isRejectedTitle(list: RejectedRecipe[], title: string) {
  const id = favoriteIdFromTitle(title);
  return list.some((item) => item.id === id);
}

export function rejectedTitles(list: RejectedRecipe[]) {
  return list.map((item) => item.title).filter(Boolean);
}

export function mergeAvoidTitles(pastMeals: string[], rejected: RejectedRecipe[]) {
  return [...new Set([...rejectedTitles(rejected), ...pastMeals.map((title) => title.trim()).filter(Boolean)])];
}

export function upsertRejected(list: RejectedRecipe[], meal: PlannedMeal, opts?: { title?: string; theme?: string }) {
  if (!canRejectMeal(meal)) return list;
  const title = (opts?.title ?? meal.baseName).trim() || meal.baseName;
  return upsertRejectedTitle(list, title, themeLabel(opts?.theme ?? meal.theme));
}

export function upsertRejectedTitle(list: RejectedRecipe[], title: string, theme = "Autre") {
  const clean = title.trim();
  if (!clean) return list;
  const id = favoriteIdFromTitle(clean);
  const next: RejectedRecipe = {
    id,
    title: clean,
    theme: themeLabel(theme),
    savedAt: new Date().toISOString(),
  };
  return [next, ...list.filter((item) => item.id !== id)];
}

export function removeRejected(list: RejectedRecipe[], id: string) {
  return list.filter((item) => item.id !== id);
}

export function patchRejected(
  list: RejectedRecipe[],
  id: string,
  patch: { title?: string; theme?: string },
) {
  const current = list.find((item) => item.id === id);
  if (!current) return list;
  const title = (patch.title ?? current.title).trim() || current.title;
  const theme = themeLabel(patch.theme ?? current.theme);
  const nextId = favoriteIdFromTitle(title);
  const next: RejectedRecipe = {
    id: nextId,
    title,
    theme,
    savedAt: new Date().toISOString(),
  };
  return [next, ...list.filter((item) => item.id !== id && item.id !== nextId)];
}

export function searchRejected(list: RejectedRecipe[], query: string) {
  const needle = normalizeTitle(query);
  if (!needle) return list;
  return list.filter((item) => normalizeTitle(`${item.title} ${item.theme}`).includes(needle));
}

export function groupRejectedByTheme(list: RejectedRecipe[]) {
  const groups = new Map<string, RejectedRecipe[]>();
  for (const item of list) {
    const key = themeLabel(item.theme);
    const rows = groups.get(key) ?? [];
    rows.push(item);
    groups.set(key, rows);
  }
  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "fr"))
    .map(([theme, items]) => ({
      theme,
      items: [...items].sort((a, b) => a.title.localeCompare(b.title, "fr")),
    }));
}
