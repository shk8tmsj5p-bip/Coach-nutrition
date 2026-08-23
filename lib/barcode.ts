import type { Macros } from "@/lib/types";

export type BarcodeProduct = {
  barcode: string;
  name: string;
  brand: string;
  servingG: number;
  packG: number;
  per100: Macros;
};

export function normalizeBarcode(raw: string) {
  return raw.replace(/\D/g, "");
}

export function isPlausibleBarcode(code: string) {
  return /^\d{8,14}$/.test(code);
}

function num(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function gramsFromServing(size: unknown, quantity: unknown) {
  const fromQty = num(quantity);
  if (fromQty >= 1 && fromQty <= 2000) return Math.round(fromQty);
  const text = String(size ?? "");
  const hit = text.replace(",", ".").match(/(\d+(?:\.\d+)?)\s*(g|ml)\b/i);
  if (hit) return Math.max(1, Math.round(Number(hit[1])));
  return 100;
}

export function macrosAtGrams(per100: Macros, grams: number): Macros {
  const r = Math.max(0, grams) / 100;
  return {
    calories: Math.max(0, Math.round(per100.calories * r)),
    protein: Math.max(0, Math.round(per100.protein * r)),
    carbs: Math.max(0, Math.round(per100.carbs * r)),
    fat: Math.max(0, Math.round(per100.fat * r)),
  };
}

/** Grammes (étiquette OFF) et kcal saisis restent indépendants. P / G / L suivent les grammes. */
export function macrosAtGramsWithCalories(per100: Macros, grams: number, calories: number): Macros {
  const base = macrosAtGrams(per100, grams);
  return { ...base, calories: Math.max(0, Math.round(calories)) };
}

export function parseOffProduct(raw: unknown, barcode: string): BarcodeProduct | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  if (Number(rec.status) !== 1 || !rec.product || typeof rec.product !== "object") return null;
  const product = rec.product as Record<string, unknown>;
  const nutri = (product.nutriments && typeof product.nutriments === "object"
    ? product.nutriments
    : {}) as Record<string, unknown>;
  const kcal100 =
    num(nutri["energy-kcal_100g"]) ||
    (num(nutri.energy_100g) > 0 ? Math.round(num(nutri.energy_100g) / 4.184) : 0);
  const name =
    String(product.product_name_fr || product.product_name || product.generic_name_fr || product.generic_name || "")
      .trim() || `Produit ${barcode}`;
  const brand = String(product.brands || "").split(",")[0]?.trim() ?? "";
  const servingG = gramsFromServing(product.serving_size, product.serving_quantity);
  const packG = Math.max(servingG, Math.round(num(product.product_quantity)) || servingG * 4);
  return {
    barcode,
    name,
    brand,
    servingG,
    packG,
    per100: {
      calories: kcal100,
      protein: num(nutri.proteins_100g),
      carbs: num(nutri.carbohydrates_100g),
      fat: num(nutri.fat_100g),
    },
  };
}

export async function lookupBarcode(code: string): Promise<{ product?: BarcodeProduct; error?: string }> {
  const barcode = normalizeBarcode(code);
  if (!isPlausibleBarcode(barcode)) return { error: "Code-barres invalide." };
  const res = await fetch(`/api/barcode?code=${encodeURIComponent(barcode)}`);
  const data = (await res.json().catch(() => null)) as { product?: BarcodeProduct; error?: string } | null;
  if (!res.ok) return { error: data?.error ?? "Open Food Facts indisponible." };
  if (!data?.product) return { error: data?.error ?? "Produit introuvable." };
  return { product: data.product };
}
