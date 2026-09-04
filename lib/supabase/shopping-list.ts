import type { ShoppingListItem } from "@/lib/types";
import type { Json } from "@/lib/supabase/database.types";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { storage } from "@/lib/storage";

export type WeekShopping = {
  checked: string[];
  custom: ShoppingListItem[];
};

export function shopCheckedKey(weekStart: string) {
  return `shop-checked:${weekStart}`;
}

export function shopCustomKey(weekStart: string) {
  return `shop-custom:${weekStart}`;
}

function shopSyncedKey(weekStart: string) {
  return `shop-foyer:${weekStart}`;
}

function localShopping(weekStart: string): WeekShopping {
  return {
    checked: storage.getJSON<string[]>(shopCheckedKey(weekStart), []),
    custom: storage.getJSON<ShoppingListItem[]>(shopCustomKey(weekStart), []),
  };
}

function saveLocalShopping(weekStart: string, shopping: WeekShopping) {
  storage.setJSON(shopCheckedKey(weekStart), shopping.checked);
  storage.setJSON(shopCustomKey(weekStart), shopping.custom);
}

export function clearLocalShopping(weekStart: string) {
  storage.remove(shopCheckedKey(weekStart));
  storage.remove(shopCustomKey(weekStart));
  storage.remove(shopSyncedKey(weekStart));
}

function parseChecked(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((item): item is string => typeof item === "string" && item.length > 0))];
}

function parseCustom(raw: unknown): ShoppingListItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is ShoppingListItem => {
    if (!item || typeof item !== "object") return false;
    const row = item as ShoppingListItem;
    return typeof row.id === "string" && typeof row.name === "string";
  });
}

function isEmptyShopping(shopping: WeekShopping) {
  return shopping.checked.length === 0 && shopping.custom.length === 0;
}

export async function loadWeekShopping(weekStart: string): Promise<WeekShopping> {
  const local = localShopping(weekStart);
  const supabase = createBrowserSupabaseClient();
  if (!supabase) return local;
  const { data, error } = await supabase
    .from("plans_semaine")
    .select("shopping_checked, shopping_custom")
    .eq("week_start", weekStart)
    .maybeSingle();
  if (error || !data) return local;
  const row = data as { shopping_checked?: unknown; shopping_custom?: unknown };
  const remote: WeekShopping = {
    checked: row.shopping_checked == null ? local.checked : parseChecked(row.shopping_checked),
    custom: row.shopping_custom == null ? local.custom : parseCustom(row.shopping_custom),
  };
  const alreadySynced = storage.get(shopSyncedKey(weekStart)) === "1";
  if (!alreadySynced && isEmptyShopping(remote) && !isEmptyShopping(local)) {
    storage.set(shopSyncedKey(weekStart), "1");
    await persistWeekShopping(weekStart, local);
    return local;
  }
  storage.set(shopSyncedKey(weekStart), "1");
  saveLocalShopping(weekStart, remote);
  return remote;
}

export async function persistWeekShopping(
  weekStart: string,
  shopping: WeekShopping,
): Promise<string | null> {
  saveLocalShopping(weekStart, shopping);
  storage.set(shopSyncedKey(weekStart), "1");
  const supabase = createBrowserSupabaseClient();
  if (!supabase) return null;
  const payload = {
    shopping_checked: shopping.checked as unknown as Json,
    shopping_custom: shopping.custom as unknown as Json,
  };
  const { data, error } = await supabase
    .from("plans_semaine")
    .update(payload)
    .eq("week_start", weekStart)
    .select("week_start")
    .maybeSingle();
  if (error) {
    return error.message.includes("shopping_checked")
      ? "Colonne shopping_checked absente : lance supabase/migrations/add_shopping_list.sql dans Supabase."
      : error.message;
  }
  if (data) return null;
  const { error: insertError } = await supabase.from("plans_semaine").insert({
    week_start: weekStart,
    ...payload,
  });
  if (!insertError) return null;
  return insertError.message.includes("shopping_checked")
    ? "Colonne shopping_checked absente : lance supabase/migrations/add_shopping_list.sql dans Supabase."
    : insertError.message;
}
