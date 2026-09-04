"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { DessertBatchCard } from "@/components/repas/DessertBatchCard";
import { SwapIngredientSheet } from "@/components/repas/SwapIngredientSheet";
import { WeekNav } from "@/components/repas/WeekNav";
import { useProfile } from "@/context/ProfileContext";
import { mondayOf, todayISO, isoWeekday } from "@/lib/dates";
import { requestDessertProduct, requestGenerateMeals } from "@/lib/gemini/client";
import { loadHouseholdCoachBias } from "@/lib/coach-apply";
import { currentNutritionDeltas } from "@/lib/coach-adjustments";
import { applyCoachBoostsToLoadedPlan } from "@/lib/coach-plan-sync";
import { deleteWeekPlan, loadRecentMealTitles, loadWeekPlan, saveWeekPlan, subscribeWeekPlan } from "@/lib/supabase/week-plans";
import { applyTodaySlotTemplates } from "@/lib/supabase/today-data";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { GenerateMealsMode } from "@/lib/gemini/meals";
import type { PlannedMeal, Weekday } from "@/lib/types";
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
import { pickMealInspirations } from "@/lib/meal-inspo";
import { useSeasonWeather } from "@/context/SeasonContext";
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
import {
  DEFAULT_DESSERT_DAYS,
  dessertTagOf,
  dessertSlotOf,
  formatDessertBatchForPrompt,
  isWeekLunchDessert,
  loadWeekLunchDessert,
  persistWeekLunchDessert,
  scaleDessertToGoals,
  stampDessertMeal,
  type WeekLunchDessert,
} from "@/lib/week-dessert";
import { formatDessertProductForPrompt, type DessertProduct, type DessertSlot } from "@/lib/dessert-product";
import { mockSuggestDessertSwap, mockSuggestSwap } from "@/lib/swap-coherence";

type Tab = "plan" | "courses" | "batch" | "favoris";

type DessertPane = {
  saved: WeekLunchDessert | null;
  draft: PlannedMeal | null;
  theme: string;
  weekdays: Weekday[];
  product: DessertProduct | null;
  warning: string | null;
};

function emptyDessertPane(): DessertPane {
  return {
    saved: null,
    draft: null,
    theme: "",
    weekdays: [...DEFAULT_DESSERT_DAYS],
    product: null,
    warning: null,
  };
}

function paneFromSaved(saved: WeekLunchDessert | null): DessertPane {
  if (!saved) return emptyDessertPane();
  return {
    saved,
    draft: null,
    theme: saved.theme,
    weekdays: saved.weekdays,
    product: saved.product ?? null,
    warning: null,
  };
}

