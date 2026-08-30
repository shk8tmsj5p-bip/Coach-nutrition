import { parseGeminiJson } from "@/lib/gemini/meals";
import { generateGeminiFlash } from "@/lib/gemini/flash";
import { applyTrustedNutrition, clampGrams } from "@/lib/food-log";
import { estimateIngredientMacros } from "@/lib/recipe-macros";
import type { PlannedMeal, RecipeIngredient } from "@/lib/types";

export type DessertSlot = "midi" | "soir";

export type DessertProduct = {
  name: string;
  brand?: string;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  typicalGrams: number;
  roleHint?: string;
  labelRead?: boolean;
};

const KONJAC_RE = /konjac|shirataki/i;

export function isDessertSlot(value: unknown): value is DessertSlot {
  return value === "midi" || value === "soir";
}

export function parseDessertProduct(raw: unknown): DessertProduct | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const name = String(rec.name ?? rec.nom ?? rec.product ?? "").trim();
  if (!name || name.length < 2) return null;
  const kcal = num(rec.kcalPer100g ?? rec.kcal_per_100g ?? rec.calories_per_100g);
  const protein = num(rec.proteinPer100g ?? rec.protein_per_100g);
  const carbs = num(rec.carbsPer100g ?? rec.carbs_per_100g);
  const fat = num(rec.fatPer100g ?? rec.fat_per_100g);
  const grams = num(rec.typicalGrams ?? rec.typical_grams ?? rec.grams) || 150;
  const brand = String(rec.brand ?? rec.marque ?? "").trim();
  const roleHint = String(rec.roleHint ?? rec.role ?? rec.substitute_for ?? "").trim();
  const labelRead = rec.labelRead === true || rec.label_read === true;
  const trusted = applyTrustedNutrition({
    id: "dessert-product",
    name,
    grams,
    calories: kcal > 0 ? Math.round((kcal * grams) / 100) : 0,
    protein: protein > 0 ? Math.round((protein * grams) / 100) : 0,
    carbs: carbs > 0 ? Math.round((carbs * grams) / 100) : 0,
    fat: fat > 0 ? Math.round((fat * grams) / 100) : 0,
  });
  const per100FromTrusted = trusted.grams > 0 ? (trusted.calories * 100) / trusted.grams : 0;
  const useLabel = labelRead && kcal >= 0 && kcal <= 900;
  let kcal100 = useLabel ? kcal : per100FromTrusted;
  if (KONJAC_RE.test(name) && (!kcal100 || kcal100 > 40)) kcal100 = kcal > 0 && kcal <= 40 ? kcal : 8;
  if (!kcal100 && KONJAC_RE.test(name)) kcal100 = 8;
  const p100 = useLabel ? protein : trusted.grams > 0 ? (trusted.protein * 100) / trusted.grams : protein;
  const c100 = useLabel ? carbs : trusted.grams > 0 ? ((trusted.carbs ?? 0) * 100) / trusted.grams : carbs;
  const f100 = useLabel ? fat : trusted.grams > 0 ? ((trusted.fat ?? 0) * 100) / trusted.grams : fat;
  return {
    name: trusted.name || name,
    brand: brand || undefined,
    kcalPer100g: round1(Math.max(0, kcal100)),
    proteinPer100g: round1(Math.max(0, p100)),
    carbsPer100g: round1(Math.max(0, c100)),
    fatPer100g: round1(Math.max(0, f100)),
    typicalGrams: clampGrams(grams || trusted.grams || 150),
    roleHint: roleHint || (KONJAC_RE.test(name) ? "remplace le riz / les pâtes" : undefined),
    labelRead: useLabel,
  };
}

export function productMatchesName(name: string, product: DessertProduct) {
  const a = fold(name);
  const b = fold(product.name);
  if (!a || !b) return false;
  if (a.includes(b) || b.includes(a)) return true;
  const token = b.split(/\s+/).find((part) => part.length >= 5) ?? b.split(/\s+/).find((part) => part.length >= 4);
  return Boolean(token && a.includes(token));
}

