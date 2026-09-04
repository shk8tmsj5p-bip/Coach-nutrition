"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Camera,
  Check,
  Clock,
  Copy,
  History,
  RefreshCw,
  RotateCcw,
  ScanBarcode,
  Sparkles,
  X,
} from "lucide-react";
import { useProfile } from "@/context/ProfileContext";
import { CopyYesterdaySheet } from "@/components/today/CopyYesterdaySheet";
import { MealHistorySheet } from "@/components/repas/MealHistorySheet";
import { RecentsSheet } from "@/components/today/RecentsSheet";
import { EditMealSheet } from "@/components/today/EditMealSheet";
import { MoveMealSheet } from "@/components/repas/MoveMealSheet";
import { LogSheet } from "@/components/today/LogSheet";
import { SwapProposalSheet } from "@/components/today/SwapProposalSheet";
import { TodayPlannedCard } from "@/components/today/TodayPlannedCard";
import { TodayDayCoach } from "@/components/today/TodayDayCoach";
import { FavoriteHeart } from "@/components/today/FavoriteHeart";
import { RejectMealButton } from "@/components/today/RejectMealButton";
import { HealthMetricTile } from "@/components/today/HealthMetricTile";
import { TodayEnergyCard } from "@/components/today/TodayEnergyCard";
import { CoachBadge, CoachDiffTags, CoachMealAddTags, coachHighlightClass } from "@/components/today/CoachDelta";
import { Card, SectionTitle } from "@/components/ui/Card";
import { GoalBadge } from "@/components/ui/MacroProgress";
import { formatLongDate, isoWeekday, mondayOf, todayISO, yesterdayISO, addDaysISO } from "@/lib/dates";
import {
  suggestedSnacks,
  todayMeals,
  todayMovement,
  todayWorkouts,
} from "@/lib/mock-data";
import {
  templateForSlot,
  isDessertItemLine,
  isEmptyDessertMarker,
  dessertDisplayName,
  appendPlatKeepingDessert,
  withDessertPrefix,
} from "@/lib/meal-templates";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { profileIdsForView } from "@/lib/supabase/filters";
import { fetchTodayActivity } from "@/lib/supabase/health-logs";
import { ensureDemoMeals } from "@/lib/supabase/seed-today";
import { formatDetectedLine, macrosFromIngredients, parseFoodTextLocal } from "@/lib/food-log";
import {
  recentFoodLine,
  recentFoodsFromMeals,
  recentFoodToDetected,
  type DatedMeal,
  type RecentFood,
} from "@/lib/recent-foods";
import { withGeminiWait } from "@/lib/gemini/wait";
import { requestCoachQuickAdd } from "@/lib/gemini/client";
import {
  copyYesterdayMeals,
  fetchMealsRange,
  fetchRecentLoggedMeals,
  fetchTodayMeals,
  fillMissingSlotsFromTemplates,
  insertMeal,
  isStoredMealId,
  plannedMealEntry,
  restorePlannedMeals,
  applyWeekPlatsToToday,
  applyTodaySlotTemplates,
  persistReclassifiedMeal,
  setMealSkipped,
  swapMeal,
  upsertMeal,
} from "@/lib/supabase/today-data";
import { loadWeekPlan, saveWeekPlan } from "@/lib/supabase/week-plans";
import { loadWeekLunchDessert, type WeekLunchDessert } from "@/lib/week-dessert";
import { clearDailyFeel, fetchTodayFeels, upsertDailyFeel } from "@/lib/supabase/daily-feel";
import { emptyFeel, hasCompleteFeel, hasFeelScore, type DailyFeelScores } from "@/lib/daily-feel";
import { todayCoachRemark, buildTodayCoachSnapshot } from "@/lib/today-coach";
import {
  applySlotMoveToMeals,
  isFilledMeal,
  occupantOfSlot,
  slotOfProfile,
  slotTime,
} from "@/lib/meal-slot";
import { coupleLunchStreak } from "@/lib/couple-streak";
import {
  buildTodayCatSnapshot,
  mealsAccountedToday,
  pickTodayCatLine,
  todaySessionFlags,
} from "@/lib/today-cat";
import { SESSION_VALIDATIONS_EVENT } from "@/lib/strava-match";
import { mergeLoggedWorkouts } from "@/lib/today-sport";
import { TodayCatBanner } from "@/components/today/TodayCatBanner";
import { TodayDelight } from "@/components/today/TodayDelight";
import { FeelStickerRow } from "@/components/ui/FeelStickerRow";
import { FEEL_AXIS_HINTS, FEEL_AXIS_LABELS, type CatFeelMood } from "@/lib/cat-feel";
import { useSeasonWeather } from "@/context/SeasonContext";
import type { FavoriteRecipe } from "@/lib/favorites";
import {
  canFavoriteMeal,
  favoriteIdFromTitle,
  isFavoriteTitle,
  removeFavorite,
  upsertFavorite,
} from "@/lib/favorites";
import { loadFavorites, persistFavorites } from "@/lib/supabase/favorites";
import type { RejectedRecipe } from "@/lib/rejected";
import {
  canRejectMeal,
  isRejectedTitle,
  removeRejected,
  upsertRejected,
} from "@/lib/rejected";
import { loadRejected, persistRejected } from "@/lib/supabase/rejected";
import {
  fillMissingPlatsFromWeekPlan,
  isServingThisWeekPlat,
  plannedMealForDay,
  weekPlanSlotId,
} from "@/lib/serve-week-plan";
import {
  historyFromDessert,
  historyFromFavorites,
  historyFromPlan,
  mergeMealHistory,
  todayMealFromHistory,
  type HistoryKind,
  type MealHistoryItem,
} from "@/lib/meal-history";
import { loadMealHistory } from "@/lib/supabase/meal-history";
import { isEmptyMeal, moveMealInPlan } from "@/lib/weekly-plan";
import { storage } from "@/lib/storage";
import type {
  DailyMovement,
  DetectedIngredient,
  DietType,
  Macros,
  MealEntry,
  MealType,
  PlannedMeal,
  Profile,
  ProfileId,
  Workout,
} from "@/lib/types";
import { sanitizeRestingKcal } from "@/lib/health-energy";
import { macroStatus, slotCalorieTarget, TONE_TEXT } from "@/lib/macro-status";
import { cn, formatKcal, formatKm, formatMin, formatSteps, mealTypeLabel } from "@/lib/utils";
import {
  acceptNutritionAdds,
  dismissNutrition,
  quickAddKey,
  upsertNutritionQuickAdd,
  visibleNutrition,
} from "@/lib/coach-adjustments";
import {
  applyCoachAddsToMeal,
  collectDayBadges,
  translateMealAdjustments,
  type CoachAddChoice,
  type MacroKind,
  type MealIngredientView,
} from "@/lib/coach-ingredients";

const MEAL_SLOTS: MealType[] = ["petit-dejeuner", "dejeuner", "collation", "diner"];
const ALL_MEAL_SLOTS: MealType[] = MEAL_SLOTS;

function weekSlotForToday(
  plan: PlannedMeal[],
  type: "dejeuner" | "diner",
  date = todayISO(),
) {
  const id = weekPlanSlotId(date, type);
  return (
    plan.find((item) => item.id === id) ??
    plan.find((item) => item.dayIndex === isoWeekday(date) - 1 && item.mealType === type) ??
    null
  );
}

function weekHasOtherPlats(plan: PlannedMeal[], currentId?: string) {
  return plan.some((item) => item.id !== currentId && !isEmptyMeal(item));
}

const HOUSEHOLD_IDS: ProfileId[] = ["alexis", "elodie"];

function otherProfileId(id: ProfileId): ProfileId {
  return id === "alexis" ? "elodie" : "alexis";
}

function profileShortName(id: ProfileId) {
  return id === "alexis" ? "Alexis" : "Élodie";
}

function yesterdayHasSlot(yesterdayMeals: MealEntry[], profileId: ProfileId, type: MealType) {
  return yesterdayMeals.some(
    (meal) => meal.profileId === profileId && meal.type === type && isFilledMeal(meal),
  );
}

function isTemplateSlot(meal: MealEntry | undefined) {
  return Boolean(meal && meal.source === "plan");
}

function mealFields(meal: Omit<MealEntry, "id" | "profileId"> | MealEntry): Omit<MealEntry, "id" | "profileId"> {
  return {
    name: meal.name,
    type: meal.type,
    time: meal.time,
    macros: meal.macros,
    source: meal.source,
    items: meal.items,
    notes: meal.notes,
    isSkipped: meal.isSkipped,
  };
}

function emptyMovement(date = todayISO()): Record<ProfileId, DailyMovement> {
  return {
    alexis: {
      date,
      profileId: "alexis",
      steps: 0,
      activeEnergyKcal: 0,
      restingEnergyKcal: 0,
      workoutMinutes: 0,
      distanceKm: 0,
      cyclingDistanceKm: 0,
      source: "apple-health",
    },
    elodie: {
      date,
      profileId: "elodie",
      steps: 0,
      activeEnergyKcal: 0,
      restingEnergyKcal: 0,
      workoutMinutes: 0,
      distanceKm: 0,
      cyclingDistanceKm: 0,
      source: "apple-health",
    },
  };
}

function defaultMealTime(type: MealType) {
  return slotTime(type);
}

