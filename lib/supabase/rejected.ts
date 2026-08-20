import type { Json } from "@/lib/supabase/database.types";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { storage } from "@/lib/storage";
import type { RejectedRecipe } from "@/lib/rejected";

const STORAGE_KEY = "rejected-recipes";

function isRejected(value: unknown): value is RejectedRecipe {
  if (!value || typeof value !== "object") return false;
  const rec = value as RejectedRecipe;
  return typeof rec.id === "string" && typeof rec.title === "string" && rec.title.trim().length > 0;
}

function parseList(value: unknown): RejectedRecipe[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRejected).map((item) => ({
    ...item,
    theme: item.theme?.trim() || "Autre",
    savedAt: item.savedAt || "",
  }));
}

export function loadLocalRejected(): RejectedRecipe[] {
  return parseList(storage.getJSON<RejectedRecipe[]>(STORAGE_KEY, []));
}

function saveLocalRejected(list: RejectedRecipe[]) {
  storage.setJSON(STORAGE_KEY, list);
}

export async function loadRejected(): Promise<RejectedRecipe[]> {
  const local = loadLocalRejected();
  const supabase = createBrowserSupabaseClient();
  if (!supabase) return local;

  const { data, error } = await supabase
    .from("parametres")
    .select("rejected_recipes")
    .eq("id", "foyer")
    .maybeSingle();
  if (error || !data) return local;

  const remote = parseList((data as { rejected_recipes?: Json }).rejected_recipes);
  if (remote.length === 0) return local;

  const byId = new Map<string, RejectedRecipe>();
  for (const item of [...local, ...remote]) {
    const current = byId.get(item.id);
    if (!current || item.savedAt > current.savedAt) byId.set(item.id, item);
  }
  const merged = [...byId.values()].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  saveLocalRejected(merged);
  return merged;
}

export async function persistRejected(list: RejectedRecipe[]): Promise<string | null> {
  saveLocalRejected(list);
  const supabase = createBrowserSupabaseClient();
  if (!supabase) return null;

  const { error } = await supabase
    .from("parametres")
    .update({ rejected_recipes: list as unknown as Json })
    .eq("id", "foyer");
  if (!error) return null;
  return error.message.includes("rejected_recipes") ? null : error.message;
}
