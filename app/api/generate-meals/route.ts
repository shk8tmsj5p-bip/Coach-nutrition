import { NextResponse } from "next/server";
import {
  applySwapPrompt,
  callGeminiPro,
  extractRecipes,
  extractSuggestions,
  geminiToPlannedMeal,
  parseGeminiJson,
  singlePrompt,
  suggestSwapPrompt,
  weekendPrompt,
  weekdaysPrompt,
  type GenerateMealsMode,
} from "@/lib/gemini/meals";
import type { PlannedMeal } from "@/lib/types";
import type { HouseholdCoachBias } from "@/lib/coach-apply";
import { diversityProblems } from "@/lib/recipe-diversity";
import { themeMismatchProblems } from "@/lib/theme-kits";
import { suggestionsFitRecipe } from "@/lib/swap-coherence";
import { emptyWeekPlan, annotatePlan, pairForSlot, WEEKDAY_BATCHES, WEEKEND_INDEXES } from "@/lib/weekly-plan";
import { friendlyGeminiError } from "@/lib/gemini/models";

export const maxDuration = 120;

type Body = {
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
};

function applyRecipes(
  plan: PlannedMeal[],
  recipes: ReturnType<typeof extractRecipes>,
  theme: string,
  mode: GenerateMealsMode,
  slotId?: string,
) {
  if (mode === "weekdays") {
    let next = plan;
    WEEKDAY_BATCHES.forEach((pair, index) => {
      const json = recipes[index];
      if (!json) return;
      next = next.map((meal) =>
        pair.slotIds.includes(meal.id)
          ? {
              ...geminiToPlannedMeal(json, meal, theme),
              batchId: pair.key,
              coverLabel: pair.label,
              servingsPerPerson: 2 as const,
              lowCalorie: pair.lowCalorie || meal.mealType === "diner",
            }
          : meal,
      );
    });
    return annotatePlan(next);
  }

  if (mode === "weekend") {
    const weekendSlots = plan.filter((meal) => WEEKEND_INDEXES.includes(meal.dayIndex));
    return annotatePlan(
      plan.map((slot) => {
        const index = weekendSlots.findIndex((item) => item.id === slot.id);
        if (index < 0) return slot;
        const json = recipes[index];
        if (!json) return slot;
        return {
          ...geminiToPlannedMeal(json, slot, theme),
          servingsPerPerson: 1 as const,
          batchId: slot.id,
          coverLabel: "1 repas frais",
          lowCalorie: slot.mealType === "diner" || slot.lowCalorie,
        };
      }),
    );
  }

  const slot = plan.find((meal) => meal.id === slotId);
  if (!slot || !recipes[0]) return plan;
  const pair = pairForSlot(slot.id);
  const targets = pair?.slotIds ?? [slot.id];
  return annotatePlan(
    plan.map((meal) => {
      if (!targets.includes(meal.id)) return meal;
      return {
        ...geminiToPlannedMeal(recipes[0], meal, theme),
        servingsPerPerson: pair ? 2 : 1,
        batchId: pair?.key ?? meal.id,
        coverLabel: pair?.label ?? "1 repas frais",
        lowCalorie: pair ? pair.lowCalorie || meal.mealType === "diner" : meal.lowCalorie,
      };
    }),
  );
}

