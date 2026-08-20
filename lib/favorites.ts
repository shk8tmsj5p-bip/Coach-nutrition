import { normalizeTitle } from "@/lib/recipe-diversity";
import { isEmptyMeal } from "@/lib/weekly-plan";
import type { PlannedMeal } from "@/lib/types";

export type FavoriteRecipe = {
  id: string;
  title: string;
  theme: string;
  savedAt: string;
  recipe: PlannedMeal;
};

export function favoriteIdFromTitle(title: string) {
  const slug = normalizeTitle(title).replace(/\s+/g, "-").slice(0, 80);
  return slug || `fav-${Date.now()}`;
}

export function themeLabel(value: string | null | undefined) {
  const t = value?.trim();
  if (!t || /^base$/i.test(t)) return "Autre";
  return t;
}

export function snapshotFavoriteRecipe(meal: PlannedMeal): PlannedMeal {
  return {
    ...structuredClone(meal),
    id: "favorite",
    day: "Fav",
    dayIndex: 0,
    batchId: "favorite",
    coverLabel: "Favori",
    servingsPerPerson: 1,
  };
}

export function canFavoriteMeal(meal: PlannedMeal | null | undefined): meal is PlannedMeal {
  return Boolean(meal && !isEmptyMeal(meal) && meal.ingredients.length > 0);
}

export function isFavoriteTitle(list: FavoriteRecipe[], title: string) {
  const id = favoriteIdFromTitle(title);
  return list.some((item) => item.id === id);
}

export function upsertFavorite(list: FavoriteRecipe[], meal: PlannedMeal, opts?: { title?: string; theme?: string }) {
  if (!canFavoriteMeal(meal)) return list;
  const title = (opts?.title ?? meal.baseName).trim() || meal.baseName;
  const theme = themeLabel(opts?.theme ?? meal.theme);
  const id = favoriteIdFromTitle(title);
  const next: FavoriteRecipe = {
    id,
    title,
    theme,
    savedAt: new Date().toISOString(),
    recipe: snapshotFavoriteRecipe({ ...meal, baseName: title, theme }),
  };
  return [next, ...list.filter((item) => item.id !== id)];
}

export function removeFavorite(list: FavoriteRecipe[], id: string) {
  return list.filter((item) => item.id !== id);
}

export function patchFavorite(
  list: FavoriteRecipe[],
  id: string,
  patch: { title?: string; theme?: string },
) {
  const current = list.find((item) => item.id === id);
  if (!current) return list;
  const title = (patch.title ?? current.title).trim() || current.title;
  const theme = themeLabel(patch.theme ?? current.theme);
  const nextId = favoriteIdFromTitle(title);
  const next: FavoriteRecipe = {
    ...current,
    id: nextId,
    title,
    theme,
    recipe: { ...current.recipe, baseName: title, theme },
    savedAt: new Date().toISOString(),
  };
  return [next, ...list.filter((item) => item.id !== id && item.id !== nextId)];
}

function haystack(item: FavoriteRecipe) {
  const ings = item.recipe.ingredients.map((ing) => ing.name).join(" ");
  return normalizeTitle(`${item.title} ${item.theme} ${item.recipe.sharedBase} ${ings}`);
}

export function searchFavorites(list: FavoriteRecipe[], query: string) {
  const needle = normalizeTitle(query);
  if (!needle) return list;
  return list.filter((item) => haystack(item).includes(needle));
}

export function groupFavoritesByTheme(list: FavoriteRecipe[]) {
  const groups = new Map<string, FavoriteRecipe[]>();
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