function emptyMacros(): Macros {
  return { calories: 0, protein: 0, carbs: 0, fat: 0 };
}

function sumMacros(meals: MealEntry[]): Macros {
  return meals
    .filter((meal) => !meal.isSkipped)
    .reduce(
      (acc, meal) => ({
        calories: acc.calories + meal.macros.calories,
        protein: acc.protein + meal.macros.protein,
        carbs: acc.carbs + meal.macros.carbs,
        fat: acc.fat + meal.macros.fat,
      }),
      emptyMacros(),
    );
}

type LogMode = "text" | "barcode" | "photo" | null;
type SyncStatus = "loading" | "seeded" | "ready" | "offline" | "error";

export default function AujourdhuiScreen() {
  const { activeProfiles, view, catalog } = useProfile();
  const { season, weather } = useSeasonWeather();
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [ratings, setRatings] = useState<Record<ProfileId, DailyFeelScores>>({
    alexis: emptyFeel(),
    elodie: emptyFeel(),
  });
  const [logMode, setLogMode] = useState<LogMode>(null);
  const [addSlot, setAddSlot] = useState<{ profileId: ProfileId; type: MealType } | null>(null);
  const [logMealType, setLogMealType] = useState<MealType | null>(null);
  const [logProfile, setLogProfile] = useState<ProfileId>("alexis");
  const [textInput, setTextInput] = useState("");
  const [ingredients, setIngredients] = useState<DetectedIngredient[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [status, setStatus] = useState<SyncStatus>("loading");
  const [statusDetail, setStatusDetail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingMeal, setEditingMeal] = useState<MealEntry | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [swapOpen, setSwapOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [yesterdayMeals, setYesterdayMeals] = useState<MealEntry[]>([]);
  const [recentMeals, setRecentMeals] = useState<DatedMeal[]>([]);
  const [recentsOpen, setRecentsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState<MealHistoryItem[]>([]);
  const [historyKind, setHistoryKind] = useState<HistoryKind>("plat");
  const [historyForEdit, setHistoryForEdit] = useState<MealHistoryItem | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [movement, setMovement] = useState<Record<ProfileId, DailyMovement>>(emptyMovement);
  const [weekPlan, setWeekPlan] = useState<PlannedMeal[]>([]);
  const [weekTheme, setWeekTheme] = useState("");
  const [swapWeekMeal, setSwapWeekMeal] = useState<PlannedMeal | null>(null);
  const [lunchDessert, setLunchDessert] = useState<WeekLunchDessert | null>(null);
  const [dinnerDessert, setDinnerDessert] = useState<WeekLunchDessert | null>(null);
  const [favorites, setFavorites] = useState<FavoriteRecipe[]>([]);
  const [rejected, setRejected] = useState<RejectedRecipe[]>([]);
  const [streakMeals, setStreakMeals] = useState<Array<MealEntry & { date?: string }>>([]);
  const [sessionTick, setSessionTick] = useState(0);

  function flash(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2200);
  }

  useEffect(() => {
    const bump = () => setSessionTick((n) => n + 1);
    window.addEventListener(SESSION_VALIDATIONS_EVENT, bump);
    return () => window.removeEventListener(SESSION_VALIDATIONS_EVENT, bump);
  }, []);

  async function persistFeel(profileId: ProfileId, key: "hunger" | "energy" | "fatigue", value: CatFeelMood) {
    const next = { ...(ratings[profileId] ?? emptyFeel()), [key]: value };
    setRatings((prev) => ({ ...prev, [profileId]: next }));
    const error = await upsertDailyFeel(createBrowserSupabaseClient(), profileId, todayISO(), next);
    if (error) flash(error);
  }

  async function validateFeel(profileId: ProfileId) {
    const next = { ...(ratings[profileId] ?? emptyFeel()), validated: true };
    setRatings((prev) => ({ ...prev, [profileId]: next }));
    const error = await upsertDailyFeel(createBrowserSupabaseClient(), profileId, todayISO(), next);
    if (error) flash(error);
  }

  async function resetFeel(profileId: ProfileId) {
    setRatings((prev) => ({ ...prev, [profileId]: emptyFeel() }));
    const error = await clearDailyFeel(createBrowserSupabaseClient(), profileId, todayISO());
    if (error) flash(error);
  }

  const householdTemplates = useMemo(
    () => ({
      alexis: catalog.alexis.mealTemplates,
      elodie: catalog.elodie.mealTemplates,
    }),
    [catalog.alexis.mealTemplates, catalog.elodie.mealTemplates],
  );

  useEffect(() => {
    void (async () => {
      const [favs, bans] = await Promise.all([loadFavorites(), loadRejected()]);
      setFavorites(favs);
      setRejected(bans);
    })();
  }, []);

  async function toggleFavorite(recipe: PlannedMeal) {
    if (!canFavoriteMeal(recipe)) return;
    const on = isFavoriteTitle(favorites, recipe.baseName);
    const next = on
      ? removeFavorite(favorites, favoriteIdFromTitle(recipe.baseName))
      : upsertFavorite(favorites, recipe);
    setFavorites(next);
    const error = await persistFavorites(next);
    if (!on && isRejectedTitle(rejected, recipe.baseName)) {
      const nextRejected = removeRejected(rejected, favoriteIdFromTitle(recipe.baseName));
      setRejected(nextRejected);
      await persistRejected(nextRejected);
    }
    if (error) flash(`Favoris en local · ${error}`);
    else flash(on ? "Retiré des favoris" : "Gardé en favori");
  }

  async function toggleRejected(recipe: PlannedMeal) {
    if (!canRejectMeal(recipe)) return;
    const on = isRejectedTitle(rejected, recipe.baseName);
    const next = on
      ? removeRejected(rejected, favoriteIdFromTitle(recipe.baseName))
      : upsertRejected(rejected, recipe);
    setRejected(next);
    const error = await persistRejected(next);
    if (!on && isFavoriteTitle(favorites, recipe.baseName)) {
      const nextFav = removeFavorite(favorites, favoriteIdFromTitle(recipe.baseName));
      setFavorites(nextFav);
      await persistFavorites(nextFav);
    }
    if (error) flash(`Plus jamais en local · ${error}`);
    else flash(on ? "Retiré de Plus jamais" : "Plus jamais ce plat");
  }

  const reload = useCallback(async () => {
    const supabase = createBrowserSupabaseClient();
    const ids = profileIdsForView(view);
    const date = todayISO();
    const [{ plan, theme }, dessert, evening] = await Promise.all([
      loadWeekPlan(mondayOf(date)),
      loadWeekLunchDessert(mondayOf(date), "midi"),
      loadWeekLunchDessert(mondayOf(date), "soir"),
    ]);
    setWeekPlan(plan);
    setWeekTheme(theme);
    setLunchDessert(dessert);
    setDinnerDessert(evening);
    const feels = await fetchTodayFeels(supabase, ids);
    setRatings({
      alexis: feels.alexis,
      elodie: feels.elodie,
    });

    const withTemplatesAndPlan = (rows: MealEntry[], createMissing: boolean) =>
      fillMissingPlatsFromWeekPlan(
        fillMissingSlotsFromTemplates(rows, HOUSEHOLD_IDS, date, householdTemplates, {
          createMissing,
          lunchDessert: dessert,
          dinnerDessert: evening,
        }),
        plan,
        HOUSEHOLD_IDS,
        date,
      );

    if (!supabase) {
      setMeals(withTemplatesAndPlan(todayMeals, true));
      setWorkouts(todayWorkouts.filter((workout) => ids.includes(workout.profileId)));
      setMovement(todayMovement);
      setStreakMeals(todayMeals.map((meal) => ({ ...meal, date })));
      setStatus("offline");
      setStatusDetail("Supabase non configuré — mock local");
      return;
    }

    const seed = await ensureDemoMeals(supabase);
    if (!seed.ok) {
      setMeals(withTemplatesAndPlan(todayMeals, true));
      setWorkouts(todayWorkouts.filter((workout) => ids.includes(workout.profileId)));
      setMovement(todayMovement);
      setStatus("error");
      setStatusDetail(seed.error ?? "Échec seed / lecture");
      return;
    }

    const [{ meals: rows, error }, activity, yest, recents, range] = await Promise.all([
      fetchTodayMeals(supabase, HOUSEHOLD_IDS),
      fetchTodayActivity(supabase, ids),
      fetchTodayMeals(supabase, HOUSEHOLD_IDS, yesterdayISO()),
      fetchRecentLoggedMeals(supabase, HOUSEHOLD_IDS),
      fetchMealsRange(supabase, HOUSEHOLD_IDS, addDaysISO(date, -20), date),
    ]);

    if (error) {
      setStatus("error");
      setStatusDetail(error);
      return;
    }

    setMeals(withTemplatesAndPlan(rows, false));
    setYesterdayMeals((yest.meals ?? []).filter((meal) => !meal.isSkipped));
    setRecentMeals(recents.meals ?? []);
    setStreakMeals(range.meals ?? []);
    setWorkouts(activity.workouts);
    setMovement(activity.movement);
    setStatus(seed.seeded ? "seeded" : "ready");
    setStatusDetail(seed.seeded ? "Journée à jour (templates + plan)" : "Lecture filtrée par profile_id");
  }, [view, householdTemplates]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function persistTargets(profileId: ProfileId): ProfileId[] {
    return view === "couple" ? HOUSEHOLD_IDS : [profileId];
  }

  function applyLocalSlot(
    prev: MealEntry[],
    profileId: ProfileId,
    payload: Omit<MealEntry, "id" | "profileId">,
    matchType: MealType,
  ) {
    const existing = slotOfProfile(prev, profileId, matchType);
    const row: MealEntry = {
      ...payload,
      profileId,
      id: existing?.id ?? `${profileId}-${payload.type}-${Date.now()}`,
      isSkipped: payload.isSkipped ?? false,
    };
    if (existing) {
      return prev.map((meal) => (meal.id === existing.id ? row : meal));
    }
    return [...prev, row];
  }

  async function writeSlot(
    profileId: ProfileId,
    payload: Omit<MealEntry, "id" | "profileId">,
    matchType = payload.type,
  ) {
    const existing = slotOfProfile(meals, profileId, matchType);
    const entry: Omit<MealEntry, "id"> = { ...payload, profileId };
    const supabase = createBrowserSupabaseClient();
    if (!supabase) return;
    if (existing && isStoredMealId(existing.id)) {
      return upsertMeal(supabase, { ...existing, ...entry, id: existing.id });
    }
    return insertMeal(supabase, entry);
  }

  async function writeSlots(
    profileIds: ProfileId[],
    payload: Omit<MealEntry, "id" | "profileId">,
    matchType = payload.type,
  ) {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setMeals((prev) => {
        let next = prev;
        for (const id of profileIds) {
          next = applyLocalSlot(next, id, payload, matchType);
        }
        return next;
      });
      return true;
    }
    for (const id of profileIds) {
      const error = await writeSlot(id, payload, matchType);
      if (error) {
        flash(error);
        return false;
      }
    }
    await reload();
    return true;
  }

  async function persistMeal(profileId: ProfileId, meal: Omit<MealEntry, "id" | "profileId">) {
    await writeSlots(persistTargets(profileId), meal);
  }

  async function persistLoggedFood(
    source: "text" | "photo" | "barcode",
    payload: { name: string; macros: Macros; items: string[] },
  ): Promise<boolean> {
    if (!logMealType) return false;
    const type = logMealType;
    const targets = persistTargets(logProfile);
    const supabase = createBrowserSupabaseClient();

    const mergedFor = (profileId: ProfileId): Omit<MealEntry, "id" | "profileId"> => {
      const existing = slotOfProfile(meals, profileId, type);
      if (!existing || existing.isSkipped) {
        return {
          name: payload.name,
          type,
          time: defaultMealTime(type),
          macros: payload.macros,
          source,
          items: payload.items,
          isSkipped: false,
        };
      }
      return {
        name: existing.name,
        type,
        time: existing.time || defaultMealTime(type),
        macros: {
          calories: existing.macros.calories + payload.macros.calories,
          protein: existing.macros.protein + payload.macros.protein,
          carbs: existing.macros.carbs + payload.macros.carbs,
          fat: existing.macros.fat + payload.macros.fat,
        },
        source: existing.source === "plan" ? source : (existing.source ?? source),
        items: appendPlatKeepingDessert(existing.items, payload.items),
        notes: existing.notes,
        isSkipped: false,
      };
    };

    if (!supabase) {
      setMeals((prev) => {
        let next = prev;
        for (const id of targets) {
          next = applyLocalSlot(next, id, mergedFor(id), type);
        }
        return next;
      });
      return true;
    }

    for (const id of targets) {
      const error = await writeSlot(id, mergedFor(id), type);
      if (error) {
        flash(error);
        return false;
      }
    }
    await reload();
    return true;
  }

  function closeLog() {
    setLogMode(null);
    setAddSlot(null);
    setLogMealType(null);
    setTextInput("");
    setRecentsOpen(false);
    setHistoryOpen(false);
  }

  function startLog(
    profileId: ProfileId,
    type: MealType,
    mode: Exclude<LogMode, null> | "recent" | "history" | "history-dessert",
  ) {
    setAddSlot(null);
    const keepEdit = mode === "history" || mode === "history-dessert";
    if (!keepEdit) setEditingMeal(null);
    setLogProfile(profileId);
    setLogMealType(type);
    if (mode === "recent") {
      setRecentsOpen(true);
      return;
    }
    if (keepEdit) {
      void openMealHistory(mode === "history-dessert" ? "dessert" : "plat");
      return;
    }
    setLogMode(mode);
    setTextInput("");
    setIngredients([]);
  }

  async function openMealHistory(kind: HistoryKind = "plat") {
    setHistoryKind(kind);
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const remote = await loadMealHistory();
      const weekStart = mondayOf(todayISO());
      setHistoryItems(
        mergeMealHistory([
          remote,
          historyFromPlan(weekPlan, weekStart, weekTheme),
          historyFromDessert(lunchDessert, weekStart) ? [historyFromDessert(lunchDessert, weekStart)!] : [],
          historyFromDessert(dinnerDessert, weekStart) ? [historyFromDessert(dinnerDessert, weekStart)!] : [],
          historyFromFavorites(favorites),
        ]),
      );
    } catch {
      setHistoryItems(
        mergeMealHistory([
          historyFromPlan(weekPlan, mondayOf(todayISO()), weekTheme),
          historyFromFavorites(favorites),
        ]),
      );
    } finally {
      setHistoryLoading(false);
    }
  }

  async function applyHistoryItem(item: MealHistoryItem) {
    if (editingMeal) {
      setHistoryForEdit(item);
      setHistoryOpen(false);
      flash(item.kind === "dessert" ? "Dessert dans la fiche — Enregistrer pour garder" : "Plat dans la fiche — Enregistrer pour garder");
      return;
    }
    if (!logMealType) {
      flash("Choisis d’abord un repas");
      return;
    }
    const type = logMealType;
    const targets = persistTargets(logProfile);
    const supabase = createBrowserSupabaseClient();
    setBusy(true);
    try {
      if (!supabase) {
        setMeals((prev) => {
          let next = prev;
          for (const id of targets) {
            const payload = todayMealFromHistory(item, id, type, slotOfProfile(next, id, type));
            next = applyLocalSlot(next, id, payload, type);
          }
          return next;
        });
      } else {
        for (const id of targets) {
          const payload = todayMealFromHistory(item, id, type, slotOfProfile(meals, id, type));
          const error = await writeSlot(id, payload, type);
          if (error) {
            flash(error);
            return;
          }
        }
        await reload();
      }
      setHistoryOpen(false);
      closeLog();
      flash(
        targets.length > 1
          ? item.kind === "dessert"
            ? "Dessert posé pour Alexis et Élodie"
            : "Plat posé pour Alexis et Élodie"
          : item.kind === "dessert"
            ? "Dessert repris"
            : "Plat repris",
      );
    } finally {
      setBusy(false);
    }
  }

  async function persistRecentFood(food: RecentFood) {
    if (busy) return;
    setBusy(true);
    try {
      const detected = recentFoodToDetected(food);
      const line = recentFoodLine(food);
      const dessertSlot = logMealType === "dejeuner" || logMealType === "diner";
      const ok = await persistLoggedFood("text", {
        name: food.name,
        macros: {
          calories: detected.calories,
          protein: detected.protein,
          carbs: detected.carbs ?? 0,
          fat: detected.fat ?? 0,
        },
        items: food.fromDessert && dessertSlot ? [withDessertPrefix(line)] : [line],
      });
      if (!ok) return;
      setRecentsOpen(false);
      flash("Aliment ajouté");
    } finally {
      setBusy(false);
    }
  }

  async function copyYesterdayFromSlot(profileId: ProfileId, type: MealType) {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      flash("Supabase non configuré");
      return;
    }
    setBusy(true);
    const result = await copyYesterdayMeals(supabase, persistTargets(profileId), [type]);
    setBusy(false);
    if (result.error) {
      flash(result.error);
      return;
    }
    if (result.copied === 0) {
      flash("Rien à copier pour hier");
      return;
    }
    await reload();
    flash(type === "collation" ? "Collation d’hier copiée" : "Petit-déj d’hier copié");
  }

  async function toggleSkip(meal: MealEntry) {
    const nextSkipped = !meal.isSkipped;
    const targets = persistTargets(meal.profileId);
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setMeals((prev) => {
        let next = prev;
        for (const id of targets) {
          const existing = slotOfProfile(next, id, meal.type);
          if (existing) {
            next = next.map((row) =>
              row.id === existing.id ? { ...row, isSkipped: nextSkipped } : row,
            );
          } else {
            next = applyLocalSlot(
              next,
              id,
              {
                name: "Repas sauté",
                type: meal.type,
                time: "",
                macros: emptyMacros(),
                source: "log",
                items: [],
                isSkipped: nextSkipped,
              },
              meal.type,
            );
          }
        }
        return next;
      });
      return;
    }
    for (const id of targets) {
      const existing = slotOfProfile(meals, id, meal.type);
      if (existing && isStoredMealId(existing.id)) {
        const error = await setMealSkipped(supabase, existing.id, nextSkipped);
        if (error) {
          flash(error);
          return;
        }
        continue;
      }
      const error = await writeSlot(
        id,
        {
          ...mealFields(existing ?? meal),
          name: existing?.name ?? (nextSkipped ? "Repas sauté" : meal.name),
          macros: existing?.macros ?? (nextSkipped ? emptyMacros() : meal.macros),
          isSkipped: nextSkipped,
        },
        meal.type,
      );
      if (error) {
        flash(error);
        return;
      }
    }
    await reload();
  }

  async function skipEmptySlot(profileId: ProfileId, type: MealType) {
    await persistMeal(profileId, {
      name: "Repas sauté",
      type,
      time: "",
      macros: emptyMacros(),
      source: "log",
      items: [],
      isSkipped: true,
    });
  }

  async function onSwap() {
    const hasMeal = meals.some(
      (meal) => profileIdsForView(view).includes(meal.profileId) && !meal.isSkipped,
    );
    if (!hasMeal) {
      flash("Aucun repas à remplacer aujourd'hui");
      return;
    }
    setSwapOpen(true);
  }

  async function confirmSwap(
    mealType: MealType,
    proposals: Parameters<typeof swapMeal>[3],
  ) {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      flash("Supabase non configuré");
      return;
    }
    setBusy(true);
    const result = await swapMeal(supabase, profileIdsForView(view), mealType, proposals);
    setBusy(false);
    if (result.error) {
      flash(result.error);
      return;
    }
    if (result.swapped === 0) {
      flash("Aucun repas à remplacer");
      return;
    }
    setSwapOpen(false);
    await reload();
    flash("Repas remplacé");
  }

  async function onCopyYesterday() {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      flash("Supabase non configuré");
      return;
    }
    setBusy(true);
    const result = await fetchTodayMeals(
      supabase,
      profileIdsForView(view),
      yesterdayISO(),
    );
    setBusy(false);
    if (result.error) {
      flash(result.error);
      return;
    }
    const available = result.meals.filter((meal) => !meal.isSkipped);
    if (available.length === 0) {
      flash("Rien à copier pour hier");
      return;
    }
    setYesterdayMeals(available);
    setCopyOpen(true);
  }

  async function confirmCopyYesterday(types: MealType[]) {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      flash("Supabase non configuré");
      return;
    }
    setBusy(true);
    const result = await copyYesterdayMeals(supabase, profileIdsForView(view), types);
    setBusy(false);
    if (result.error) {
      flash(result.error);
      return;
    }
    if (result.copied === 0) {
      flash("Rien à copier pour hier");
      return;
    }
    setCopyOpen(false);
    await reload();
    flash(
      result.copied === 1
        ? "1 repas d'hier copié"
        : `${result.copied} repas d'hier copiés`,
    );
  }

  async function persistEditedMeal(next: MealEntry) {
    const source = meals.find((meal) => meal.id === next.id) ?? editingMeal;
    if (!source) return;
    const targets = persistTargets(next.profileId);
    setSavingEdit(true);
    if (source.type === next.type) {
      const ok = await writeSlots(targets, mealFields(next), source.type);
      setSavingEdit(false);
      if (!ok) return;
      setEditingMeal(null);
      flash(
        targets.length > 1
          ? "Repas enregistré pour Alexis et Élodie"
          : "Repas enregistré",
      );
      return;
    }
    const supabase = createBrowserSupabaseClient();
    const payloadFields = { ...mealFields(next), time: slotTime(next.type) };
    if (!supabase) {
      setMeals((prev) => {
        let result = prev;
        for (const id of targets) {
          const original = slotOfProfile(result, id, source.type);
          if (!original) continue;
          result = applySlotMoveToMeals(result, original, {
            ...original,
            ...payloadFields,
            id: original.id,
            profileId: id,
            type: next.type,
          });
        }
        return result;
      });
      setSavingEdit(false);
      setEditingMeal(null);
      flash(targets.length > 1 ? "Créneaux mis à jour pour les deux" : "Créneau mis à jour");
      return;
    }
    for (const id of targets) {
      const original = slotOfProfile(meals, id, source.type);
      if (!original) continue;
      const occupant = occupantOfSlot(meals, id, next.type, original.id);
      const error = await persistReclassifiedMeal(
        supabase,
        original,
        {
          ...original,
          ...payloadFields,
          id: original.id,
          profileId: id,
          type: next.type,
        },
        occupant,
      );
      if (error) {
        setSavingEdit(false);
        flash(error);
        return;
      }
    }
    await reload();
    setSavingEdit(false);
    setEditingMeal(null);
    flash(targets.length > 1 ? "Créneaux mis à jour pour les deux" : "Créneau mis à jour");
  }

  async function persistMealFromCoach(next: MealEntry) {
    return writeSlots([next.profileId], mealFields(next), next.type);
  }

  async function duplicateMealTo(source: MealEntry, targetId: ProfileId) {
    const ok = await writeSlots(
      [targetId],
      { ...mealFields(source), isSkipped: false },
      source.type,
    );
    if (!ok) return;
    flash(`Repas copié pour ${profileShortName(targetId)}`);
  }

  function openSwapWeek(type: "dejeuner" | "diner") {
    const from = weekSlotForToday(weekPlan, type);
    if (!from) {
      flash("Pas de créneau dans le plan de la semaine");
      return;
    }
    if (!weekHasOtherPlats(weekPlan, from.id)) {
      flash("Aucun autre plat prévu cette semaine");
      return;
    }
    setEditingMeal(null);
    setSwapWeekMeal(from);
  }

  async function confirmSwapWeek(target: { dayIndex: number; mealType: "dejeuner" | "diner" }) {
    if (!swapWeekMeal) return;
    const date = todayISO();
    const next = moveMealInPlan(weekPlan, swapWeekMeal.id, target);
    const error = await saveWeekPlan(mondayOf(date), next, weekTheme);
    setWeekPlan(next);
    setSwapWeekMeal(null);
    if (error) {
      flash(error);
      return;
    }
    const todayIndex = isoWeekday(date) - 1;
    const types: Array<"dejeuner" | "diner"> = [swapWeekMeal.mealType];
    if (target.dayIndex === todayIndex && target.mealType !== swapWeekMeal.mealType) {
      types.push(target.mealType);
    }
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setMeals((prev) => fillMissingPlatsFromWeekPlan(prev, next, HOUSEHOLD_IDS, date, { force: true }));
      flash("Plat échangé avec la semaine");
      return;
    }
    setBusy(true);
    await applyWeekPlatsToToday(supabase, date, {
      profileIds: HOUSEHOLD_IDS,
      types,
      force: true,
    });
    await applyTodaySlotTemplates(supabase, date);
    setBusy(false);
    await reload();
    flash("Plat échangé avec la semaine");
  }

  async function serveWeekPlat(profileId: ProfileId, type: "dejeuner" | "diner") {
    const targets = persistTargets(profileId);
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setMeals((prev) =>
        fillMissingPlatsFromWeekPlan(prev, weekPlan, targets, todayISO(), { force: true }),
      );
      flash("Plat de la semaine");
      return;
    }
    setBusy(true);
    const applied = await applyWeekPlatsToToday(supabase, todayISO(), {
      profileIds: targets,
      types: [type],
      force: true,
    });
    await applyTodaySlotTemplates(supabase, todayISO());
    setBusy(false);
    if (!applied) {
      flash("Pas de plat prévu cette semaine");
      return;
    }
    await reload();
    flash("Plat de la semaine");
  }

  async function restoreMeals(profileId: ProfileId, types: MealType[]) {
    if (types.length === 0) return;
    const supabase = createBrowserSupabaseClient();
    const date = todayISO();
    if (!supabase) {
      setMeals((prev) => {
        const keep = prev.filter(
          (meal) => meal.profileId !== profileId || !types.includes(meal.type),
        );
        const restored = types
          .map((type) => plannedMealEntry(profileId, type, date, householdTemplates[profileId]))
          .filter((row): row is MealEntry => Boolean(row));
        return fillMissingSlotsFromTemplates(
          fillMissingPlatsFromWeekPlan(
            [...keep, ...restored],
            weekPlan,
            [profileId],
            date,
            { force: types.some((type) => type === "dejeuner" || type === "diner") },
          ),
          [profileId],
          date,
          householdTemplates,
          { createMissing: true, lunchDessert, dinnerDessert },
        );
      });
      flash(types.length > 1 ? "Journée réinitialisée" : "Repas réinitialisé");
      return;
    }
    setBusy(true);
    const { error } = await restorePlannedMeals(supabase, profileId, types);
    setBusy(false);
    if (error) {
      flash(error);
      return;
    }
    await reload();
    flash(types.length > 1 ? "Journée réinitialisée" : "Repas réinitialisé");
  }

  const catSnapshot = useMemo(() => {
    void sessionTick;
    return buildTodayCatSnapshot({
      view,
      profiles: activeProfiles,
      meals,
      ratings,
      workouts,
      movement,
      weekPlan,
      season,
      weather,
    });
  }, [activeProfiles, meals, movement, ratings, season, view, weather, weekPlan, workouts, sessionTick]);
  const catLine = useMemo(() => pickTodayCatLine(catSnapshot).text, [catSnapshot]);
  const lunchStreak = useMemo(() => {
    const today = todayISO();
    return coupleLunchStreak(
      [...streakMeals, ...meals.map((meal) => ({ ...meal, date: meal.date ?? today }))],
      today,
    );
  }, [meals, streakMeals]);
  const delightProfiles = useMemo(() => {
    void sessionTick;
    return activeProfiles.map((profile) => {
      const sport = todaySessionFlags(
        profile,
        workouts.filter((workout) => workout.profileId === profile.id),
      );
      return {
        id: profile.id,
        name: profile.name,
        meals: mealsAccountedToday(meals, profile.id),
        session: sport.planned && sport.done,
        journal: Boolean(ratings[profile.id]?.validated),
      };
    });
  }, [activeProfiles, meals, ratings, workouts, sessionTick]);

  return (
    <div>
      <h1 className="text-[28px] font-bold tracking-tight">Aujourd&apos;hui</h1>
      <p className="mt-0.5 text-[13px] capitalize text-health-muted">{formatLongDate(todayISO())}</p>
      <TodayCatBanner line={catLine} streak={lunchStreak} />
      {status === "loading" || status === "offline" || status === "error" ? (
        <p className="mt-1 text-[12px] text-health-muted">
          {status === "loading" && "Connexion…"}
          {status === "offline" && statusDetail}
          {status === "error" && statusDetail}
        </p>
      ) : null}

      <div className="mt-3 flex gap-2">
        <QuickBtn icon={RefreshCw} label="Remplacement" onClick={() => void onSwap()} disabled={busy} />
        <QuickBtn icon={Copy} label="Copier hier" onClick={() => void onCopyYesterday()} disabled={busy} />
      </div>

      {activeProfiles.map((profile) => (
        <ProfileToday
          key={profile.id}
          profile={profile}
          meals={meals.filter((m) => m.profileId === profile.id)}
          householdMeals={meals}
          ratings={ratings[profile.id] ?? emptyFeel()}
          onRate={(key, value) => void persistFeel(profile.id, key, value)}
          onResetFeel={() => void resetFeel(profile.id)}
          onValidateFeel={() => void validateFeel(profile.id)}
          onAddToSlot={(type) => setAddSlot({ profileId: profile.id, type })}
          onEditMeal={setEditingMeal}
          onToggleSkip={(meal) => void toggleSkip(meal)}
          onSkipEmpty={(type) => void skipEmptySlot(profile.id, type)}
          onResetMeal={(type) => void restoreMeals(profile.id, [type])}
          onResetAll={() => void restoreMeals(profile.id, ALL_MEAL_SLOTS)}
          onServeWeekPlat={(type) => void serveWeekPlat(profile.id, type)}
          onSwapWeek={(type) => openSwapWeek(type)}
          onDuplicateToOther={(meal) => void duplicateMealTo(meal, otherProfileId(meal.profileId))}
          onCopyFromOther={(type) => {
            const source = slotOfProfile(meals, otherProfileId(profile.id), type);
            if (source) void duplicateMealTo(source, profile.id);
          }}
          yesterdayMeals={yesterdayMeals}
          onCopyYesterday={(type) => void copyYesterdayFromSlot(profile.id, type)}
          weekPlan={weekPlan}
          favorites={favorites}
          rejected={rejected}
          onToggleFavorite={(recipe) => void toggleFavorite(recipe)}
          onToggleRejected={(recipe) => void toggleRejected(recipe)}
          resetting={busy}
          workouts={workouts.filter((workout) => workout.profileId === profile.id)}
          movement={movement[profile.id]}
          onPersistMeal={persistMealFromCoach}
          onFlash={flash}
          onReload={() => void reload()}
        />
      ))}

      {swapOpen && (
        <SwapProposalSheet
          profiles={activeProfiles}
          meals={meals}
          confirming={busy}
          onClose={() => setSwapOpen(false)}
          onConfirm={(mealType, proposals) => void confirmSwap(mealType, proposals)}
        />
      )}

      {copyOpen && (
        <CopyYesterdaySheet
          yesterdayMeals={yesterdayMeals}
          profiles={activeProfiles}
          confirming={busy}
          onClose={() => setCopyOpen(false)}
          onConfirm={(types) => void confirmCopyYesterday(types)}
        />
      )}

      {addSlot && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
          <div className="w-full max-w-[430px] rounded-t-[24px] bg-white p-4 pb-8 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[17px] font-semibold">
                Ajouter · {mealTypeLabel(addSlot.type)}
              </h3>
              <button
                type="button"
                onClick={() => setAddSlot(null)}
                className="rounded-full bg-health-bg p-1.5"
              >
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <LogTile icon={Sparkles} label="Texte / IA" onClick={() => startLog(addSlot.profileId, addSlot.type, "text")} />
              <LogTile icon={ScanBarcode} label="Code-barres" onClick={() => startLog(addSlot.profileId, addSlot.type, "barcode")} />
              <LogTile icon={Camera} label="Photo" onClick={() => startLog(addSlot.profileId, addSlot.type, "photo")} />
              <LogTile icon={Clock} label="Récents" onClick={() => startLog(addSlot.profileId, addSlot.type, "recent")} />
            </div>
            <button
              type="button"
              onClick={() => startLog(addSlot.profileId, addSlot.type, "history")}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-card bg-health-bg py-2.5 text-[13px] font-semibold"
            >
              <History size={14} />
              Historique plats & desserts
            </button>
          </div>
        </div>
      )}

      {recentsOpen && logMealType && (
        <RecentsSheet
          foods={recentFoodsFromMeals(
            [
              ...meals.map((meal) => ({ ...meal, date: todayISO() })),
              ...recentMeals,
            ],
            logProfile,
          )}
          confirming={busy}
          onClose={() => setRecentsOpen(false)}
          onPick={(food) => void persistRecentFood(food)}
        />
      )}

      {historyOpen && (logMealType || editingMeal) ? (
        <MealHistorySheet
          key={historyKind}
          items={historyItems}
          rejected={rejected}
          loading={historyLoading}
          busy={busy}
          initialKind={historyKind}
          caption="Plusieurs semaines du même plat : choisis la version. Plus jamais n’apparaît pas ici."
          onClose={() => {
            setHistoryOpen(false);
            if (!editingMeal) {
              setLogMealType(null);
              setAddSlot(null);
            }
          }}
          onPick={(item) => void applyHistoryItem(item)}
        />
      ) : null}

      {logMode && logMealType && (
        <LogSheet
          mode={logMode}
          mealType={logMealType}
          profileId={logProfile}
          textInput={textInput}
          setTextInput={setTextInput}
          ingredients={ingredients}
          setIngredients={setIngredients}
          onClose={closeLog}
          onAnalyzeText={async () => {
            const diet = logProfile === "elodie" ? "omnivore" : "vegan";
            try {
              const res = await withGeminiWait("Gemini lit le texte…", () =>
                fetch("/api/log-text", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ text: textInput, diet }),
                }),
              );
              const data = (await res.json()) as { ingredients?: DetectedIngredient[] };
              if (Array.isArray(data.ingredients) && data.ingredients.length > 0) {
                setIngredients(data.ingredients);
                return;
              }
            } catch {
              /* parseur local ci-dessous */
            }
            setIngredients(parseFoodTextLocal(textInput));
          }}
          onSaveText={() => {
            const macros = macrosFromIngredients(ingredients);
            void persistLoggedFood("text", {
              name:
                ingredients.map((item) => item.name).join(" + ") ||
                textInput.trim() ||
                "Saisie texte / IA",
              macros,
              items: ingredients.map((item) => formatDetectedLine(item)),
            });
            closeLog();
            flash("Aliment ajouté");
          }}
          onSaveBarcode={(product, grams, macros) => {
            void persistLoggedFood("barcode", {
              name: product.name,
              macros,
              items: [`${product.name} : ${grams}g`],
            });
            closeLog();
            flash("Produit ajouté");
          }}
          onSavePhoto={() => {
            const macros = macrosFromIngredients(ingredients);
            void persistLoggedFood("photo", {
              name:
                ingredients.map((item) => item.name).join(" + ") || "Photo repas",
              macros,
              items: ingredients.map((item) => formatDetectedLine(item)),
            });
            storage.setJSON("last-photo-log", ingredients);
            closeLog();
            flash("Analyse confirmée et enregistrée");
          }}
        />
      )}

      {editingMeal && (
        <EditMealSheet
          key={editingMeal.id}
          meal={editingMeal}
          dayMeals={meals.filter((row) => row.profileId === editingMeal.profileId)}
          saving={savingEdit}
          onClose={() => {
            setEditingMeal(null);
            setHistoryForEdit(null);
          }}
          onSave={(next) => void persistEditedMeal(next)}
          onAdd={(mode) => startLog(editingMeal.profileId, editingMeal.type, mode)}
          applyHistory={historyForEdit}
          onHistoryApplied={() => setHistoryForEdit(null)}
          onSwapWeek={
            (editingMeal.type === "dejeuner" || editingMeal.type === "diner") &&
            weekHasOtherPlats(
              weekPlan,
              weekSlotForToday(weekPlan, editingMeal.type)?.id,
            )
              ? () => openSwapWeek(editingMeal.type as "dejeuner" | "diner")
              : undefined
          }
        />
      )}

      {swapWeekMeal ? (
        <MoveMealSheet
          meal={swapWeekMeal}
          plan={weekPlan}
          title="Échanger avec"
          caption="Choisis un autre plat prévu cette semaine. Les deux créneaux s’échangent, y compris dans l’onglet Repas."
          hideEmpty
          onClose={() => setSwapWeekMeal(null)}
          onConfirm={(target) => void confirmSwapWeek(target)}
        />
      ) : null}

      <TodayDelight
        profiles={delightProfiles}
        couple={view === "couple"}
        armed={status !== "loading"}
      />

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-health-ink px-4 py-2 text-[13px] text-white shadow-card">
          {toast}
        </div>
      )}
    </div>
  );
}

