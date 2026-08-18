"use client";

import { useEffect, useMemo, useState } from "react";
import { GenerateControls } from "@/components/repas/GenerateControls";
import { MenuSummary } from "@/components/repas/MenuSummary";
import { WeekAgenda } from "@/components/repas/WeekAgenda";
import { RecipeDetailSheet } from "@/components/repas/RecipeDetailSheet";
import { MoveMealSheet } from "@/components/repas/MoveMealSheet";
import { PickMealSlotSheet } from "@/components/repas/PickMealSlotSheet";
import { ShoppingListPanel } from "@/components/repas/ShoppingListPanel";
import { BatchGuidePanel } from "@/components/repas/BatchGuidePanel";
import { SwapIngredientSheet } from "@/components/repas/SwapIngredientSheet";
import { WeekNav } from "@/components/repas/WeekNav";
import { useProfile } from "@/context/ProfileContext";
import { mondayOf, todayISO } from "@/lib/dates";
import { requestGenerateMeals } from "@/lib/gemini/client";
import { loadHouseholdCoachBias } from "@/lib/coach-apply";
import { currentNutritionDeltas } from "@/lib/coach-adjustments";
import { applyCoachBoostsToLoadedPlan } from "@/lib/coach-plan-sync";
import { deleteWeekPlan, loadRecentMealTitles, loadWeekPlan, saveWeekPlan } from "@/lib/supabase/week-plans";
import type { GenerateMealsMode } from "@/lib/gemini/meals";
import type { PlannedMeal } from "@/lib/types";
import {
  clearMealsInPlan,
  emptyWeekPlan,
  isEmptyMeal,
  moveMealInPlan,
  pairForSlot,
} from "@/lib/weekly-plan";
import { planTagByMealId, taggedUniqueMeals } from "@/lib/meal-tags";
import { QtyScaleToggle } from "@/components/repas/QtyScaleToggle";
import { cn } from "@/lib/utils";
import { loadKitchenPrefs, formatKitchenPrefsForPrompt } from "@/lib/kitchen-prefs";
import type { QtyMode } from "@/lib/qty-scale";

type Tab = "plan" | "courses" | "batch";

