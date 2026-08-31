import { parseFoodTextLocal } from "@/lib/food-log";
import type { DetectedIngredient, DietType, MealType, PlannedMeal, ProfileId, Weekday } from "@/lib/types";
import type { DessertProduct, DessertSlot } from "@/lib/dessert-product";
import type { GenerateMealsMode } from "@/lib/gemini/meals";
import type { HouseholdCoachBias } from "@/lib/coach-apply";
import type { MealCoachHousehold } from "@/lib/meal-coach";
import type { CoachAnalysis, CoachAnalysisRequest } from "@/lib/gemini/coach-analysis";
import type { CoachTodayAdvice } from "@/lib/gemini/coach-today";
import type { CoachTodaySnapshot } from "@/lib/today-coach";
import type { SwapProposal } from "@/lib/swap-proposals";
import { withGeminiWait } from "@/lib/gemini/wait";

export type GenerateMealsResponse = {
  plan?: PlannedMeal[];
  dessert?: PlannedMeal;
  proposals?: Partial<Record<ProfileId, SwapProposal>>;
  suggestions?: string[];
  mock?: boolean;
  warning?: string;
  error?: string;
};

export async function requestGenerateMeals(body: {
  mode: GenerateMealsMode;
  theme?: string;
  plan?: PlannedMeal[];
  slotId?: string;
  ingredientId?: string;
  ingredientName?: string;
  replacement?: string;
  nonce?: number;
  coachBias?: HouseholdCoachBias;
  pastMeals?: string[];
  kitchenContext?: string;
  nutritionCoach?: MealCoachHousehold;
  mealType?: MealType;
  weekdays?: Weekday[];
  dessertSlot?: DessertSlot;
  dessertProduct?: DessertProduct | null;
  dessert?: PlannedMeal;
}): Promise<GenerateMealsResponse> {
  const dessertSwap =
    Boolean(body.dessert) ||
    body.slotId === "week-lunch-dessert" ||
    body.slotId === "week-dinner-dessert";
  const label =
    body.mode === "weekdays"
      ? "Gem Chef prépare Lun–Ven…"
      : body.mode === "weekend"
        ? "Gem Chef prépare le week-end…"
        : body.mode === "suggest-swap"
          ? dessertSwap
            ? "Gem Chef cherche 3 idées plus light…"
            : "Gem Chef cherche 3 idées…"
          : body.mode === "apply-swap"
            ? dessertSwap
              ? "Gem Chef allège le dessert…"
              : "Gem Chef réadapte la recette…"
            : body.mode === "today-swap"
              ? "Gem Chef propose un plat…"
              : body.mode === "dessert-batch"
                ? body.dessertSlot === "soir"
                  ? "Gem Chef prépare un dessert soir light…"
                  : "Gem Chef prépare un dessert midi…"
                : "Gem Chef prépare un repas…";
  return withGeminiWait(label, async () => {
    const response = await fetch("/api/generate-meals", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as GenerateMealsResponse;
    if (
      !response.ok &&
      !payload.plan &&
      !payload.proposals &&
      !payload.dessert &&
      !payload.suggestions
    ) {
      throw new Error(payload.error ?? "Génération impossible");
    }
    return payload;
  });
}

export type CoachAnalysisResponse = {
  analysis?: CoachAnalysis;
  mock?: boolean;
  warning?: string;
  error?: string;
};

export async function requestCoachAnalysis(
  body: CoachAnalysisRequest,
): Promise<CoachAnalysisResponse> {
  return withGeminiWait("Le coach analyse la semaine…", async () => {
    const response = await fetch("/api/coach-analysis", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as CoachAnalysisResponse;
    if (!response.ok && !payload.analysis) {
      throw new Error(payload.error ?? "Analyse coach impossible");
    }
    return payload;
  });
}

export async function requestCoachToday(snapshot: CoachTodaySnapshot) {
  return withGeminiWait("Le coach prépare 3 actions…", async () => {
    const response = await fetch("/api/coach-today", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snapshot }),
    });
    const payload = (await response.json()) as {
      advice?: CoachTodayAdvice;
      error?: string;
    };
    if (!payload.advice) {
      throw new Error(payload.error ?? "Conseil du moment impossible");
    }
    return payload.advice;
  });
}

export type CoachQuickAddResponse = {
  suggestions?: Array<{ mealId: string; kind: "carbs" | "protein" | "fat"; name: string; grams: number }>;
  warning?: string;
  error?: string;
};

export async function requestLogText(
  text: string,
  diet: DietType,
): Promise<DetectedIngredient[]> {
  const trimmed = text.trim();
  if (!trimmed) return [];
  return withGeminiWait("Gemini estime les kcal…", async () => {
    try {
      const response = await fetch("/api/log-text", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed, diet }),
      });
      const payload = (await response.json()) as { ingredients?: DetectedIngredient[] };
      if (Array.isArray(payload.ingredients) && payload.ingredients.length > 0) {
        return payload.ingredients;
      }
    } catch {
      /* parseur local ci-dessous */
    }
    return parseFoodTextLocal(trimmed);
  });
}

export async function requestCoachQuickAdd(body: {
  name: string;
  diet: "vegan" | "omnivore";
  aversions: string[];
  slots: Array<{
    mealId: string;
    mealName: string;
    mealType: MealType;
    items: string[];
    kind: "carbs" | "protein" | "fat";
    macroG: number;
    idealName: string;
    avoid: string[];
  }>;
}): Promise<CoachQuickAddResponse> {
  return withGeminiWait("Le coach cherche un ajout rapide…", async () => {
    const response = await fetch("/api/coach-quick-add", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as CoachQuickAddResponse;
    if (!response.ok && !payload.suggestions?.length) {
      throw new Error(payload.error ?? "Suggestion impossible");
    }
    return payload;
  });
}

export async function requestDessertProduct(file: File): Promise<DessertProduct> {
  return withGeminiWait("Gem Chef lit le paquet…", async () => {
    const form = new FormData();
    form.append("image", file);
    const response = await fetch("/api/dessert-product", {
      method: "POST",
      cache: "no-store",
      body: form,
    });
    const payload = (await response.json()) as { product?: DessertProduct; error?: string };
    if (!response.ok || !payload.product) {
      throw new Error(payload.error ?? "Produit illisible");
    }
    return payload.product;
  });
}
