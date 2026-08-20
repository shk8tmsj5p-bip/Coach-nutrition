import type { Json } from "@/lib/supabase/database.types";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { storage } from "@/lib/storage";
import { canFavoriteMeal, type FavoriteRecipe } from "@/lib/favorites";
import { isEmptyMeal } from "@/lib/weekly-plan";
import type { PlannedMeal } from "@/lib/types";

const STORAGE_KEY = "favorite-recipes";

function isFavorite(value: unknown): value is FavoriteRecipe {
  if (!value || typeof value !== "object") return false;
  const rec = value as FavoriteRecipe;
  return (
    typeof rec.id === "string" &&
    typeof rec.title === "string" &&
    rec.recipe != null &&
    Array.isArray(rec.recipe.ingredients) &&
    !isEmptyMeal(rec.recipe)
  );
}

function parseList(value: unknown): FavoriteRecipe[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isFavorite).filter((item) => canFavoriteMeal(item.recipe));
}

export function loadLocalFavorites(): FavoriteRecipe[] {
  return parseList(storage.getJSON<FavoriteRecipe[]>(STORAGE_KEY, []));
}

function saveLocalFavorites(list: FavoriteRecipe[]) {
  storage.setJSON(STORAGE_KEY, list);
}

export async function loadFavorites(): Promise<FavoriteRecipe[]> {
  const local = loadLocalFavorites();
  const supabase = createBrowserSupabaseClient();
  if (!supabase) return local;

  const { data, error } = await supabase
    .from("parametres")
    .select("favorite_recipes")
    .eq("id", "foyer")
    .maybeSingle();
  if (error || !data) return local;

  const remote = parseList((data as { favorite_recipes?: Json }).favorite_recipes);
  if (remote.length === 0) return local;

  const byId = new Map<string, FavoriteRecipe>();
  for (const item of [...local, ...remote]) {
    const current = byId.get(item.id);
    if (!current || item.savedAt > current.savedAt) byId.set(item.id, item);
  }
  const merged = [...byId.values()].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  saveLocalFavorites(merged);
  return merged;
}

export async function persistFavorites(list: FavoriteRecipe[]): Promise<string | null> {
  saveLocalFavorites(list);
  const supabase = createBrowserSupabaseClient();
  if (!supabase) return null;

  const { error } = await supabase
    .from("parametres")
    .update({ favorite_recipes: list as unknown as Json })
    .eq("id", "foyer");
  if (!error) return null;
  return error.message.includes("favorite_recipes") ? null : error.message;
}

export function recipeFromPlan(meal: PlannedMeal | null | undefined) {
  return canFavoriteMeal(meal) ? meal : null;
}
