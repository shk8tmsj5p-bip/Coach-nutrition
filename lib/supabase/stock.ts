import type { Json } from "@/lib/supabase/database.types";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  loadLocalStock,
  parseHouseholdStock,
  saveLocalStock,
  type HouseholdStock,
} from "@/lib/stock";

export async function loadStock(): Promise<HouseholdStock> {
  const local = loadLocalStock();
  const supabase = createBrowserSupabaseClient();
  if (!supabase) return local;

  const { data, error } = await supabase
    .from("parametres")
    .select("pantry_stock")
    .eq("id", "foyer")
    .maybeSingle();
  if (error || !data) return local;

  const remote = parseHouseholdStock((data as { pantry_stock?: Json }).pantry_stock);
  if (remote.items.length === 0 && local.items.length > 0) return local;

  const merged: HouseholdStock = {
    items: remote.items.length ? remote.items : local.items,
    useStock: remote.useStock,
    intensity: remote.intensity,
  };
  saveLocalStock(merged);
  return merged;
}

export async function persistStock(stock: HouseholdStock): Promise<string | null> {
  saveLocalStock(stock);
  const supabase = createBrowserSupabaseClient();
  if (!supabase) return null;

  const { error } = await supabase
    .from("parametres")
    .update({ pantry_stock: stock as unknown as Json })
    .eq("id", "foyer");
  if (!error) return null;
  return error.message.includes("pantry_stock") ? null : error.message;
}
