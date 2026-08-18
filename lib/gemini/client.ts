import type { PlannedMeal } from "@/lib/types";
import type { GenerateMealsMode } from "@/lib/gemini/meals";
import type { HouseholdCoachBias } from "@/lib/coach-apply";
import type { CoachAnalysis, CoachAnalysisRequest } from "@/lib/gemini/coach-analysis";

export type GenerateMealsResponse = {
  plan?: PlannedMeal[];
  suggestions?: string[];
  mock?: boolean;
  warning?: string;
  error?: string;
};

export async function requestGenerateMeals(body: {
  mode: GenerateMealsMode;
  theme?: string;
  plan: PlannedMeal[];
  slotId?: string;
  ingredientId?: string;
  ingredientName?: string;
  replacement?: string;
  nonce?: number;
  coachBias?: HouseholdCoachBias;
  pastMeals?: string[];
  kitchenContext?: string;
}): Promise<GenerateMealsResponse> {
  const response = await fetch("/api/generate-meals", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as GenerateMealsResponse;
  if (!response.ok && !payload.plan) {
    throw new Error(payload.error ?? "Génération impossible");
  }
  return payload;
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
}