function QuickBtn({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: typeof RefreshCw;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-1 items-center justify-center gap-1.5 rounded-card bg-white py-2.5 text-[12px] font-semibold shadow-card disabled:opacity-50"
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

function ProfileToday({
  profile,
  meals,
  householdMeals,
  ratings,
  onRate,
  onResetFeel,
  onValidateFeel,
  onAddToSlot,
  onEditMeal,
  onToggleSkip,
  onSkipEmpty,
  onResetMeal,
  onResetAll,
  onServeWeekPlat,
  onSwapWeek,
  onDuplicateToOther,
  onCopyFromOther,
  yesterdayMeals,
  onCopyYesterday,
  weekPlan,
  favorites,
  rejected,
  onToggleFavorite,
  onToggleRejected,
  resetting,
  workouts,
  movement,
  onPersistMeal,
  onFlash,
  onReload,
}: {
  profile: Profile;
  meals: MealEntry[];
  householdMeals: MealEntry[];
  ratings: DailyFeelScores;
  onRate: (key: "hunger" | "energy" | "fatigue", value: CatFeelMood) => void;
  onResetFeel: () => void;
  onValidateFeel: () => void;
  onAddToSlot: (type: MealType) => void;
  onEditMeal: (meal: MealEntry) => void;
  onToggleSkip: (meal: MealEntry) => void;
  onSkipEmpty: (type: MealType) => void;
  onResetMeal: (type: MealType) => void;
  onResetAll: () => void;
  onServeWeekPlat: (type: "dejeuner" | "diner") => void;
  onSwapWeek: (type: "dejeuner" | "diner") => void;
  onDuplicateToOther: (meal: MealEntry) => void;
  onCopyFromOther: (type: MealType) => void;
  yesterdayMeals: MealEntry[];
  onCopyYesterday: (type: MealType) => void;
  weekPlan: PlannedMeal[];
  favorites: FavoriteRecipe[];
  rejected: RejectedRecipe[];
  onToggleFavorite: (recipe: PlannedMeal) => void;
  onToggleRejected: (recipe: PlannedMeal) => void;
  resetting: boolean;
  workouts: Workout[];
  movement: DailyMovement;
  onPersistMeal: (meal: MealEntry) => Promise<boolean>;
  onFlash: (message: string) => void;
  onReload: () => void;
}) {
  const { updateAppliedAdjustments } = useProfile();
  const [confirmResetAll, setConfirmResetAll] = useState(false);
  const current = useMemo(() => sumMacros(meals), [meals]);
  const today = todayISO();
  const shownWorkouts = mergeLoggedWorkouts(profile.id, today, workouts);
  const weekStart = mondayOf(today);
  const weekLunch = plannedMealForDay(weekPlan, today, "dejeuner");
  const weekDinner = plannedMealForDay(weekPlan, today, "diner");
  const otherId = otherProfileId(profile.id);
  const otherName = profileShortName(otherId);
  const snackTemplate = templateForSlot(
    profile.mealTemplates ?? [],
    "collation",
    isoWeekday(),
  );
  const snack = snackTemplate
    ? { name: snackTemplate.name, macros: snackTemplate.macros }
    : suggestedSnacks[profile.id];
  const restingDisplay = sanitizeRestingKcal(movement.restingEnergyKcal, {
    bmr: profile.bmr,
    tdee: profile.tdee,
  }).value;
  const goal = profile.primaryGoal;
  const remark = todayCoachRemark({
    validated: Boolean(ratings.validated),
    profile,
    meals,
    weekPlan,
    workouts: shownWorkouts,
    movement,
    feels: ratings,
    date: today,
  });
  const coachSnapshot = ratings.validated
    ? buildTodayCoachSnapshot({
        profile,
        meals,
        weekPlan,
        workouts: shownWorkouts,
        movement,
        feels: ratings,
        date: today,
      })
    : null;
  const nutritionAdj = visibleNutrition(profile.appliedAdjustments);
  const presentTypes = useMemo(
    () => meals.filter((meal) => !meal.isSkipped).map((meal) => meal.type),
    [meals],
  );
  const mealCoachViews = useMemo(() => {
    const map = new Map<string, MealIngredientView>();
    if (!nutritionAdj) return map;
    const stored = nutritionAdj.quickAdds ?? {};
    for (const meal of meals) {
      if (meal.isSkipped) continue;
      const quickOverrides: Partial<Record<MacroKind, { name: string; grams: number }>> = {};
      for (const add of Object.values(stored)) {
        if (add.mealId !== meal.id) continue;
        quickOverrides[add.kind] = { name: add.name, grams: add.grams };
      }
      const acceptedKinds = (["carbs", "protein", "fat"] as MacroKind[]).filter((kind) =>
        Boolean(nutritionAdj.acceptedAdds?.[quickAddKey(meal.id, kind)]),
      );
      map.set(
        meal.id,
        translateMealAdjustments({
          mealType: meal.type,
          items: meal.items ?? [],
          deltas: nutritionAdj.deltas,
          profileId: profile.id,
          presentTypes,
          quickOverrides,
          acceptedKinds,
        }),
      );
    }
    return map;
  }, [meals, nutritionAdj, presentTypes, profile.id]);
  const dayIngredientTags = useMemo(
    () => collectDayBadges([...mealCoachViews.values()]),
    [mealCoachViews],
  );

  async function hideNutrition() {
    if (!profile.appliedAdjustments) return;
    await updateAppliedAdjustments(profile.id, dismissNutrition(profile.appliedAdjustments));
  }

  async function autreIdeeRapide(meal: MealEntry, kind: MacroKind) {
    const adj = profile.appliedAdjustments;
    if (!adj?.nutrition || !nutritionAdj) return;
    const view = mealCoachViews.get(meal.id);
    const add = view?.adds.find((item) => item.kind === kind);
    if (!add) return;
    const stored = nutritionAdj.quickAdds?.[quickAddKey(meal.id, kind)];
    const avoid = [
      ...new Set(
        [add.name, add.quickName, ...(stored?.avoided ?? [])].filter(
          (item): item is string => Boolean(item),
        ),
      ),
    ];
    try {
      const result = await requestCoachQuickAdd({
        name: profile.name,
        diet: profile.diet,
        aversions: profile.aversions ?? [],
        slots: [
          {
            mealId: meal.id,
            mealName: meal.name,
            mealType: meal.type,
            items: (meal.items ?? []).filter((line) => line.trim()),
            kind,
            macroG: Math.abs(Math.round(nutritionAdj.deltas[kind])),
            idealName: add.name,
            avoid,
          },
        ],
      });
      const hit =
        result.suggestions?.find((item) => item.kind === kind) ?? result.suggestions?.[0];
      if (!hit) return;
      await updateAppliedAdjustments(
        profile.id,
        upsertNutritionQuickAdd(adj, {
          mealId: meal.id,
          kind,
          name: hit.name,
          grams: hit.grams,
          avoided: [...avoid, hit.name],
          fromFlash: true,
        }),
      );
    } catch {
      /* keep current rapide */
    }
  }

  async function validateCoachAdds(
    meal: MealEntry,
    picks: Array<{ kind: MacroKind; choice: CoachAddChoice }>,
  ) {
    const adj = profile.appliedAdjustments;
    const view = mealCoachViews.get(meal.id);
    if (!adj?.nutrition || !view || picks.length === 0) return;
    const resolved = picks
      .map((pick) => {
        const add = view.adds.find((item) => item.kind === pick.kind);
        return add ? { add, choice: pick.choice } : null;
      })
      .filter((item): item is { add: (typeof view.adds)[number]; choice: CoachAddChoice } => Boolean(item));
    if (!resolved.length) return;
    const next = applyCoachAddsToMeal(meal, resolved);
    const ok = await onPersistMeal(next);
    if (!ok) return;
    await updateAppliedAdjustments(profile.id, acceptNutritionAdds(adj, meal.id, picks));
    onFlash(picks.length > 1 ? "Ajouts Coach enregistrés" : "Ajout Coach enregistré");
  }

  return (
    <section className={cn("mt-4", profile.accent === "coral" ? "accent-coral" : "accent-violet")}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-[17px] font-semibold">{profile.name}</h2>
        <div className="flex items-center gap-1.5">
          {nutritionAdj && <CoachBadge onDismiss={() => void hideNutrition()} />}
          <GoalBadge current={current.calories} target={profile.targets.calories} goal={goal} />
        </div>
      </div>

      <Card className={coachHighlightClass(Boolean(nutritionAdj))}>
        <TodayEnergyCard
          current={current}
          targets={profile.targets}
          goal={goal}
          movement={movement}
          profile={profile}
          coachTags={nutritionAdj ? dayIngredientTags : undefined}
        />
      </Card>

      <SectionTitle
        action={
          confirmResetAll ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmResetAll(false)}
                className="text-[12px] font-semibold text-health-muted"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={resetting}
                onClick={() => {
                  setConfirmResetAll(false);
                  onResetAll();
                }}
                className="text-[12px] font-semibold text-coral-dark"
              >
                Confirmer
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={resetting}
              onClick={() => setConfirmResetAll(true)}
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-health-muted"
            >
              <RotateCcw size={12} />
              Tout réinit.
            </button>
          )
        }
      >
        Repas
      </SectionTitle>
      <div className="space-y-2">
        {MEAL_SLOTS.map((slot) => {
          const slotMeals = meals.filter((m) => m.type === slot);
          const meal = [...slotMeals].sort((a, b) => {
            if (Boolean(a.isSkipped) !== Boolean(b.isSkipped)) return a.isSkipped ? 1 : -1;
            return b.macros.calories - a.macros.calories;
          })[0];
          const weekDish =
            slot === "dejeuner" ? weekLunch : slot === "diner" ? weekDinner : null;
          const canSwapWeek =
            (slot === "dejeuner" || slot === "diner") &&
            weekHasOtherPlats(weekPlan, weekSlotForToday(weekPlan, slot)?.id);
          const otherMeal = slotOfProfile(householdMeals, otherId, slot);
          const copyFromOther = !isFilledMeal(meal) && isFilledMeal(otherMeal);
          if (!meal) {
            if (slot === "collation") {
              return (
                <Card key={slot}>
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => onAddToSlot("collation")}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-health-muted">
                        Collation (reste macros)
                      </p>
                      <p className="mt-0.5 text-[15px] font-medium">{snack.name}</p>
                      <p className="mt-2 text-[13px] font-semibold tabular-nums">
                        {formatKcal(snack.macros.calories)} · {snack.macros.protein}g P
                      </p>
                      <p className="mt-1 text-[12px] font-medium text-health-muted">Toucher pour ajouter</p>
                    </button>
                    <SkipToggle skipped={false} onClick={() => onSkipEmpty("collation")} />
                  </div>
                  {copyFromOther ? (
                    <DuplicateMealBtn
                      label={`Copier celui ${otherId === "elodie" ? "d’Élodie" : "d’Alexis"}`}
                      onClick={() => onCopyFromOther("collation")}
                    />
                  ) : null}
                  {yesterdayHasSlot(yesterdayMeals, profile.id, "collation") ? (
                    <DuplicateMealBtn
                      label="Comme hier"
                      onClick={() => onCopyYesterday("collation")}
                    />
                  ) : null}
                  <RestorePlannedBtn disabled={resetting} onClick={() => onResetMeal("collation")} />
                </Card>
              );
            }
            return (
              <Card key={slot}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-health-muted">
                      {mealTypeLabel(slot)}
                    </p>
                    {weekDish ? (
                      <>
                        <p className="mt-0.5 text-[15px] font-medium leading-snug">{weekDish.baseName}</p>
                        <p className="mt-1 text-[12px] text-health-muted">Prévu dans Repas · 1 portion</p>
                        <button
                          type="button"
                          onClick={() => onServeWeekPlat(slot as "dejeuner" | "diner")}
                          className="mt-2 text-[12px] font-semibold"
                        >
                          Mettre le plat de la semaine
                        </button>
                        {canSwapWeek ? (
                          <button
                            type="button"
                            onClick={() => onSwapWeek(slot as "dejeuner" | "diner")}
                            className="mt-1.5 block text-[12px] font-semibold"
                          >
                            Échanger avec un plat de la semaine
                          </button>
                        ) : null}
                      </>
                    ) : (
                      <button type="button" className="w-full text-left" onClick={() => onAddToSlot(slot)}>
                        <p className="mt-0.5 text-[14px] text-health-muted">Pas encore enregistré</p>
                        {slot === "dejeuner" || slot === "diner" ? (
                          <p className="mt-1 text-[12px] text-health-muted">Pas de plat prévu cette semaine</p>
                        ) : null}
                        <p className="mt-1 text-[12px] font-medium">Toucher pour ajouter</p>
                      </button>
                    )}
                    {copyFromOther ? (
                      <DuplicateMealBtn
                        label={`Copier celui ${otherId === "elodie" ? "d’Élodie" : "d’Alexis"}`}
                        hint={slot === "dejeuner" || slot === "diner" ? "Tu copies le sien ?" : undefined}
                        onClick={() => onCopyFromOther(slot)}
                      />
                    ) : null}
                    {slot === "petit-dejeuner" &&
                    yesterdayHasSlot(yesterdayMeals, profile.id, slot) ? (
                      <DuplicateMealBtn
                        label="Comme hier"
                        onClick={() => onCopyYesterday(slot)}
                      />
                    ) : null}
                    <RestorePlannedBtn disabled={resetting} onClick={() => onResetMeal(slot)} />
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {canFavoriteMeal(weekDish) ? (
                      <div className="flex items-center gap-1.5">
                        <FavoriteHeart
                          on={isFavoriteTitle(favorites, weekDish.baseName)}
                          onClick={() => onToggleFavorite(weekDish)}
                        />
                        <RejectMealButton
                          on={isRejectedTitle(rejected, weekDish.baseName)}
                          onClick={() => onToggleRejected(weekDish)}
                        />
                      </div>
                    ) : null}
                    <SkipToggle skipped={false} onClick={() => onSkipEmpty(slot)} />
                  </div>
                </div>
              </Card>
            );
          }
          const fromWeek = Boolean(
            weekDish && isServingThisWeekPlat(meal, weekDish, weekStart),
          );
          const canDuplicate = isFilledMeal(meal) && !isFilledMeal(otherMeal);
          return (
            <MealCard
              key={meal.id}
              meal={meal}
              dailyCalories={profile.targets.calories}
              goal={goal}
              coachView={mealCoachViews.get(meal.id)}
              fromWeek={fromWeek}
              onDismissCoach={nutritionAdj ? () => void hideNutrition() : undefined}
              onAutreIdee={
                nutritionAdj ? (kind) => void autreIdeeRapide(meal, kind) : undefined
              }
              onValidateCoach={
                nutritionAdj ? (picks) => void validateCoachAdds(meal, picks) : undefined
              }
              onClick={() => onEditMeal(meal)}
              onToggleSkip={() => onToggleSkip(meal)}
              onReset={() => onResetMeal(meal.type)}
              onDuplicate={canDuplicate ? () => onDuplicateToOther(meal) : undefined}
              duplicateLabel={canDuplicate ? `Pour ${otherName}` : undefined}
              onCopyFromOther={copyFromOther ? () => onCopyFromOther(slot) : undefined}
              copyFromOtherLabel={
                copyFromOther
                  ? `Copier celui ${otherId === "elodie" ? "d’Élodie" : "d’Alexis"}`
                  : undefined
              }
              onCopyYesterday={
                (slot === "petit-dejeuner" || slot === "collation") &&
                yesterdayHasSlot(yesterdayMeals, profile.id, slot) &&
                (isTemplateSlot(meal) || !isFilledMeal(meal))
                  ? () => onCopyYesterday(slot)
                  : undefined
              }
              onServeWeek={
                weekDish && !fromWeek && !meal.isSkipped
                  ? () => onServeWeekPlat(slot as "dejeuner" | "diner")
                  : undefined
              }
              onSwapWeek={
                canSwapWeek && !meal.isSkipped
                  ? () => onSwapWeek(slot as "dejeuner" | "diner")
                  : undefined
              }
              favoriteOn={
                canFavoriteMeal(weekDish) ? isFavoriteTitle(favorites, weekDish.baseName) : undefined
              }
              onToggleFavorite={
                canFavoriteMeal(weekDish) ? () => onToggleFavorite(weekDish) : undefined
              }
              rejectedOn={
                canFavoriteMeal(weekDish) ? isRejectedTitle(rejected, weekDish.baseName) : undefined
              }
              onToggleRejected={
                canFavoriteMeal(weekDish) ? () => onToggleRejected(weekDish) : undefined
              }
            />
          );
        })}
      </div>

      <SectionTitle
        action={
          <button
            type="button"
            disabled={!hasFeelScore(ratings)}
            onClick={onResetFeel}
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-health-muted disabled:opacity-40"
          >
            <RotateCcw size={12} />
            Réinit.
          </button>
        }
      >
        Faim, motivation & fatigue
      </SectionTitle>
      <Card>
        <FeelStickerRow
          axis="hunger"
          label={FEEL_AXIS_LABELS.hunger}
          hint={FEEL_AXIS_HINTS.hunger}
          value={ratings.hunger}
          onChange={(v) => onRate("hunger", v)}
        />
        <div className="my-3 h-px bg-health-line" />
        <FeelStickerRow
          axis="energy"
          label={FEEL_AXIS_LABELS.energy}
          hint={FEEL_AXIS_HINTS.energy}
          value={ratings.energy}
          onChange={(v) => onRate("energy", v)}
        />
        <div className="my-3 h-px bg-health-line" />
        <FeelStickerRow
          axis="fatigue"
          label={FEEL_AXIS_LABELS.fatigue}
          hint={FEEL_AXIS_HINTS.fatigue}
          value={ratings.fatigue}
          onChange={(v) => onRate("fatigue", v)}
        />
        {ratings.validated ? (
          <p className="mt-3 text-[11px] leading-snug text-health-muted">
            Noté. Le coach du jour se met à jour si tu logges un repas ou une séance.
          </p>
        ) : (
          <>
            <p className="mt-3 text-[11px] leading-snug text-health-muted">
              Note les trois, puis Validé — le coach lit aussi mangé, brûlé et l’activité.
            </p>
            <button
              type="button"
              disabled={!hasCompleteFeel(ratings)}
              onClick={onValidateFeel}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-card bg-health-ink py-2.5 text-[13px] font-semibold text-white disabled:opacity-40"
            >
              <Check size={14} />
              Validé
            </button>
          </>
        )}
      </Card>

      <TodayDayCoach profileId={profile.id} remark={remark} snapshot={coachSnapshot} />

      <TodayPlannedCard
        profile={profile}
        workouts={shownWorkouts}
        onWorkoutsChanged={onReload}
      />

      <SectionTitle>Activité</SectionTitle>
      <Card>
        {shownWorkouts.length > 0 ? (
          <div className="space-y-3">
            {shownWorkouts.map((workout) => (
              <div key={workout.id}>
                <p className="text-[15px] font-medium">{workout.name}</p>
                <p className="mt-0.5 text-[13px] text-health-muted">
                  {workout.durationMin} min · {workout.calories} kcal ·{" "}
                  {workout.source === "manual" ? "Manuel" : "Apple Santé"}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[14px] text-health-muted">Aucune séance aujourd&apos;hui.</p>
        )}

        <div className="my-3 h-px bg-health-line" />

        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-health-muted">
          Apple Santé
        </p>
        <div className="grid grid-cols-4 gap-1.5">
          <HealthMetricTile compact label="Pas" value={formatSteps(movement.steps)} />
          <HealthMetricTile compact label="Marche" value={formatKm(movement.distanceKm)} />
          <HealthMetricTile compact label="Vélo" value={formatKm(movement.cyclingDistanceKm)} />
          <HealthMetricTile compact label="Exercice" value={formatMin(movement.workoutMinutes)} />
          <HealthMetricTile compact label="Active" value={formatKcal(movement.activeEnergyKcal)} />
          <HealthMetricTile compact label="Repos" value={formatKcal(restingDisplay)} />
          {movement.weightKg != null ? (
            <HealthMetricTile
              compact
              label="Poids"
              value={`${String(movement.weightKg).replace(".", ",")} kg`}
            />
          ) : null}
        </div>
        {(movement.fatMassPct != null || movement.bmi != null) && (
          <div className="mt-1.5 grid grid-cols-4 gap-1.5">
            {movement.fatMassPct != null ? (
              <HealthMetricTile
                compact
                label="MG"
                value={`${String(movement.fatMassPct).replace(".", ",")} %`}
              />
            ) : null}
            {movement.bmi != null ? (
              <HealthMetricTile compact label="IMC" value={String(movement.bmi).replace(".", ",")} />
            ) : null}
          </div>
        )}
      </Card>
    </section>
  );
}

function SkipToggle({ skipped, onClick }: { skipped: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        skipped ? "bg-health-ink text-white" : "bg-health-bg text-health-muted",
      )}
    >
      {skipped ? "Sauté" : "Sauter"}
    </button>
  );
}

