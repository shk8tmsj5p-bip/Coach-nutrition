import { NextResponse } from "next/server";
import {
  applySwapPrompt,
  callGeminiPro,
  callGeminiDessert,
  extractRecipes,
  extractSuggestions,
  geminiToPlannedMeal,
  parseGeminiJson,
  dessertBatchPrompt,
  dessertSuggestSwapPrompt,
  dessertApplySwapPrompt,
  recipeFromPhotoPrompt,
  singlePrompt,
  suggestSwapPrompt,
  todaySwapPrompt,
  weekendPrompt,
  weekdaysPrompt,
  type GenerateMealsMode,
} from "@/lib/gemini/meals";
import type { MealType, PlannedMeal, Weekday } from "@/lib/types";
import type { HouseholdCoachBias } from "@/lib/coach-apply";
import { parseMealCoach, scalePlanToGoals, type MealCoachHousehold } from "@/lib/meal-coach";
import {
  dummyDessertSlot,
  dessertSlotOf,
  dessertWeekdaysOf,
  isWeekLunchDessert,
  LUNCH_DESSERT_ID,
  DINNER_DESSERT_ID,
  scaleDessertToGoals,
  stampDessertMeal,
} from "@/lib/week-dessert";
import { ensureDessertProductInMeal, isDessertSlot, parseDessertProduct, type DessertSlot } from "@/lib/dessert-product";
import { diversityProblems } from "@/lib/recipe-diversity";
import { themeMismatchProblems } from "@/lib/theme-kits";
import { mockSuggestDessertSwap, mockSuggestSwap, suggestionsFitRecipe } from "@/lib/swap-coherence";
import { swapProposalsFromPlanned } from "@/lib/swap-proposals";
import {
  emptyWeekPlan,
  annotatePlan,
  dummyTodaySwapSlot,
  pairForSlot,
  WEEKDAY_BATCHES,
  WEEKEND_INDEXES,
} from "@/lib/weekly-plan";
import { parseRecipePhoto, isRecipeFit, type RecipeFit } from "@/lib/recipe-photo";
import { friendlyGeminiError, type GeminiPart } from "@/lib/gemini/models";

export const maxDuration = 300;

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
  nutritionCoach?: MealCoachHousehold;
  mealType?: MealType;
  weekdays?: Weekday[];
  dessertSlot?: DessertSlot;
  dessertProduct?: unknown;
  dessert?: PlannedMeal;
  recipePhoto?: unknown;
  recipeFit?: RecipeFit;
};

function dessertSwapMeal(body: Body): PlannedMeal | null {
  const meal = body.dessert;
  if (!meal || typeof meal !== "object" || !Array.isArray(meal.ingredients)) return null;
  const id = body.slotId ?? meal.id;
  if (isWeekLunchDessert(meal) || id === LUNCH_DESSERT_ID || id === DINNER_DESSERT_ID) return meal;
  return null;
}