export async function POST(request: Request) {
  const body = (await request.json()) as Body;
  const theme = body.theme ?? "";
  const plan = body.plan && body.plan.length > 0 ? body.plan : emptyWeekPlan();

  try {
    if (body.mode === "suggest-swap") {
      const name = body.ingredientName ?? "";
      const meal = plan.find((item) => item.id === body.slotId) ?? plan[0];
      const { text, warning } = await callGeminiPro(suggestSwapPrompt(meal, name, body.kitchenContext));
      const suggestions = extractSuggestions(parseGeminiJson(text));
      if (suggestions.length >= 3 && suggestionsFitRecipe(name, suggestions, meal)) {
        return NextResponse.json({ suggestions: suggestions.slice(0, 3), mock: false, warning });
      }
      return NextResponse.json(
        { error: friendlyGeminiError("Réponse Gemini incomplète"), mock: false },
        { status: 502 },
      );
    }

    if (body.mode === "apply-swap") {
      const slot = plan.find((item) => item.id === body.slotId);
      if (!slot || !body.ingredientName || !body.replacement) {
        return NextResponse.json({ error: "Swap incomplet" }, { status: 400 });
      }
      const { text, warning } = await callGeminiPro(
        applySwapPrompt(slot, body.ingredientName, body.replacement, body.pastMeals, body.kitchenContext),
      );
      const recipes = extractRecipes(parseGeminiJson(text));
      if (!recipes[0]) {
        return NextResponse.json(
          { error: friendlyGeminiError("Réponse Gemini incomplète"), mock: false },
          { status: 502 },
        );
      }
      return NextResponse.json({
        plan: applyRecipes(plan, recipes, theme, "single", body.slotId),
        mock: false,
        warning,
      });
    }

    const pastMeals = body.pastMeals ?? [];
    const kitchenContext = body.kitchenContext;
    const prompt =
      body.mode === "weekdays"
        ? weekdaysPrompt(theme, body.coachBias, pastMeals, kitchenContext)
        : body.mode === "weekend"
          ? weekendPrompt(theme, body.coachBias, pastMeals, kitchenContext)
          : singlePrompt(
              plan.find((item) => item.id === body.slotId) ?? plan[0],
              pairForSlot(body.slotId ?? ""),
              theme,
              body.coachBias,
              pastMeals,
              kitchenContext,
            );

    try {
      const first = await callGeminiPro(prompt);
      let used = first;
      let recipes = extractRecipes(parseGeminiJson(first.text));
      if (recipes.length === 0) throw new Error("JSON sans recette");
      const titles = recipes.map((item) => String(item.title ?? ""));
      let problems = [
        ...diversityProblems(titles, pastMeals),
        ...themeMismatchProblems(titles, theme),
      ];
      if (problems.length > 0 && (body.mode === "weekdays" || body.mode === "weekend")) {
        console.warn("[MEAL GEN] retry — thème/diversité:", problems.slice(0, 5).join(" | "));
        const retry = await callGeminiPro(
          `${prompt}

CORRECTION OBLIGATOIRE — ta proposition violait le thème et/ou la diversité :
${problems.slice(0, 10).join("\n")}
Réécris TOUTES les recettes. Titres 100 % du thème « ${theme || "libre"} », familles différentes, aucun plat d'une autre cuisine.`,
        );
        const retryRecipes = extractRecipes(parseGeminiJson(retry.text));
        const retryTitles = retryRecipes.map((item) => String(item.title ?? ""));
        const retryProblems = [
          ...diversityProblems(retryTitles, pastMeals),
          ...themeMismatchProblems(retryTitles, theme),
        ];
        if (
          retryRecipes.length >= recipes.length &&
          retryProblems.length <= problems.length
        ) {
          recipes = retryRecipes;
          problems = retryProblems;
          used = retry;
        }
      }
      if (theme.trim() && themeMismatchProblems(recipes.map((item) => String(item.title ?? "")), theme).length > 0) {
        throw new Error("Thème non respecté par Gemini");
      }
      console.log(
        "[MEAL GEN] using",
        used.tier,
        used.model,
        body.mode,
        recipes.map((item) => item.title).join(" · "),
      );
      return NextResponse.json({
        plan: applyRecipes(plan, recipes, theme, body.mode, body.slotId),
        mock: false,
        model: used.model,
        warning: used.warning,
      });
    } catch (error) {
      const raw = error instanceof Error ? error.message : "Gemini indisponible";
      console.error("[MEAL GEN] no mock fallback —", raw);
      return NextResponse.json({ error: friendlyGeminiError(raw), mock: false }, { status: 502 });
    }
  } catch (error) {
    const raw = error instanceof Error ? error.message : "Erreur génération";
    return NextResponse.json({ error: friendlyGeminiError(raw) }, { status: 500 });
  }
}