function MealCard({
  meal,
  dailyCalories,
  goal,
  coachView,
  fromWeek,
  onDismissCoach,
  onAutreIdee,
  onValidateCoach,
  onClick,
  onToggleSkip,
  onReset,
  onDuplicate,
  duplicateLabel,
  onCopyFromOther,
  copyFromOtherLabel,
  onCopyYesterday,
  onServeWeek,
  onSwapWeek,
  favoriteOn,
  onToggleFavorite,
  rejectedOn,
  onToggleRejected,
}: {
  meal: MealEntry;
  dailyCalories: number;
  goal: Profile["primaryGoal"];
  coachView?: MealIngredientView;
  fromWeek?: boolean;
  onDismissCoach?: () => void;
  onAutreIdee?: (kind: MacroKind) => void;
  onValidateCoach?: (picks: Array<{ kind: MacroKind; choice: CoachAddChoice }>) => void;
  onClick: () => void;
  onToggleSkip: () => void;
  onReset?: () => void;
  onDuplicate?: () => void;
  duplicateLabel?: string;
  onCopyFromOther?: () => void;
  copyFromOtherLabel?: string;
  onCopyYesterday?: () => void;
  onServeWeek?: () => void;
  onSwapWeek?: () => void;
  favoriteOn?: boolean;
  onToggleFavorite?: () => void;
  rejectedOn?: boolean;
  onToggleRejected?: () => void;
}) {
  const skipped = Boolean(meal.isSkipped);
  const adds = coachView?.adds ?? [];
  const highlighted = Boolean(!skipped && adds.length > 0);
  const dessertLines = skipped
    ? []
    : (meal.items ?? [])
        .filter((line) => isDessertItemLine(line) && !isEmptyDessertMarker(line))
        .map((line) => dessertDisplayName(line));
  const kcalStatus = skipped
    ? null
    : macroStatus(
        "calories",
        meal.macros.calories,
        slotCalorieTarget(dailyCalories, meal.type),
        goal,
      );
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      className="w-full cursor-pointer text-left"
    >
      <Card className={cn("active:scale-[0.99] transition", skipped && "opacity-50", coachHighlightClass(highlighted))}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-health-muted">
              {mealTypeLabel(meal.type)}
              {meal.time ? ` · ${meal.time}` : ""}
            </p>
            {meal.name.trim() &&
            meal.name.trim().toLowerCase() !== mealTypeLabel(meal.type).toLowerCase() ? (
              <p className="mt-0.5 text-[15px] font-medium leading-snug">{meal.name}</p>
            ) : null}
            {dessertLines.length > 0 ? (
              <p className="mt-1.5 text-[12px] leading-snug text-amber-800 dark:text-amber-200">
                Dessert · {dessertLines.join(" · ")}
              </p>
            ) : null}
            {highlighted && (
              <div className="mt-2">
                <CoachBadge onDismiss={onDismissCoach} />
                <CoachMealAddTags
                  adds={adds}
                  onAutreIdee={onAutreIdee}
                  onValidate={onValidateCoach}
                />
              </div>
            )}
            {fromWeek ? (
              <p className="mt-1 text-[11px] font-medium text-health-muted">Plat de la semaine</p>
            ) : null}
            {onServeWeek ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onServeWeek();
                }}
                className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold"
              >
                Mettre le plat de la semaine
              </button>
            ) : null}
            {onSwapWeek ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onSwapWeek();
                }}
                className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold"
              >
                Échanger avec un plat de la semaine
              </button>
            ) : null}
            {onDuplicate && duplicateLabel ? (
              <DuplicateMealBtn
                label={duplicateLabel}
                hint={
                  meal.type === "dejeuner" || meal.type === "diner"
                    ? "Tu lui copies le tien ?"
                    : undefined
                }
                onClick={onDuplicate}
              />
            ) : null}
            {onCopyFromOther && copyFromOtherLabel ? (
              <DuplicateMealBtn
                label={copyFromOtherLabel}
                hint={
                  meal.type === "dejeuner" || meal.type === "diner"
                    ? "Tu copies le sien ?"
                    : undefined
                }
                onClick={onCopyFromOther}
              />
            ) : null}
            {onCopyYesterday ? (
              <DuplicateMealBtn label="Comme hier" onClick={onCopyYesterday} />
            ) : null}
            {onReset && (
              <RestorePlannedBtn onClick={onReset} />
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            {onToggleFavorite || onToggleRejected ? (
              <div className="flex items-center gap-1.5">
                {onToggleFavorite ? (
                  <FavoriteHeart on={Boolean(favoriteOn)} onClick={onToggleFavorite} />
                ) : null}
                {onToggleRejected ? (
                  <RejectMealButton on={Boolean(rejectedOn)} onClick={onToggleRejected} />
                ) : null}
              </div>
            ) : null}
            <SkipToggle skipped={skipped} onClick={onToggleSkip} />
            <p
              className={cn(
                "text-right text-[13px] font-semibold tabular-nums",
                kcalStatus && TONE_TEXT[kcalStatus.tone],
              )}
            >
              {skipped ? "—" : meal.macros.calories}
              <span className="block text-[11px] font-normal text-health-muted">
                {skipped ? "exclu" : `${meal.macros.protein}g P`}
              </span>
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function LogTile({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Camera;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-card bg-health-bg py-3.5"
    >
      <Icon size={20} />
      <span className="text-[11px] font-semibold">{label}</span>
    </button>
  );
}

function RestorePlannedBtn({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-health-muted disabled:opacity-40"
    >
      <RotateCcw size={11} />
      Réinit.
    </button>
  );
}

function DuplicateMealBtn({
  label,
  onClick,
  hint,
}: {
  label: string;
  onClick: () => void;
  hint?: string;
}) {
  return (
    <span className="mt-2 block">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
        className="inline-flex items-center gap-1 text-[11px] font-semibold"
      >
        <Copy size={11} />
        {label}
      </button>
      {hint ? (
        <p className="mt-0.5 text-[11px] leading-snug text-health-muted">{hint}</p>
      ) : null}
    </span>
  );
}