export default function RepasScreen() {
  const { view, catalog } = useProfile();
  const [tab, setTab] = useState<Tab>("plan");
  const [planQty, setPlanQty] = useState<QtyMode>("repas");
  const [batchQty, setBatchQty] = useState<QtyMode>("batch");
  const [weekStart, setWeekStart] = useState(() => mondayOf(todayISO()));
  const [plan, setPlan] = useState<PlannedMeal[]>(emptyWeekPlan);
  const [theme, setTheme] = useState("");
  const [nonce, setNonce] = useState(1);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [pickSlot, setPickSlot] = useState(false);
  const [swapMeal, setSwapMeal] = useState<PlannedMeal | null>(null);
  const [moveMeal, setMoveMeal] = useState<PlannedMeal | null>(null);
  const [openTag, setOpenTag] = useState<string | null>(null);

  function kitchenContext() {
    return formatKitchenPrefsForPrompt(loadKitchenPrefs(), [catalog.alexis, catalog.elodie]);
  }

  function coachProfiles() {
    return [
      { id: "alexis" as const, deltas: currentNutritionDeltas(catalog.alexis.appliedAdjustments) },
      { id: "elodie" as const, deltas: currentNutritionDeltas(catalog.elodie.appliedAdjustments) },
    ];
  }

  function withCoachBoosts(next: PlannedMeal[], force = true) {
    return applyCoachBoostsToLoadedPlan({
      weekStart,
      plan: next,
      profiles: coachProfiles(),
      force,
    });
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const loaded = await loadWeekPlan(weekStart);
      if (cancelled) return;
      const synced = applyCoachBoostsToLoadedPlan({
        weekStart,
        plan: loaded.plan,
        profiles: [
          { id: "alexis", deltas: currentNutritionDeltas(catalog.alexis.appliedAdjustments) },
          { id: "elodie", deltas: currentNutritionDeltas(catalog.elodie.appliedAdjustments) },
        ],
      });
      if (cancelled) return;
      setPlan(synced.plan);
      if (loaded.theme) setTheme(loaded.theme);
      if (synced.changed) {
        await saveWeekPlan(weekStart, synced.plan, loaded.theme);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    weekStart,
    catalog.alexis.appliedAdjustments,
    catalog.elodie.appliedAdjustments,
  ]);

  async function persist(next: PlannedMeal[], nextTheme = theme) {
    const synced = withCoachBoosts(next);
    setPlan(synced.plan);
    const error = await saveWeekPlan(weekStart, synced.plan, nextTheme);
    if (error) flash(`Sauvé en local · ${error}`);
  }

  function flash(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2400);
  }

  async function collectPastMeals(slotId?: string) {
    const recent = await loadRecentMealTitles(weekStart);
    const pair = slotId ? pairForSlot(slotId) : null;
    const skip = new Set(pair?.slotIds ?? (slotId ? [slotId] : []));
    const current = plan
      .filter((meal) => !isEmptyMeal(meal) && !skip.has(meal.id))
      .map((meal) => meal.baseName);
    return [...new Set([...recent, ...current])];
  }

  async function generate(mode: GenerateMealsMode, slotId?: string, themeOverride?: string) {
    setBusy(true);
    try {
      const pastMeals = await collectPastMeals(mode === "single" ? slotId : undefined);
      const result = await requestGenerateMeals({
        mode,
        theme: themeOverride !== undefined ? themeOverride : theme,
        plan,
        slotId,
        nonce,
        coachBias: loadHouseholdCoachBias(),
        pastMeals,
        kitchenContext: kitchenContext(),
      });
      if (result.plan) {
        await persist(result.plan);
        setNonce((n) => n + 1);
        const label =
          mode === "weekdays" ? "Lun–Ven généré" : mode === "weekend" ? "Week-end généré" : "Repas généré";
        flash(
          result.warning
            ? `${label}. ${result.warning}`
            : `${label} · Gemini Pro`,
        );
      } else {
        flash(result.error ?? "Génération impossible");
      }
    } catch (error) {
      flash(error instanceof Error ? error.message : "Génération impossible");
    } finally {
      setBusy(false);
    }
  }

  async function clearWeek() {
    if (!window.confirm("Vider tous les repas de cette semaine ? Cette action est immédiate.")) return;
    setBusy(true);
    try {
      const error = await deleteWeekPlan(weekStart);
      await persist(emptyWeekPlan());
      flash(error ? `Semaine vidée en local · ${error}` : "Semaine vidée");
    } finally {
      setBusy(false);
    }
  }

  async function deleteMeal(meal: PlannedMeal) {
    const pair = pairForSlot(meal.id);
    const label = pair
      ? `Supprimer « ${meal.baseName} » sur ${pair.label} ?`
      : `Supprimer « ${meal.baseName} » ?`;
    if (!window.confirm(label)) return;
    await persist(clearMealsInPlan(plan, meal.id));
    flash("Repas supprimé");
  }

  async function moveMealTo(
    meal: PlannedMeal,
    target: { dayIndex: number; mealType: "dejeuner" | "diner" },
  ) {
    await persist(moveMealInPlan(plan, meal.id, target));
    setMoveMeal(null);
    flash("Repas déplacé");
  }

  const tags = useMemo(() => planTagByMealId(plan), [plan]);
  const recipes = useMemo(() => taggedUniqueMeals(plan), [plan]);
  const openRecipe = recipes.find((row) => row.tag === openTag) ?? null;

  return (
    <div>
      <h1 className="text-[28px] font-bold tracking-tight">Repas</h1>
      <p className="mt-1 text-[13px] text-health-muted">
        Batchcooking · double déclinaison · Gem Chef Cuistot
      </p>

      <div className="mt-4 flex rounded-full bg-white p-1 shadow-card">
        {(
          [
            ["plan", "Semaine"],
            ["courses", "Courses"],
            ["batch", "Batch"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "flex-1 rounded-full py-2 text-[13px] font-semibold",
              tab === id ? "bg-health-ink text-white" : "text-health-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <WeekNav weekStart={weekStart} onChange={setWeekStart} />

      {tab === "plan" && (
        <div className="mt-2">
          <GenerateControls
            theme={theme}
            onThemeChange={setTheme}
            busy={busy}
            canClear={plan.some((meal) => !isEmptyMeal(meal))}
            onGenerateWeekdays={() => void generate("weekdays")}
            onGenerateWeekend={() => void generate("weekend")}
            onGenerateSingle={() => setPickSlot(true)}
            onClearWeek={() => void clearWeek()}
          />

          <MenuSummary
            plan={plan}
            onSelect={(meal, tag) => setOpenTag(tag)}
          />

          <WeekAgenda
            plan={plan}
            tags={tags}
            busy={busy}
            onOpen={(meal, tag) => setOpenTag(tag)}
            onGenerate={(slotId) => void generate("single", slotId)}
          />
        </div>
      )}

      {tab === "courses" && <ShoppingListPanel weekStart={weekStart} plan={plan} />}

      {tab === "batch" && (
        <div className="mt-2">
          <MenuSummary plan={plan} />
          <QtyScaleToggle mode={batchQty} onChange={setBatchQty} />
          <BatchGuidePanel weekStart={weekStart} plan={plan} qtyMode={batchQty} />
        </div>
      )}

      {pickSlot && (
        <PickMealSlotSheet
          plan={plan}
          onClose={() => setPickSlot(false)}
          onSelect={(slotId) => {
            setPickSlot(false);
            void generate("single", slotId);
          }}
        />
      )}

      {swapMeal && (
        <SwapIngredientSheet
          meal={swapMeal}
          view={view}
          busy={busy}
          onClose={() => setSwapMeal(null)}
          onSuggest={async (ingredientId, ingredientName) => {
            const result = await requestGenerateMeals({
              mode: "suggest-swap",
              theme,
              plan,
              slotId: swapMeal.id,
              ingredientId,
              ingredientName,
              pastMeals: await collectPastMeals(swapMeal.id),
              kitchenContext: kitchenContext(),
            });
            return result.suggestions ?? [];
          }}
          onPick={async (ingredientId, replacement) => {
            setBusy(true);
            try {
              const ingredient = swapMeal.ingredients.find((item) => item.id === ingredientId);
              const result = await requestGenerateMeals({
                mode: "apply-swap",
                theme,
                plan,
                slotId: swapMeal.id,
                ingredientId,
                ingredientName: ingredient?.name,
                replacement,
                pastMeals: await collectPastMeals(swapMeal.id),
              kitchenContext: kitchenContext(),
              });
              if (result.plan) {
                await persist(result.plan);
                flash(
                  result.warning
                    ? `Recette réadaptée. ${result.warning}`
                    : "Recette réadaptée · Gemini Pro",
                );
              }
              setSwapMeal(null);
            } catch (error) {
              flash(error instanceof Error ? error.message : "Échange impossible");
            } finally {
              setBusy(false);
            }
          }}
        />
      )}

      {moveMeal && (
        <MoveMealSheet
          meal={moveMeal}
          plan={plan}
          onClose={() => setMoveMeal(null)}
          onConfirm={(target) => void moveMealTo(moveMeal, target)}
        />
      )}

      {openRecipe && (
        <RecipeDetailSheet
          meal={openRecipe.meal}
          planTag={openRecipe.tag}
          view={view}
          busy={busy}
          qtyMode={planQty}
          onQtyMode={setPlanQty}
          onClose={() => setOpenTag(null)}
          currentTheme={theme}
          onRegenerate={(regenTheme) => void generate("single", openRecipe.meal.id, regenTheme)}
          onSwapIngredient={() => setSwapMeal(openRecipe.meal)}
          onDelete={() => {
            void deleteMeal(openRecipe.meal);
            setOpenTag(null);
          }}
          onMove={() => setMoveMeal(openRecipe.meal)}
        />
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-[90] -translate-x-1/2 rounded-full bg-health-ink px-4 py-2 text-[13px] font-medium text-white shadow-card">
          {toast}
        </div>
      )}
    </div>
  );
}