export function macrosFromDessertProduct(product: DessertProduct, grams: number) {
  const g = Math.max(0, grams);
  return {
    calories: Math.round((product.kcalPer100g * g) / 100),
    protein: Math.round((product.proteinPer100g * g) / 100),
    carbs: Math.round((product.carbsPer100g * g) / 100),
    fat: Math.round((product.fatPer100g * g) / 100),
  };
}

export function dessertIngredientMacros(name: string, grams: number, product?: DessertProduct | null) {
  if (product && productMatchesName(name, product)) return macrosFromDessertProduct(product, grams);
  return estimateIngredientMacros(name, grams);
}

export function isBulkLightDessertIng(name: string, product?: DessertProduct | null) {
  if (/konjac|shirataki|\beau\b/i.test(name)) return true;
  if (product && productMatchesName(name, product) && product.kcalPer100g < 25) return true;
  return false;
}

export function ensureDessertProductInMeal(meal: PlannedMeal, product?: DessertProduct | null): PlannedMeal {
  if (!product) return meal;
  if (meal.ingredients.some((ing) => productMatchesName(ing.name, product))) return meal;
  const grams = product.typicalGrams || 120;
  const added: RecipeIngredient = {
    id: `product-${fold(product.name).replace(/\s+/g, "-") || "star"}`,
    name: product.name,
    role: "shared",
    gramsAlexis: grams,
    gramsElodie: grams,
    visualQuantity: `${Math.round(grams / 50) || 1} portion`,
    notes: product.roleHint,
  };
  return { ...meal, ingredients: [added, ...meal.ingredients] };
}

export function formatDessertProductForPrompt(product?: DessertProduct | null) {
  if (!product) return "";
  const brand = product.brand ? ` (${product.brand})` : "";
  const portion = macrosFromDessertProduct(product, product.typicalGrams);
  const role = product.roleHint || "ingrédient star du dessert";
  return `PRODUIT FOYER (photo d'emballage — OBLIGATOIRE)
Nom : ${product.name}${brand}
Densité : ${product.kcalPer100g} kcal / 100 g (P ${product.proteinPer100g} · G ${product.carbsPer100g} · L ${product.fatPer100g})${product.labelRead ? " — lue sur l'étiquette, ne pas inventer d'autres kcal" : ""}
Portion typique : ${product.typicalGrams} g ≈ ${portion.calories} kcal
Rôle : ${role}.
Ce produit EST l'ingrédient star. Si le thème est un dessert classique (riz au lait, pudding, crème, tiramisu…), SUBSTITUE l'ingrédient lourd (riz, biscuits, mascarpone…) par CE produit — n'ajoute pas le classique EN PLUS.
grams_alexis / grams_elodie calculés avec CES kcal/100 g pour tenir la cible.
INTERDIT d'ignorer le produit, INTERDIT d'en mettre une pincée cosmétique.`;
}

const PRODUCT_PROMPT = `Tu lis une PHOTO d'emballage / paquet alimentaire (pas une assiette).
Identifie LE produit principal (ex. riz konjac, shirataki, tofu soyeux, skyr).
Lis l'étiquette si elle est visible : kcal / 100 g, protéines, glucides, lipides.
Sinon estime via un produit générique du même type (konjac ≈ 8 kcal/100 g, tofu soyeux ≈ 55).
Noms en français. typical_grams = une portion dessert (80–180 g).
role = comment l'utiliser en dessert (ex. « remplace le riz », « base crémeuse »).

JSON strict :
{
  "name": "Riz konjac",
  "brand": "",
  "kcal_per_100g": 8,
  "protein_per_100g": 0.2,
  "carbs_per_100g": 1,
  "fat_per_100g": 0,
  "typical_grams": 150,
  "label_read": true,
  "role": "remplace le riz"
}`;

export async function analyzeDessertProductPhoto(imageBase64: string, mimeType: string): Promise<DessertProduct> {
  const raw = await generateGeminiFlash({
    parts: [{ text: PRODUCT_PROMPT }, { inlineData: { mimeType: mimeType || "image/jpeg", data: imageBase64 } }],
    temperature: 0.15,
  });
  const parsed = parseDessertProduct(parseGeminiJson(raw));
  if (!parsed) throw new Error("Produit illisible sur la photo.");
  return parsed;
}

function num(value: unknown) {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function fold(value: string) {
  return value
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}
