"use client";

import { useEffect, useMemo, useState } from "react";
import { GenerateControls } from "@/components/repas/GenerateControls";
import { MenuSummary } from "@/components/repas/MenuSummary";
import { WeekAgenda } from "@/components/repas/WeekAgenda";
import { RecipeDetailSheet } from "@/components/repas/RecipeDetailSheet";
import { MoveMealSheet } from "@/components/repas/MoveMealSheet";
import { PickMealSlotSheet } from "@/components/repas/PickMealSlotSheet";
import { FavoriteRecipeSheet, FavoritesPanel } from "@/components/repas/FavoritesPanel";
import { RejectedPanel, RejectedRecipeSheet } from "@/components/repas/RejectedPanel";
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
  placeRecipeInSlots,
} from "@/lib/weekly-plan";
import { planTagByMealId, taggedUniqueMeals } from "@/lib/meal-tags";
import { QtyScaleToggle } from "@/components/repas/QtyScaleToggle";
import { StockPanel } from "@/components/repas/StockPanel";
import { cn } from "@/lib/utils";
import { loadKitchenPrefs, formatKitchenPrefsForPrompt } from "@/lib/kitchen-prefs";
import {
  DEFAULT_STOCK,
  formatStockForPrompt,
  formatStockItem,
  loadLocalStock,
  newlyGeneratedMeals,
  removeStockItems,
  stockIsActive,
  stockItemsUsedInMeals,
  type HouseholdStock,
} from "@/lib/stock";
import { loadStock, persistStock } from "@/lib/supabase/stock";
import { markShoppingCheckedForNames } from "@/lib/shopping-from-plan";
import { buildMealCoachFromProfiles, formatMealCoachForPrompt, scalePlanToGoals } from "@/lib/meal-coach";
import {
  clearPlanTargetsSnapshot,
  ensurePlanTargetsBaseline,
  savePlanTargetsSnapshot,
  snapshotFromCoach,
  snapshotsEqual,
  type PlanTargetsSnapshot,
} from "@/lib/plan-targets";
import { goalLabel } from "@/lib/goals";
import type { FavoriteRecipe } from "@/lib/favorites";
import {
  canFavoriteMeal,
  favoriteIdFromTitle,
  isFavoriteTitle,
  patchFavorite,
  removeFavorite,
  upsertFavorite,
} from "@/lib/favorites";
import { loadFavorites, persistFavorites } from "@/lib/supabase/favorites";
import type { RejectedRecipe } from "@/lib/rejected";
import {
  canRejectMeal,
  isRejectedTitle,
  mergeAvoidTitles,
  patchRejected,
  removeRejected,
  upsertRejected,
  upsertRejectedTitle,
} from "@/lib/rejected";
import { loadRejected, persistRejected } from "@/lib/supabase/rejected";
import type { QtyMode } from "@/lib/qty-scale";

