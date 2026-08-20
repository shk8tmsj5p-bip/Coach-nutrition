import type { MealType, PlannedMeal, ProfileId } from "@/lib/types";
import type { GenerateMealsMode } from "@/lib/gemini/meals";
import type { HouseholdCoachBias } from "@/lib/coach-apply";
import type { MealCoachHousehold } from "@/lib/meal-coach";
import type { CoachAnalysis, CoachAnalysisRequest } from "@/lib/gemini/coach-analysis";
import type { SwapProposal } from "@/lib/swap-proposals";
import { withGeminiWait } from "@/lib/gemini/wait";

export type GenerateMealsResponse = {
  plan?: PlannedMeal[];
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
}): Promise<GenerateMealsResponse> {
  const label =
    body.mode === "weekdays"
      ? "Gem Chef prépare Lun–Ven…"
      : body.mode === "weekend"
        ? "Gem Chef prépare le week-end…"
        : body.mode === "suggest-swap"
          ? "Gem Chef cherche 3 idées…"
          : body.mode === "apply-swap"
            ? "Gem Chef réadapte la recette…"
            : body.mode === "today-swap"
              ? "Gem Chef propose un plat…"
              : "Gem Chef prépare un repas…";
  return withGeminiWait(label, async () => {
    const response = await fetch("/api/generate-meals", {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as GenerateMealsResponse;
    if (!response.ok && !payload.plan && !payload.proposals) {
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

export type CoachQuickAddResponse = {
  suggestions?: Array<{ mealId: string; kind: "carbs" | "protein" | "fat"; name: string; grams: number }>;
  warning?: string;
  error?: string;
};

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