function resolveDessertSlot(body: Body, meal: PlannedMeal): DessertSlot {
  return isDessertSlot(body.dessertSlot) ? body.dessertSlot : dessertSlotOf(meal);
}

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
      const dessertMeal = dessertSwapMeal(body);
      if (dessertMeal) {
        const slot = resolveDessertSlot(body, dessertMeal);
        let suggestions: string[] = [];
        let warning: string | undefined;
        let mock = false;
        try {
          const first = await callGeminiDessert(
            dessertSuggestSwapPrompt(dessertMeal, name, body.kitchenContext, slot),
          );
          warning = first.warning;
          suggestions = extractSuggestions(parseGeminiJson(first.text));
          const skip = new Set(
            dessertMeal.ingredients.map((item) => item.name.trim().toLowerCase()),
          );
          skip.add(name.trim().toLowerCase());
          suggestions = suggestions.filter((item) => !skip.has(item.trim().toLowerCase()));
        } catch {
          suggestions = [];
        }
        if (suggestions.length < 3) {
          suggestions = mockSuggestDessertSwap(name, dessertMeal);
          mock = true;
          warning = warning || "Idées light locales.";
        }
        if (suggestions.length >= 3) {
          return NextResponse.json({
            suggestions: suggestions.slice(0, 3),
            mock,
            warning,
          });
        }
        return NextResponse.json(
          { error: friendlyGeminiError("Réponse Gemini incomplète"), mock: false },
          { status: 502 },
        );
      }
      const meal = plan.find((item) => item.id === body.slotId) ?? plan[0];
      let suggestions: string[] = [];
      let warning: string | undefined;
      let mock = false;
      try {
        const first = await callGeminiPro(suggestSwapPrompt(meal, name, body.kitchenContext));
        warning = first.warning;
        suggestions = extractSuggestions(parseGeminiJson(first.text));
      } catch {
        suggestions = [];
      }
      if (suggestions.length < 3 || !suggestionsFitRecipe(name, suggestions, meal)) {
        suggestions = mockSuggestSwap(name, meal);
        mock = true;
        warning = warning || "3 idées locales, Gemini n’a pas renvoyé 3 alternatives.";
      }
      if (suggestions.length >= 3) {
        return NextResponse.json({
          suggestions: suggestions.slice(0, 3),
          mock,
          warning,
        });
      }
      return NextResponse.json(
        { error: friendlyGeminiError("Réponse Gemini incomplète"), mock: false },
        { status: 502 },
      );
    }

    if (body.mode === "dessert-batch") {
      const kitchenContext = body.kitchenContext;
      const dessertSlot: DessertSlot = isDessertSlot(body.dessertSlot) ? body.dessertSlot : "midi";
      const product = parseDessertProduct(body.dessertProduct);
      const prompt = dessertBatchPrompt(theme, body.coachBias, body.pastMeals, kitchenContext, dessertSlot);
      try {
        const first = await callGeminiDessert(prompt);
        let used = first;
        let recipes: ReturnType<typeof extractRecipes> = [];
        try {
          recipes = extractRecipes(parseGeminiJson(first.text));
        } catch {
          /* retry */
        }
        if (recipes.length === 0) {
          const again = await callGeminiDessert(
            `${prompt}

CORRECTION : ta réponse précédente n'était pas du JSON utilisable. Renvoie UNIQUEMENT le JSON dessert demandé, complet.`,
          );
          try {
            recipes = extractRecipes(parseGeminiJson(again.text));
            used = again;
          } catch {
            /* fall through */
          }
        }
        if (!recipes[0]) {
          return NextResponse.json(
            { error: friendlyGeminiError("Réponse Gemini incomplète"), mock: false },
            { status: 502 },
          );
        }
        const coach = parseMealCoach(body.nutritionCoach);
        const slot = dummyDessertSlot(dessertSlot);
        let planned = stampDessertMeal(
          ensureDessertProductInMeal(geminiToPlannedMeal(recipes[0], slot, theme), product),
          body.weekdays ?? [1, 2, 3, 4, 5],
          theme,
          dessertSlot,
          product,
          coach,
        );
        planned = scaleDessertToGoals(planned, coach, dessertSlot, product);
        if (planned.ingredients.length < 2 || !planned.baseName.trim()) {
          return NextResponse.json(
            { error: friendlyGeminiError("Réponse Gemini incomplète"), mock: false },
            { status: 502 },
          );
        }
        console.log("[MEAL GEN] using", used.tier, used.model, "dessert-batch", planned.baseName);
        return NextResponse.json({
          dessert: planned,
          mock: false,
          model: used.model,
          warning: used.warning,
        });
      } catch (error) {
        const raw = error instanceof Error ? error.message : "Gemini indisponible";
        console.error("[MEAL GEN] dessert-batch —", raw);
        return NextResponse.json({ error: friendlyGeminiError(raw), mock: false }, { status: 502 });
      }
    }

    if (body.mode === "today-swap") {
      const mealType = body.mealType ?? "dejeuner";
      const kitchenContext = body.kitchenContext;
      const prompt = todaySwapPrompt(mealType, theme, body.coachBias, body.pastMeals, kitchenContext);
      try {
        const first = await callGeminiPro(prompt);
        let used = first;
        let recipes: ReturnType<typeof extractRecipes> = [];
        try {
          recipes = extractRecipes(parseGeminiJson(first.text));
        } catch {
          /* retry below */
        }
        if (recipes.length === 0) {
          const again = await callGeminiPro(
            `${prompt}

CORRECTION : ta réponse précédente n'était pas du JSON utilisable. Renvoie UNIQUEMENT le JSON demandé, complet.`,
          );
          try {
            recipes = extractRecipes(parseGeminiJson(again.text));
            used = again;
          } catch {
            /* fall through */
          }
        }
        if (!recipes[0]) {
          return NextResponse.json(
            { error: friendlyGeminiError("Réponse Gemini incomplète"), mock: false },
            { status: 502 },
          );
        }
        const slot = dummyTodaySwapSlot(mealType);
        let planned: PlannedMeal = {
          ...geminiToPlannedMeal(recipes[0], slot, theme),
          servingsPerPerson: 1,
          batchId: slot.id,
          coverLabel: "1 repas du jour",
          lowCalorie: mealType === "diner",
        };
        const coach = parseMealCoach(body.nutritionCoach);
        if (coach && (mealType === "dejeuner" || mealType === "diner")) {
          planned = scalePlanToGoals([planned], coach)[0] ?? planned;
        }
        const themeIssues = theme.trim()
          ? themeMismatchProblems([planned.baseName], theme)
          : [];
        const themeWarning =
          themeIssues.length > 0
            ? "Thème un peu approximatif — tu peux régénérer un plat."
            : undefined;
        console.log("[MEAL GEN] using", used.tier, used.model, "today-swap", planned.baseName);
        return NextResponse.json({
          proposals: swapProposalsFromPlanned(planned, theme, mealType),
          mock: false,
          model: used.model,
          warning: [used.warning, themeWarning].filter(Boolean).join(" ") || undefined,
        });
      } catch (error) {
        const raw = error instanceof Error ? error.message : "Gemini indisponible";
        console.error("[MEAL GEN] today-swap —", raw);
        return NextResponse.json({ error: friendlyGeminiError(raw), mock: false }, { status: 502 });
      }
    }

    if (body.mode === "apply-swap") {
      const dessertMeal = dessertSwapMeal(body);
      if (dessertMeal) {
        if (!body.ingredientName || !body.replacement) {
          return NextResponse.json({ error: "Swap incomplet" }, { status: 400 });
        }
        const dessertSlot = resolveDessertSlot(body, dessertMeal);
        const product = parseDessertProduct(body.dessertProduct);
        const prompt = dessertApplySwapPrompt(
          dessertMeal,
          body.ingredientName,
          body.replacement,
          body.pastMeals,
          body.kitchenContext,
          dessertSlot,
        );
        try {
          const first = await callGeminiDessert(prompt);
          let used = first;
          let recipes: ReturnType<typeof extractRecipes> = [];
          try {
            recipes = extractRecipes(parseGeminiJson(first.text));
          } catch {
            /* retry */
          }
          if (recipes.length === 0) {
            const again = await callGeminiDessert(
              `${prompt}

CORRECTION : ta réponse précédente n'était pas du JSON utilisable. Renvoie UNIQUEMENT le JSON dessert demandé, complet.`,
            );
            try {
              recipes = extractRecipes(parseGeminiJson(again.text));
              used = again;
            } catch {
              /* fall through */
            }
          }
          if (!recipes[0]) {
            return NextResponse.json(
              { error: friendlyGeminiError("Réponse Gemini incomplète"), mock: false },
              { status: 502 },
            );
          }
          const coach = parseMealCoach(body.nutritionCoach);
          const themeUsed = theme.trim() || dessertMeal.theme;
          let planned = stampDessertMeal(
            ensureDessertProductInMeal(
              geminiToPlannedMeal(recipes[0], dummyDessertSlot(dessertSlot), themeUsed),
              product,
            ),
            body.weekdays ?? dessertWeekdaysOf(dessertMeal),
            themeUsed,
            dessertSlot,
            product,
            coach,
          );
          planned = scaleDessertToGoals(planned, coach, dessertSlot, product);
          if (planned.ingredients.length < 2 || !planned.baseName.trim()) {
            return NextResponse.json(
              { error: friendlyGeminiError("Réponse Gemini incomplète"), mock: false },
              { status: 502 },
            );
          }
          console.log("[MEAL GEN] using", used.tier, used.model, "apply-swap dessert", planned.baseName);
          return NextResponse.json({
            dessert: planned,
            mock: false,
            model: used.model,
            warning: used.warning,
          });
        } catch (error) {
          const raw = error instanceof Error ? error.message : "Gemini indisponible";
          console.error("[MEAL GEN] apply-swap dessert —", raw);
          return NextResponse.json({ error: friendlyGeminiError(raw), mock: false }, { status: 502 });
        }
      }
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
      const coach = parseMealCoach(body.nutritionCoach);
      return NextResponse.json({
        plan: scalePlanToGoals(applyRecipes(plan, recipes, theme, "single", body.slotId), coach),
        mock: false,
        warning,
      });
    }

    const pastMeals = body.pastMeals ?? [];
    const kitchenContext = body.kitchenContext;
    const recipePhoto = body.mode === "single" ? parseRecipePhoto(body.recipePhoto) : null;
    const recipeFit: RecipeFit = recipePhoto && isRecipeFit(body.recipeFit) ? body.recipeFit : "adapt";
    const imageParts: GeminiPart[] | undefined = recipePhoto
      ? [{ inlineData: { mimeType: recipePhoto.mimeType, data: recipePhoto.data } }]
      : undefined;
    const slot = plan.find((item) => item.id === body.slotId) ?? plan[0];
    const prompt =
      body.mode === "weekdays"
        ? weekdaysPrompt(theme, body.coachBias, pastMeals, kitchenContext)
        : body.mode === "weekend"
          ? weekendPrompt(theme, body.coachBias, pastMeals, kitchenContext)
          : recipePhoto
            ? recipeFromPhotoPrompt(
                slot,
                pairForSlot(body.slotId ?? ""),
                theme,
                recipeFit,
                body.coachBias,
                pastMeals,
                kitchenContext,
              )
            : singlePrompt(
                slot,
                pairForSlot(body.slotId ?? ""),
                theme,
                body.coachBias,
                pastMeals,
                kitchenContext,
              );

    try {
      const started = Date.now();
      const first = await callGeminiPro(prompt, imageParts);
      let used = first;
      let recipes: ReturnType<typeof extractRecipes> = [];
      try {
        recipes = extractRecipes(parseGeminiJson(first.text));
      } catch (error) {
        console.warn("[MEAL GEN] JSON incomplet, second essai…", error instanceof Error ? error.message : error);
      }
      if (recipes.length === 0) {
        const again = await callGeminiPro(
          `${prompt}

CORRECTION : ta réponse précédente n'était pas du JSON utilisable. Renvoie UNIQUEMENT le JSON demandé, complet.`,
          imageParts,
        );
        try {
          recipes = extractRecipes(parseGeminiJson(again.text));
          used = again;
        } catch (error) {
          console.warn("[MEAL GEN] second JSON encore invalide", error);
        }
      }
      if (recipes.length === 0) throw new Error("JSON sans recette");
      const titles = recipes.map((item) => String(item.title ?? ""));
      let problems = recipePhoto
        ? diversityProblems(titles, pastMeals)
        : [...diversityProblems(titles, pastMeals), ...themeMismatchProblems(titles, theme)];
      const elapsed = Date.now() - started;
      if (problems.length > 0 && (body.mode === "weekdays" || body.mode === "weekend") && elapsed < 50_000) {
        console.warn("[MEAL GEN] retry — thème/diversité:", problems.slice(0, 5).join(" | "));
        const retry = await callGeminiPro(
          `${prompt}

CORRECTION OBLIGATOIRE — ta proposition violait le thème et/ou la diversité :
${problems.slice(0, 10).join("\n")}
Réécris TOUTES les recettes. Titres 100 % du thème « ${theme || "libre"} », familles différentes, aucun plat d'une autre cuisine.`,
        );
        try {
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
        } catch (error) {
          console.warn("[MEAL GEN] retry JSON raté — on garde le premier lot", error);
        }
      }
      const themeIssues =
        theme.trim() && !recipePhoto
          ? themeMismatchProblems(recipes.map((item) => String(item.title ?? "")), theme)
          : [];
      const themeWarning =
        themeIssues.length > 0
          ? "Thème un peu approximatif — tu peux régénérer un plat."
          : undefined;
      console.log(
        "[MEAL GEN] using",
        used.tier,
        used.model,
        body.mode,
        recipePhoto ? `photo:${recipeFit}` : "text",
        recipes.map((item) => item.title).join(" · "),
      );
      const coach = parseMealCoach(body.nutritionCoach);
      const nextPlan = applyRecipes(plan, recipes, theme, body.mode, body.slotId);
      const scaled = recipePhoto && recipeFit === "as-is" ? nextPlan : scalePlanToGoals(nextPlan, coach);
      return NextResponse.json({
        plan: scaled,
        mock: false,
        model: used.model,
        warning: [used.warning, themeWarning].filter(Boolean).join(" ") || undefined,
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