type Tab = "plan" | "courses" | "batch" | "favoris";

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
  const [planStamp, setPlanStamp] = useState<PlanTargetsSnapshot | null>(null);
  const [favorites, setFavorites] = useState<FavoriteRecipe[]>([]);
  const [rejected, setRejected] = useState<RejectedRecipe[]>([]);
  const [favPane, setFavPane] = useState<"favoris" | "plus-jamais">("favoris");
  const [openFavorite, setOpenFavorite] = useState<FavoriteRecipe | null>(null);
  const [placeFavorite, setPlaceFavorite] = useState<FavoriteRecipe | null>(null);
  const [openRejected, setOpenRejected] = useState<RejectedRecipe | null>(null);
  const [stock, setStock] = useState<HouseholdStock>(DEFAULT_STOCK);

  function kitchenContext() {
    const prefs = formatKitchenPrefsForPrompt(loadKitchenPrefs(), [catalog.alexis, catalog.elodie]);
    const coach = formatMealCoachForPrompt(buildMealCoachFromProfiles(catalog.alexis, catalog.elodie));
    return [prefs, coach, formatStockForPrompt(loadLocalStock())].filter(Boolean).join("\n\n");
  }

  function nutritionCoach() {
    return buildMealCoachFromProfiles(catalog.alexis, catalog.elodie);
  }

  function stampTargets() {
    const snapshot = snapshotFromCoach(nutritionCoach());
    savePlanTargetsSnapshot(weekStart, snapshot);
    setPlanStamp(snapshot);
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
      const [favs, bans, pantry] = await Promise.all([loadFavorites(), loadRejected(), loadStock()]);
      if (cancelled) return;
      setFavorites(favs);
      setRejected(bans);
      setStock(pantry);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (tab !== "plan") return;
    let cancelled = false;
    void loadStock().then((pantry) => {
      if (!cancelled) setStock(pantry);
    });
    return () => {
      cancelled = true;
    };
  }, [tab]);

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
      const coach = buildMealCoachFromProfiles(catalog.alexis, catalog.elodie);
      const hasMeals = synced.plan.some((meal) => !isEmptyMeal(meal));
      setPlanStamp(ensurePlanTargetsBaseline(weekStart, coach, hasMeals));
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
    return mergeAvoidTitles([...recent, ...current], rejected);
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
        nutritionCoach: nutritionCoach(),
      });
      if (result.plan) {
        const used = await consumeStockFromMeals(newlyGeneratedMeals(plan, result.plan));
        await persist(result.plan);
        stampTargets();
        setNonce((n) => n + 1);
        const label =
          mode === "weekdays" ? "Lun–Ven généré" : mode === "weekend" ? "Week-end généré" : "Repas généré";
        const stockNote = used.length
          ? ` · stock : ${used.map(formatStockItem).join(", ")}`
          : "";
        flash(
          result.warning
            ? `${label}. ${result.warning}${stockNote}`
            : `${label} · Gemini Pro${stockNote}`,
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
      clearPlanTargetsSnapshot(weekStart);
      setPlanStamp(null);
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

  async function updateQuantities() {
    setBusy(true);
    try {
      await persist(scalePlanToGoals(plan, nutritionCoach()));
      stampTargets();
      flash("Quantités mises à jour · mêmes recettes");
    } finally {
      setBusy(false);
    }
  }

  async function saveFavorites(next: FavoriteRecipe[]) {
    setFavorites(next);
    const error = await persistFavorites(next);
    if (error) flash(`Favoris en local · ${error}`);
  }

  async function saveRejected(next: RejectedRecipe[]) {
    setRejected(next);
    const error = await persistRejected(next);
    if (error) flash(`Plus jamais en local · ${error}`);
  }

  async function saveStock(next: HouseholdStock) {
    setStock(next);
    const error = await persistStock(next);
    if (error) flash(`Stock en local · ${error}`);
  }

  async function consumeStockFromMeals(meals: PlannedMeal[]) {
    const current = loadLocalStock();
    if (!stockIsActive(current) || meals.length === 0) return [];
    const used = stockItemsUsedInMeals(current.items, meals);
    if (used.length === 0) return [];
    await saveStock(removeStockItems(current, used.map((item) => item.id)));
    markShoppingCheckedForNames(
      weekStart,
      used.map((item) => item.name),
    );
    return used;
  }

  async function toggleFavorite(recipe: PlannedMeal) {
    if (!canFavoriteMeal(recipe)) return;
    const on = isFavoriteTitle(favorites, recipe.baseName);
    const next = on
      ? removeFavorite(favorites, favoriteIdFromTitle(recipe.baseName))
      : upsertFavorite(favorites, recipe);
    await saveFavorites(next);
    if (!on && isRejectedTitle(rejected, recipe.baseName)) {
      await saveRejected(removeRejected(rejected, favoriteIdFromTitle(recipe.baseName)));
    }
    flash(on ? "Retiré des favoris" : "Gardé en favori");
  }

  async function toggleRejected(recipe: PlannedMeal) {
    if (!canRejectMeal(recipe)) return;
    const on = isRejectedTitle(rejected, recipe.baseName);
    const next = on
      ? removeRejected(rejected, favoriteIdFromTitle(recipe.baseName))
      : upsertRejected(rejected, recipe);
    await saveRejected(next);
    if (!on && isFavoriteTitle(favorites, recipe.baseName)) {
      await saveFavorites(removeFavorite(favorites, favoriteIdFromTitle(recipe.baseName)));
    }
    flash(on ? "Retiré de Plus jamais" : "Plus jamais ce plat");
  }

  async function placeFavoriteInWeek(item: FavoriteRecipe, slotId: string) {
    const slotIds = pairForSlot(slotId)?.slotIds ?? [slotId];
    setBusy(true);
    try {
      await persist(scalePlanToGoals(placeRecipeInSlots(plan, slotIds, item.recipe), nutritionCoach()));
      stampTargets();
      setPlaceFavorite(null);
      setOpenFavorite(null);
      setTab("plan");
      flash("Favori posé dans la semaine");
    } finally {
      setBusy(false);
    }
  }

  const tags = useMemo(() => planTagByMealId(plan), [plan]);
  const recipes = useMemo(() => taggedUniqueMeals(plan), [plan]);
  const openRecipe = recipes.find((row) => row.tag === openTag) ?? null;
  const hasMeals = plan.some((meal) => !isEmptyMeal(meal));
  const targetsStale =
    hasMeals &&
    planStamp != null &&
    !snapshotsEqual(planStamp, snapshotFromCoach(nutritionCoach()));

  return (
    <div>
      <h1 className="text-[28px] font-bold tracking-tight">Repas</h1>
      <p className="mt-1 text-[13px] text-health-muted">
        Déjeuners & dîners de la semaine. Petit-déj, collations et desserts viennent des Réglages. Le plat du
        jour se sert sur Aujourd’hui.
      </p>

      <div className="mt-4 flex rounded-full bg-white p-1 shadow-card">
        {(
          [
            ["plan", "Semaine"],
            ["courses", "Courses"],
            ["batch", "Batch"],
            ["favoris", "Favoris"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "flex-1 rounded-full py-2 text-[12px] font-semibold",
              tab === id ? "bg-health-ink text-white" : "text-health-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab !== "favoris" ? <WeekNav weekStart={weekStart} onChange={setWeekStart} /> : null}

      {tab !== "favoris" && targetsStale ? (
        <div className="mt-3 rounded-card bg-amber-50 px-3 py-3 dark:bg-amber-950/40">
          <p className="text-[13px] font-semibold text-amber-900 dark:text-amber-100">
            Cibles changées
          </p>
          <p className="mt-0.5 text-[12px] leading-snug text-amber-800 dark:text-amber-200">
            Les recettes restent les mêmes. Les quantités (et les courses) peuvent être recalées.
          </p>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void updateQuantities()}
              className="flex-1 rounded-xl bg-health-ink py-2 text-[13px] font-semibold text-white disabled:opacity-50"
            >
              Mettre à jour les quantités
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => stampTargets()}
              className="rounded-xl bg-white px-3 py-2 text-[13px] font-semibold text-health-muted dark:bg-health-card"
            >
              Plus tard
            </button>
          </div>
        </div>
      ) : null}

      {tab === "plan" && (
        <div className="mt-2">
          <StockPanel stock={stock} onChange={(next) => void saveStock(next)} />
          <GenerateControls
            theme={theme}
            onThemeChange={setTheme}
            busy={busy}
            canClear={plan.some((meal) => !isEmptyMeal(meal))}
            coachHint={`Portions selon Suivi : Alexis ${goalLabel(catalog.alexis.primaryGoal)} · Élodie ${goalLabel(catalog.elodie.primaryGoal)}. Même plat, grammes différents (sauf sauces).`}
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
          <MenuSummary
            plan={plan}
            onSelect={(_meal, tag) => setOpenTag(tag)}
          />
          <QtyScaleToggle mode={batchQty} onChange={setBatchQty} />
          <BatchGuidePanel
            weekStart={weekStart}
            plan={plan}
            qtyMode={batchQty}
            onOpenRecipe={(tag) => setOpenTag(tag)}
          />
        </div>
      )}

      {tab === "favoris" && (
        <div>
          <div className="mt-3 flex rounded-full bg-white p-1 shadow-card">
            {(
              [
                ["favoris", "Favoris"],
                ["plus-jamais", "Plus jamais"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFavPane(id)}
                className={cn(
                  "flex-1 rounded-full py-2 text-[12px] font-semibold",
                  favPane === id ? "bg-health-ink text-white" : "text-health-muted",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {favPane === "favoris" ? (
            <FavoritesPanel list={favorites} view={view} onOpen={setOpenFavorite} />
          ) : (
            <RejectedPanel
              list={rejected}
              onOpen={setOpenRejected}
              onAddTitle={(title) => {
                void saveRejected(upsertRejectedTitle(rejected, title));
                if (isFavoriteTitle(favorites, title)) {
                  void saveFavorites(removeFavorite(favorites, favoriteIdFromTitle(title)));
                }
                flash("Ajouté à Plus jamais");
              }}
            />
          )}
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
                nutritionCoach: nutritionCoach(),
              });
              if (result.plan) {
                const used = await consumeStockFromMeals(newlyGeneratedMeals(plan, result.plan));
                await persist(result.plan);
                const stockNote = used.length
                  ? ` · stock : ${used.map(formatStockItem).join(", ")}`
                  : "";
                flash(
                  result.warning
                    ? `Recette réadaptée. ${result.warning}${stockNote}`
                    : `Recette réadaptée · Gemini Pro${stockNote}`,
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
          favoriteOn={
            canFavoriteMeal(openRecipe.meal)
              ? isFavoriteTitle(favorites, openRecipe.meal.baseName)
              : false
          }
          onToggleFavorite={
            canFavoriteMeal(openRecipe.meal)
              ? () => void toggleFavorite(openRecipe.meal)
              : undefined
          }
          rejectedOn={
            canRejectMeal(openRecipe.meal)
              ? isRejectedTitle(rejected, openRecipe.meal.baseName)
              : false
          }
          onToggleRejected={
            canRejectMeal(openRecipe.meal)
              ? () => void toggleRejected(openRecipe.meal)
              : undefined
          }
        />
      )}

      {placeFavorite && (
        <PickMealSlotSheet
          plan={plan}
          title="Où le remettre ?"
          hint="Lun–Ven : les deux créneaux du batch. Week-end : ce repas seulement. Les quantités se recalent sur tes cibles."
          onClose={() => setPlaceFavorite(null)}
          onSelect={(slotId) => void placeFavoriteInWeek(placeFavorite, slotId)}
        />
      )}

      {openFavorite && (
        <FavoriteRecipeSheet
          item={openFavorite}
          view={view}
          busy={busy}
          onClose={() => setOpenFavorite(null)}
          onPlace={() => setPlaceFavorite(openFavorite)}
          onRemove={() => {
            void saveFavorites(removeFavorite(favorites, openFavorite.id));
            setOpenFavorite(null);
            flash("Retiré des favoris");
          }}
          onSaveMeta={(patch) => {
            const next = patchFavorite(favorites, openFavorite.id, patch);
            void saveFavorites(next);
            const id = favoriteIdFromTitle(patch.title);
            setOpenFavorite(next.find((item) => item.id === id) ?? next[0] ?? null);
            flash("Favori mis à jour");
          }}
        />
      )}

      {openRejected && (
        <RejectedRecipeSheet
          item={openRejected}
          onClose={() => setOpenRejected(null)}
          onRemove={() => {
            void saveRejected(removeRejected(rejected, openRejected.id));
            setOpenRejected(null);
            flash("Retiré de Plus jamais");
          }}
          onSaveMeta={(patch) => {
            const next = patchRejected(rejected, openRejected.id, patch);
            void saveRejected(next);
            const id = favoriteIdFromTitle(patch.title);
            setOpenRejected(next.find((item) => item.id === id) ?? next[0] ?? null);
            flash("Liste mise à jour");
          }}
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