export default function RepasScreen() {
  const { view, catalog } = useProfile();
  const { season, weather } = useSeasonWeather();
  const [tab, setTab] = useState<Tab>("plan");
  const [planQty, setPlanQty] = useState<QtyMode>("repas");
  const [batchQty, setBatchQty] = useState<QtyMode>("batch");
  const [weekStart, setWeekStart] = useState(() => mondayOf(todayISO()));
  const [plan, setPlan] = useState<PlannedMeal[]>(emptyWeekPlan);
  const [theme, setTheme] = useState("");
  const [nonce, setNonce] = useState(1);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  busyRef.current = busy;
  const [toast, setToast] = useState<string | null>(null);
  const [pickSlot, setPickSlot] = useState(false);
  const [swapMeal, setSwapMeal] = useState<PlannedMeal | null>(null);
  const [moveMeal, setMoveMeal] = useState<PlannedMeal | null>(null);
  const [openTag, setOpenTag] = useState<string | null>(null);
  const [openMealId, setOpenMealId] = useState<string | null>(null);
  const [planStamp, setPlanStamp] = useState<PlanTargetsSnapshot | null>(null);
  const [favorites, setFavorites] = useState<FavoriteRecipe[]>([]);
  const [rejected, setRejected] = useState<RejectedRecipe[]>([]);
  const [favPane, setFavPane] = useState<"favoris" | "plus-jamais">("favoris");
  const [openFavorite, setOpenFavorite] = useState<FavoriteRecipe | null>(null);
  const [placeFavorite, setPlaceFavorite] = useState<FavoriteRecipe | null>(null);
  const [openRejected, setOpenRejected] = useState<RejectedRecipe | null>(null);
  const [stock, setStock] = useState<HouseholdStock>(DEFAULT_STOCK);
  const [lunchDessert, setLunchDessert] = useState<WeekLunchDessert | null>(null);
  const [dinnerDessert, setDinnerDessert] = useState<WeekLunchDessert | null>(null);
  const [dessertSlot, setDessertSlot] = useState<DessertSlot>("midi");
  const [midiPane, setMidiPane] = useState<DessertPane>(emptyDessertPane);
  const [soirPane, setSoirPane] = useState<DessertPane>(emptyDessertPane);
  const [productReview, setProductReview] = useState<DessertProduct | null>(null);
  const [openDessert, setOpenDessert] = useState(false);
  const [inspoOffset, setInspoOffset] = useState(0);

  const dessertPane = dessertSlot === "soir" ? soirPane : midiPane;
  const setDessertPane = dessertSlot === "soir" ? setSoirPane : setMidiPane;

  function kitchenContext(opts?: { dessertDays?: Weekday[]; dessertBatch?: boolean; dessertSlot?: DessertSlot; product?: DessertProduct | null }) {
    const coach = nutritionCoach();
    if (opts?.dessertBatch) {
      const slot = opts.dessertSlot ?? dessertSlot;
      const aversions = `Aversions foyer (omets-les sans les nommer) : Alexis ${catalog.alexis.aversions.join(", ")} · Élodie ${catalog.elodie.aversions.join(", ")}.`;
      return [
        aversions,
        formatDessertBatchForPrompt(opts.dessertDays ?? dessertPane.weekdays, coach, slot),
        formatDessertProductForPrompt(opts.product ?? dessertPane.product),
        formatStockForPrompt(loadLocalStock()),
      ]
        .filter(Boolean)
        .join("\n\n");
    }
    const prefs = formatKitchenPrefsForPrompt(loadKitchenPrefs(), [catalog.alexis, catalog.elodie]);
    return [prefs, formatMealCoachForPrompt(coach), formatStockForPrompt(loadLocalStock())]
      .filter(Boolean)
      .join("\n\n");
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

  const reloadWeek = useCallback(
    async (opts?: { resetPanes?: boolean; soft?: boolean }) => {
      const loaded = await loadWeekPlan(weekStart);
      const [midi, soir] = await Promise.all([
        loadWeekLunchDessert(weekStart, "midi"),
        loadWeekLunchDessert(weekStart, "soir"),
      ]);
      const synced = applyCoachBoostsToLoadedPlan({
        weekStart,
        plan: loaded.plan,
        profiles: [
          { id: "alexis", deltas: currentNutritionDeltas(catalog.alexis.appliedAdjustments) },
          { id: "elodie", deltas: currentNutritionDeltas(catalog.elodie.appliedAdjustments) },
        ],
      });
      setPlan(synced.plan);
      if (!opts?.soft) setTheme(loaded.theme ?? "");
      setLunchDessert(midi);
      setDinnerDessert(soir);
      if (opts?.resetPanes) {
        setMidiPane(paneFromSaved(midi));
        setSoirPane(paneFromSaved(soir));
        setProductReview(null);
        setOpenDessert(false);
        setInspoOffset(0);
      }
      const coach = buildMealCoachFromProfiles(catalog.alexis, catalog.elodie);
      const hasMeals = synced.plan.some((meal) => !isEmptyMeal(meal));
      setPlanStamp(ensurePlanTargetsBaseline(weekStart, coach, hasMeals));
      if (synced.changed && !opts?.soft) {
        await saveWeekPlan(weekStart, synced.plan, loaded.theme);
      }
    },
    [weekStart, catalog.alexis, catalog.elodie],
  );

  useEffect(() => {
    let cancelled = false;
    void reloadWeek({ resetPanes: true }).then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [reloadWeek]);

  useEffect(() => {
    if (tab !== "courses") return;
    void reloadWeek({ soft: true });
  }, [tab, reloadWeek]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") void reloadWeek({ soft: true });
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [reloadWeek]);

  useEffect(() => {
    return subscribeWeekPlan(weekStart, () => {
      if (busyRef.current) return;
      void reloadWeek({ soft: true });
    });
  }, [weekStart, reloadWeek]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      if (busyRef.current) return;
      void reloadWeek({ soft: true });
    };
    const id = window.setInterval(tick, 4000);
    return () => window.clearInterval(id);
  }, [reloadWeek]);

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
    const dessertTitles = [
      lunchDessert?.meal.baseName,
      dinnerDessert?.meal.baseName,
      midiPane.draft?.baseName,
      soirPane.draft?.baseName,
    ].filter(Boolean) as string[];
    return mergeAvoidTitles([...recent, ...current, ...dessertTitles], rejected);
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
        const fresh = newlyGeneratedMeals(plan, result.plan);
        setTheme("");
        await persist(result.plan, "");
        const used = await consumeStockFromMeals(fresh);
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
      await persistWeekLunchDessert(weekStart, null, "midi");
      await persistWeekLunchDessert(weekStart, null, "soir");
      setLunchDessert(null);
      setDinnerDessert(null);
      setMidiPane(emptyDessertPane());
      setSoirPane(emptyDessertPane());
      setProductReview(null);
      await serveDessertToday("midi");
      await serveDessertToday("soir");
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
    const next = moveMealInPlan(plan, meal.id, target);
    await persist(next);
    setMoveMeal(null);
    if (openMealId === meal.id) {
      const dest = next.find((item) => item.dayIndex === target.dayIndex && item.mealType === target.mealType);
      if (dest) setOpenMealId(dest.id);
    }
    flash("Repas déplacé");
  }

  function openSlot(meal: PlannedMeal, tag: string) {
    setOpenMealId(meal.id);
    setOpenTag(tag);
  }

  function closeRecipe() {
    setOpenMealId(null);
    setOpenTag(null);
  }

  async function updateQuantities() {
    setBusy(true);
    try {
      await persist(scalePlanToGoals(plan, nutritionCoach()));
      if (lunchDessert) {
        const scaled: WeekLunchDessert = {
          ...lunchDessert,
          meal: stampDessertMeal(
            scaleDessertToGoals(lunchDessert.meal, nutritionCoach(), "midi", lunchDessert.product),
            lunchDessert.weekdays,
            lunchDessert.theme,
            "midi",
            lunchDessert.product,
          ),
        };
        setLunchDessert(scaled);
        setMidiPane((pane) => ({ ...pane, saved: scaled }));
        await persistWeekLunchDessert(weekStart, scaled, "midi");
      }
      if (dinnerDessert) {
        const scaled: WeekLunchDessert = {
          ...dinnerDessert,
          meal: stampDessertMeal(
            scaleDessertToGoals(dinnerDessert.meal, nutritionCoach(), "soir", dinnerDessert.product),
            dinnerDessert.weekdays,
            dinnerDessert.theme,
            "soir",
            dinnerDessert.product,
          ),
        };
        setDinnerDessert(scaled);
        setSoirPane((pane) => ({ ...pane, saved: scaled }));
        await persistWeekLunchDessert(weekStart, scaled, "soir");
      }
      stampTargets();
      flash("Quantités mises à jour · mêmes recettes");
    } finally {
      setBusy(false);
    }
  }

  async function serveDessertToday(slot: DessertSlot = dessertSlot) {
    if (weekStart !== mondayOf(todayISO())) return;
    const supabase = createBrowserSupabaseClient();
    if (!supabase) return;
    await applyTodaySlotTemplates(supabase, todayISO(), {
      replacePlan: true,
      slots: [slot === "soir" ? "dessert-soir" : "dessert-midi"],
    });
  }

  function dessertMealOnScreen() {
    const source = dessertPane.draft ?? dessertPane.saved?.meal;
    if (!source) return null;
    return stampDessertMeal(
      source,
      dessertPane.weekdays,
      dessertPane.theme || dessertPane.saved?.theme || "",
      dessertSlot,
      dessertPane.product,
    );
  }

  function dessertSwapRequest(meal: PlannedMeal) {
    const slot = dessertSlotOf(meal);
    const pane = slot === "soir" ? soirPane : midiPane;
    return {
      theme: pane.theme || meal.theme,
      dessert: meal,
      slotId: meal.id,
      kitchenContext: kitchenContext({
        dessertBatch: true,
        dessertDays: pane.weekdays,
        dessertSlot: slot,
        product: pane.product,
      }),
      nutritionCoach: nutritionCoach(),
      weekdays: pane.weekdays,
      dessertSlot: slot,
      dessertProduct: pane.product,
    };
  }

  async function persistDessertSwap(current: PlannedMeal, nextMeal: PlannedMeal, warning?: string) {
    const slot = dessertSlotOf(current);
    const pane = slot === "soir" ? soirPane : midiPane;
    const setPane = slot === "soir" ? setSoirPane : setMidiPane;
    const stamped = stampDessertMeal(
      scaleDessertToGoals(nextMeal, nutritionCoach(), slot, pane.product),
      pane.weekdays,
      pane.theme.trim() || nextMeal.theme || current.theme,
      slot,
      pane.product,
    );
    if (pane.draft) {
      setPane({ ...pane, draft: stamped, warning: warning ?? null });
      flash(warning ? `Dessert réadapté. ${warning}` : "Dessert réadapté");
      return;
    }
    const next: WeekLunchDessert = {
      weekdays: pane.weekdays,
      theme: pane.theme.trim() || stamped.theme,
      meal: stamped,
      product: pane.product,
      slot,
    };
    const error = await persistWeekLunchDessert(weekStart, next, slot);
    if (slot === "soir") setDinnerDessert(next);
    else setLunchDessert(next);
    setPane({ ...pane, saved: next, draft: null, warning: null });
    const used = await consumeStockFromMeals([stamped]);
    await serveDessertToday(slot);
    const stockNote = used.length ? ` · stock : ${used.map(formatStockItem).join(", ")}` : "";
    flash(
      error
        ? `Dessert réadapté en local · ${error}${stockNote}`
        : warning
          ? `Dessert réadapté. ${warning}${stockNote}`
          : `Dessert réadapté${stockNote}`,
    );
  }

  async function proposeDessert(themeOverride?: string) {
    const themeUsed = themeOverride !== undefined ? themeOverride : dessertPane.theme;
    if (themeOverride !== undefined) setDessertPane({ ...dessertPane, theme: themeOverride });
    setBusy(true);
    setDessertPane({ ...dessertPane, warning: null, theme: themeUsed });
    try {
      const pastMeals = await collectPastMeals();
      const result = await requestGenerateMeals({
        mode: "dessert-batch",
        theme: themeUsed,
        plan,
        nonce,
        coachBias: loadHouseholdCoachBias(),
        pastMeals,
        kitchenContext: kitchenContext({
          dessertBatch: true,
          dessertDays: dessertPane.weekdays,
          dessertSlot,
          product: dessertPane.product,
        }),
        nutritionCoach: nutritionCoach(),
        weekdays: dessertPane.weekdays,
        dessertSlot,
        dessertProduct: dessertPane.product,
      });
      if (result.dessert) {
        setDessertPane({
          ...dessertPane,
          theme: themeUsed,
          draft: stampDessertMeal(
            result.dessert,
            dessertPane.weekdays,
            themeUsed,
            dessertSlot,
            dessertPane.product,
          ),
          warning: result.warning ?? null,
        });
        setNonce((n) => n + 1);
        setOpenDessert(true);
      } else {
        flash(result.error ?? "Dessert impossible");
      }
    } catch (error) {
      flash(error instanceof Error ? error.message : "Dessert impossible");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDessert() {
    if (!dessertPane.draft || dessertPane.weekdays.length === 0) return;
    setBusy(true);
    try {
      const meal = stampDessertMeal(
        scaleDessertToGoals(dessertPane.draft, nutritionCoach(), dessertSlot, dessertPane.product),
        dessertPane.weekdays,
        dessertPane.theme,
        dessertSlot,
        dessertPane.product,
      );
      const next: WeekLunchDessert = {
        weekdays: dessertPane.weekdays,
        theme: dessertPane.theme.trim() || meal.theme,
        meal,
        product: dessertPane.product,
        slot: dessertSlot,
      };
      const error = await persistWeekLunchDessert(weekStart, next, dessertSlot);
      if (dessertSlot === "soir") setDinnerDessert(next);
      else setLunchDessert(next);
      setDessertPane({ ...dessertPane, saved: next, draft: null, warning: null });
      const used = await consumeStockFromMeals([meal]);
      await serveDessertToday(dessertSlot);
      const stockNote = used.length ? ` · stock : ${used.map(formatStockItem).join(", ")}` : "";
      const label = dessertSlot === "soir" ? "Dessert soir" : "Dessert midi";
      flash(error ? `Dessert en local · ${error}${stockNote}` : `${label} dans la semaine${stockNote}`);
    } finally {
      setBusy(false);
    }
  }

  async function removeDessert() {
    const label = dessertSlot === "soir" ? "dessert soir" : "dessert midi";
    if (!window.confirm(`Retirer le ${label} de cette semaine ?`)) return;
    await persistWeekLunchDessert(weekStart, null, dessertSlot);
    if (dessertSlot === "soir") setDinnerDessert(null);
    else setLunchDessert(null);
    setDessertPane(emptyDessertPane());
    setProductReview(null);
    setOpenDessert(false);
    await serveDessertToday(dessertSlot);
    flash(`${label.charAt(0).toUpperCase()}${label.slice(1)} retiré`);
  }

  async function changeDessertWeekdays(days: Weekday[]) {
    if (dessertPane.draft) {
      setDessertPane({
        ...dessertPane,
        weekdays: days,
        draft: stampDessertMeal(dessertPane.draft, days, dessertPane.theme, dessertSlot, dessertPane.product),
      });
      return;
    }
    if (!dessertPane.saved) {
      setDessertPane({ ...dessertPane, weekdays: days });
      return;
    }
    const next: WeekLunchDessert = {
      ...dessertPane.saved,
      weekdays: days,
      meal: stampDessertMeal(dessertPane.saved.meal, days, dessertPane.saved.theme, dessertSlot, dessertPane.product),
    };
    if (dessertSlot === "soir") setDinnerDessert(next);
    else setLunchDessert(next);
    setDessertPane({ ...dessertPane, saved: next, weekdays: days });
    await persistWeekLunchDessert(weekStart, next, dessertSlot);
    await serveDessertToday(dessertSlot);
  }

  async function pickDessertPhoto(file: File) {
    try {
      const product = await requestDessertProduct(file);
      setProductReview(product);
    } catch (error) {
      flash(error instanceof Error ? error.message : "Produit illisible");
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
    await markShoppingCheckedForNames(
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
  const suggestions = useMemo(() => {
    const prefs = loadKitchenPrefs();
    const avoid = [
      ...rejected.map((item) => item.title),
      ...rejected.map((item) => item.theme),
      ...plan.filter((meal) => !isEmptyMeal(meal)).flatMap((meal) => [meal.baseName, meal.theme]),
    ];
    return pickMealInspirations({
      weekStart,
      season,
      weather,
      prefs,
      profiles: [catalog.alexis, catalog.elodie],
      avoid,
      stockNames: stock.useStock ? stock.items.map((item) => item.name) : [],
      offset: inspoOffset,
    });
  }, [
    weekStart,
    season,
    weather,
    rejected,
    plan,
    stock,
    catalog.alexis,
    catalog.elodie,
    inspoOffset,
  ]);
  const openRecipe = (() => {
    if (openMealId) {
      const meal = plan.find((item) => item.id === openMealId);
      if (meal && !isEmptyMeal(meal)) {
        return { meal, tag: tags.get(meal.id) ?? openTag ?? "P1" };
      }
    }
    if (openTag) return recipes.find((row) => row.tag === openTag) ?? null;
    return null;
  })();
  const hasMeals = plan.some((meal) => !isEmptyMeal(meal));
  const targetsStale =
    hasMeals &&
    planStamp != null &&
    !snapshotsEqual(planStamp, snapshotFromCoach(nutritionCoach()));

  return (
    <div>
      <h1 className="text-[28px] font-bold tracking-tight">Repas</h1>
      <p className="mt-1 text-[13px] text-health-muted">
        Déjeuners & dîners de la semaine. Petit-déj et collations viennent des Réglages. Dessert midi
        maison : carte ci-dessous. Le plat du jour se sert sur Aujourd’hui.
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
            suggestions={suggestions}
            onShuffle={() => setInspoOffset((n) => n + 1)}
            busy={busy}
            canClear={plan.some((meal) => !isEmptyMeal(meal)) || Boolean(lunchDessert) || Boolean(dinnerDessert)}
            coachHint={`Portions selon Suivi : Alexis ${goalLabel(catalog.alexis.primaryGoal)} · Élodie ${goalLabel(catalog.elodie.primaryGoal)}. Même plat, grammes différents (sauf sauces).`}
            onGenerateWeekdays={() => void generate("weekdays")}
            onGenerateWeekend={() => void generate("weekend")}
            onGenerateSingle={() => setPickSlot(true)}
            onClearWeek={() => void clearWeek()}
          />

          <DessertBatchCard
            slot={dessertSlot}
            dessert={dessertPane.saved}
            draft={dessertPane.draft}
            theme={dessertPane.theme}
            weekdays={dessertPane.weekdays}
            product={dessertPane.product}
            review={productReview}
            busy={busy}
            warning={dessertPane.warning}
            onSlotChange={(next) => {
              setDessertSlot(next);
              setProductReview(null);
              setOpenDessert(false);
            }}
            onThemeChange={(value) => setDessertPane({ ...dessertPane, theme: value })}
            onWeekdaysChange={(days) => void changeDessertWeekdays(days)}
            onPickPhoto={(file) => void pickDessertPhoto(file)}
            onReviewChange={setProductReview}
            onKeepProduct={() => {
              if (!productReview) return;
              setDessertPane({ ...dessertPane, product: productReview });
              setProductReview(null);
            }}
            onClearProduct={() => {
              setProductReview(null);
              setDessertPane({ ...dessertPane, product: null });
            }}
            onPropose={() => void proposeDessert()}
            onConfirm={() => void confirmDessert()}
            onDiscardDraft={() => {
              setDessertPane({ ...dessertPane, draft: null, warning: null });
              setOpenDessert(false);
            }}
            onOpen={() => setOpenDessert(true)}
            onRemove={() => void removeDessert()}
          />

          <MenuSummary
            plan={plan}
            onSelect={(meal, tag) => openSlot(meal, tag)}
          />

          <WeekAgenda
            plan={plan}
            tags={tags}
            busy={busy}
            onOpen={(meal, tag) => openSlot(meal, tag)}
            onGenerate={(slotId) => void generate("single", slotId)}
            onMoveSlot={(fromId, target) => {
              const meal = plan.find((item) => item.id === fromId);
              if (meal) void moveMealTo(meal, target);
            }}
          />
        </div>
      )}

      {tab === "courses" && (
        <ShoppingListPanel
          weekStart={weekStart}
          plan={plan}
          dessert={lunchDessert}
          dinnerDessert={dinnerDessert}
        />
      )}

      {tab === "batch" && (
        <div className="mt-2">
          <MenuSummary
            plan={plan}
            onSelect={(_meal, tag) => {
              setOpenMealId(null);
              setOpenTag(tag);
            }}
          />
          <QtyScaleToggle mode={batchQty} onChange={setBatchQty} />
          <BatchGuidePanel
            weekStart={weekStart}
            plan={plan}
            qtyMode={batchQty}
            onOpenRecipe={(tag) => {
              setOpenMealId(null);
              setOpenTag(tag);
            }}
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
            if (isWeekLunchDessert(swapMeal)) {
              try {
                const result = await requestGenerateMeals({
                  mode: "suggest-swap",
                  ...dessertSwapRequest(swapMeal),
                  ingredientId,
                  ingredientName,
                });
                if (result.suggestions && result.suggestions.length >= 3) return result.suggestions;
              } catch {
                /* fallback local */
              }
              return mockSuggestDessertSwap(ingredientName, swapMeal);
            }
            try {
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
              if (result.suggestions && result.suggestions.length >= 3) return result.suggestions.slice(0, 3);
            } catch {
              /* fallback local */
            }
            return mockSuggestSwap(ingredientName, swapMeal);
          }}
          onPick={async (ingredientId, replacement) => {
            setBusy(true);
            try {
              if (isWeekLunchDessert(swapMeal)) {
                const ingredient = swapMeal.ingredients.find((item) => item.id === ingredientId);
                const result = await requestGenerateMeals({
                  mode: "apply-swap",
                  ...dessertSwapRequest(swapMeal),
                  ingredientId,
                  ingredientName: ingredient?.name,
                  replacement,
                });
                if (result.dessert) {
                  await persistDessertSwap(swapMeal, result.dessert, result.warning);
                  setSwapMeal(null);
                } else {
                  flash(result.error ?? "Échange impossible");
                }
                return;
              }
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
                const fresh = newlyGeneratedMeals(plan, result.plan);
                await persist(result.plan);
                const used = await consumeStockFromMeals(fresh);
                const stockNote = used.length
                  ? ` · stock : ${used.map(formatStockItem).join(", ")}`
                  : "";
                flash(
                  result.warning
                    ? `Recette réadaptée. ${result.warning}${stockNote}`
                    : `Recette réadaptée · Gemini Pro${stockNote}`,
                );
                setSwapMeal(null);
              } else {
                flash(result.error ?? "Échange impossible");
              }
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
          onClose={closeRecipe}
          currentTheme={theme}
          onRegenerate={(regenTheme) => void generate("single", openRecipe.meal.id, regenTheme)}
          onSwapIngredient={() => setSwapMeal(openRecipe.meal)}
          onDelete={() => {
            void deleteMeal(openRecipe.meal);
            closeRecipe();
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

      {openDessert && (dessertPane.draft || dessertPane.saved) ? (
        <RecipeDetailSheet
          meal={stampDessertMeal(
            (dessertPane.draft ?? dessertPane.saved!.meal),
            dessertPane.weekdays,
            dessertPane.theme || dessertPane.saved?.theme || "",
            dessertSlot,
            dessertPane.product,
          )}
          planTag={dessertTagOf(dessertSlot)}
          view={view}
          busy={busy}
          qtyMode={planQty}
          onQtyMode={setPlanQty}
          onClose={() => setOpenDessert(false)}
          currentTheme={dessertPane.theme}
          onRegenerate={(regenTheme) => {
            setOpenDessert(false);
            void proposeDessert(regenTheme);
          }}
          onSwapIngredient={() => {
            const meal = dessertMealOnScreen();
            if (meal) setSwapMeal(meal);
          }}
          onDelete={() => void removeDessert()}
        />
      ) : null}

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
