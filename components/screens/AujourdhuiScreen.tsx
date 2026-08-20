"use client";

import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  Camera,
  Copy,
  Plus,
  RefreshCw,
  RotateCcw,
  ScanBarcode,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useProfile } from "@/context/ProfileContext";
import { CopyYesterdaySheet } from "@/components/today/CopyYesterdaySheet";
import { EditMealSheet } from "@/components/today/EditMealSheet";
import { SwapProposalSheet } from "@/components/today/SwapProposalSheet";
import { TodayPlannedCard } from "@/components/today/TodayPlannedCard";
import { HealthMetricTile } from "@/components/today/HealthMetricTile";
import { TodayEnergyCard } from "@/components/today/TodayEnergyCard";
import { CoachBadge, CoachDiffTags, coachHighlightClass } from "@/components/today/CoachDelta";
import { Card, SectionTitle } from "@/components/ui/Card";
import { GoalBadge } from "@/components/ui/MacroProgress";
import { formatLongDate, isoWeekday, todayISO, yesterdayISO } from "@/lib/dates";
import {
  coachInsights,
  mockBarcodeProduct,
  suggestedSnacks,
  todayMeals,
  todayMovement,
  todayWorkouts,
} from "@/lib/mock-data";
import {
  templateForSlot,
  isDessertItemLine,
  isEmptyDessertMarker,
  stripDessertPrefix,
  appendPlatKeepingDessert,
} from "@/lib/meal-templates";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { profileIdsForView } from "@/lib/supabase/filters";
import { fetchTodayActivity } from "@/lib/supabase/health-logs";
import { ensureDemoMeals } from "@/lib/supabase/seed-today";
import { macrosFromIngredients, parseFoodTextLocal, scaleDetected } from "@/lib/food-log";
import { withGeminiWait } from "@/lib/gemini/wait";
import {
  copyYesterdayMeals,
  fetchTodayMeals,
  fillMissingSlotsFromTemplates,
  insertMeal,
  plannedMealEntry,
  restorePlannedMeals,
  setMealSkipped,
  swapMeal,
  updateMeal,
} from "@/lib/supabase/today-data";
import { storage } from "@/lib/storage";
import type {
  DailyMovement,
  DetectedIngredient,
  Macros,
  MealEntry,
  MealType,
  Profile,
  ProfileId,
  Workout,
} from "@/lib/types";
import { sanitizeRestingKcal } from "@/lib/health-energy";
import { macroStatus, slotCalorieTarget, TONE_TEXT } from "@/lib/macro-status";
import { cn, formatKcal, formatKm, formatMin, formatSteps, mealTypeLabel, passiveKcalFromMovement } from "@/lib/utils";
import { dismissNutrition, visibleNutrition } from "@/lib/coach-adjustments";
import {
  collectDayBadges,
  translateMealAdjustments,
  type MealIngredientView,
} from "@/lib/coach-ingredients";

const MEAL_SLOTS: MealType[] = ["petit-dejeuner", "dejeuner", "diner"];
const ALL_MEAL_SLOTS: MealType[] = [...MEAL_SLOTS, "collation"];

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
  switch (type) {
    case "petit-dejeuner":
      return "08:00";
    case "dejeuner":
      return "12:30";
    case "diner":
      return "20:00";
    default:
      return "16:30";
  }
}

function scaleMacros(base: Macros, fromG: number, toG: number): Macros {
  const ratio = fromG > 0 ? toG / fromG : 1;
  return {
    calories: Math.round(base.calories * ratio),
    protein: Math.round(base.protein * ratio),
    carbs: Math.round(base.carbs * ratio),
    fat: Math.round(base.fat * ratio),
  };
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
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [ratings, setRatings] = useState<Record<ProfileId, { hunger: number; energy: number }>>({
    alexis: { hunger: 3, energy: 4 },
    elodie: { hunger: 2, energy: 4 },
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
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [movement, setMovement] = useState<Record<ProfileId, DailyMovement>>(emptyMovement);

  function flash(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2200);
  }

  const householdTemplates = useMemo(
    () => ({
      alexis: catalog.alexis.mealTemplates,
      elodie: catalog.elodie.mealTemplates,
    }),
    [catalog.alexis.mealTemplates, catalog.elodie.mealTemplates],
  );

  const reload = useCallback(async () => {
    const supabase = createBrowserSupabaseClient();
    const ids = profileIdsForView(view);
    if (!supabase) {
      setMeals(
        fillMissingSlotsFromTemplates(
          todayMeals.filter((meal) => ids.includes(meal.profileId)),
          ids,
          todayISO(),
          householdTemplates,
        ),
      );
      setWorkouts(todayWorkouts.filter((workout) => ids.includes(workout.profileId)));
      setMovement(todayMovement);
      setStatus("offline");
      setStatusDetail("Supabase non configuré — mock local");
      return;
    }

    const seed = await ensureDemoMeals(supabase);
    if (!seed.ok) {
      setMeals(
        fillMissingSlotsFromTemplates(
          todayMeals.filter((meal) => ids.includes(meal.profileId)),
          ids,
          todayISO(),
          householdTemplates,
        ),
      );
      setWorkouts(todayWorkouts.filter((workout) => ids.includes(workout.profileId)));
      setMovement(todayMovement);
      setStatus("error");
      setStatusDetail(seed.error ?? "Échec seed / lecture");
      return;
    }

    const [{ meals: rows, error }, activity] = await Promise.all([
      fetchTodayMeals(supabase, ids),
      fetchTodayActivity(supabase, ids),
    ]);

    if (error) {
      setStatus("error");
      setStatusDetail(error);
      return;
    }

    setMeals(
      fillMissingSlotsFromTemplates(rows, ids, todayISO(), householdTemplates, {
        createMissing: false,
      }),
    );
    setWorkouts(activity.workouts);
    setMovement(activity.movement);
    setStatus(seed.seeded ? "seeded" : "ready");
    setStatusDetail(seed.seeded ? "Mocks écrits dans repas" : "Lecture filtrée par profile_id");
  }, [view, householdTemplates]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function persistMeal(profileId: ProfileId, meal: Omit<MealEntry, "id" | "profileId">) {
    const entry: Omit<MealEntry, "id"> = { ...meal, profileId };
    const existing = meals.find((row) => row.profileId === profileId && row.type === meal.type);
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      if (existing) {
        setMeals((prev) =>
          prev.map((row) => (row.id === existing.id ? { ...row, ...entry, id: existing.id } : row)),
        );
        return;
      }
      setMeals((prev) => [
        ...prev,
        { ...entry, id: `${profileId}-${Date.now()}`, isSkipped: entry.isSkipped ?? false },
      ]);
      return;
    }
    if (existing) {
      const error = await updateMeal(supabase, { ...existing, ...entry, id: existing.id });
      if (error) {
        flash(error);
        return;
      }
      await reload();
      return;
    }
    const error = await insertMeal(supabase, entry);
    if (error) {
      flash(error);
      return;
    }
    await reload();
  }

  async function persistLoggedFood(
    source: "text" | "photo" | "barcode",
    payload: { name: string; macros: Macros; items: string[] },
  ) {
    if (!logMealType) return;
    const type = logMealType;
    const incoming: Omit<MealEntry, "id"> = {
      profileId: logProfile,
      name: payload.name,
      type,
      time: defaultMealTime(type),
      macros: payload.macros,
      source,
      items: payload.items,
      isSkipped: false,
    };

    const existing = meals.find(
      (meal) => meal.profileId === logProfile && meal.type === type,
    );

    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      if (existing) {
        setMeals((prev) =>
          prev.map((meal) =>
            meal.id === existing.id
              ? {
                  ...meal,
                  isSkipped: false,
                  name: existing.isSkipped ? incoming.name : meal.name,
                  items: existing.isSkipped
                    ? incoming.items
                    : appendPlatKeepingDessert(meal.items, incoming.items ?? []),
                  macros: existing.isSkipped
                    ? incoming.macros
                    : {
                        calories: meal.macros.calories + incoming.macros.calories,
                        protein: meal.macros.protein + incoming.macros.protein,
                        carbs: meal.macros.carbs + incoming.macros.carbs,
                        fat: meal.macros.fat + incoming.macros.fat,
                      },
                }
              : meal,
          ),
        );
      } else {
        setMeals((prev) => [...prev, { ...incoming, id: `${logProfile}-${Date.now()}` }]);
      }
      return;
    }

    if (existing) {
      const merged: MealEntry = existing.isSkipped
        ? { ...existing, ...incoming, id: existing.id, profileId: logProfile, isSkipped: false }
        : {
            ...existing,
            isSkipped: false,
            items: appendPlatKeepingDessert(existing.items, incoming.items ?? []),
            macros: {
              calories: existing.macros.calories + incoming.macros.calories,
              protein: existing.macros.protein + incoming.macros.protein,
              carbs: existing.macros.carbs + incoming.macros.carbs,
              fat: existing.macros.fat + incoming.macros.fat,
            },
          };
      const error = await updateMeal(supabase, merged);
      if (error) {
        flash(error);
        return;
      }
    } else {
      const error = await insertMeal(supabase, incoming);
      if (error) {
        flash(error);
        return;
      }
    }
    await reload();
  }

  function closeLog() {
    setLogMode(null);
    setAddSlot(null);
    setLogMealType(null);
    setTextInput("");
  }

  function startLog(profileId: ProfileId, type: MealType, mode: Exclude<LogMode, null>) {
    setAddSlot(null);
    setEditingMeal(null);
    setLogProfile(profileId);
    setLogMealType(type);
    setLogMode(mode);
    setTextInput("");
    setIngredients([]);
  }

  async function toggleSkip(meal: MealEntry) {
    const nextSkipped = !meal.isSkipped;
    setMeals((prev) =>
      prev.map((row) => (row.id === meal.id ? { ...row, isSkipped: nextSkipped } : row)),
    );
    const supabase = createBrowserSupabaseClient();
    if (!supabase) return;
    const error = await setMealSkipped(supabase, meal.id, nextSkipped);
    if (error) {
      setMeals((prev) =>
        prev.map((row) => (row.id === meal.id ? { ...row, isSkipped: meal.isSkipped } : row)),
      );
      flash(error);
      return;
    }
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
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setMeals((prev) => prev.map((meal) => (meal.id === next.id ? next : meal)));
      setEditingMeal(null);
      flash("Repas modifié (local)");
      return;
    }
    setSavingEdit(true);
    const error = await updateMeal(supabase, next);
    setSavingEdit(false);
    if (error) {
      flash(error);
      return;
    }
    setEditingMeal(null);
    await reload();
    flash("Repas enregistré");
  }

  async function restoreMeals(profileId: ProfileId, types: MealType[]) {
    if (types.length === 0) return;
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setMeals((prev) => {
        const keep = prev.filter(
          (meal) => meal.profileId !== profileId || !types.includes(meal.type),
        );
        const restored = types
          .map((type) => plannedMealEntry(profileId, type))
          .filter((row): row is MealEntry => Boolean(row));
        return [...keep, ...restored];
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

  return (
    <div>
      <p className="text-[13px] capitalize text-health-muted">{formatLongDate(todayISO())}</p>
      <h1 className="mt-0.5 text-[28px] font-bold tracking-tight">Aujourd&apos;hui</h1>
      <p className="mt-1 text-[12px] text-health-muted">
        {status === "loading" && "Connexion Supabase…"}
        {status === "seeded" && "Supabase · seed OK — jauge alimentée"}
        {status === "ready" && "Supabase · lecture par profile_id"}
        {status === "offline" && statusDetail}
        {status === "error" && `Supabase · ${statusDetail}`}
      </p>

      <div className="mt-3 flex gap-2">
        <QuickBtn icon={RefreshCw} label="Remplacement" onClick={() => void onSwap()} disabled={busy} />
        <QuickBtn icon={Copy} label="Copier hier" onClick={() => void onCopyYesterday()} disabled={busy} />
      </div>

      {activeProfiles.map((profile) => (
        <ProfileToday
          key={profile.id}
          profile={profile}
          meals={meals.filter((m) => m.profileId === profile.id)}
          ratings={ratings[profile.id]}
          onRate={(key, value) =>
            setRatings((r) => ({ ...r, [profile.id]: { ...r[profile.id], [key]: value } }))
          }
          onAddToSlot={(type) => setAddSlot({ profileId: profile.id, type })}
          onEditMeal={setEditingMeal}
          onToggleSkip={(meal) => void toggleSkip(meal)}
          onSkipEmpty={(type) => void skipEmptySlot(profile.id, type)}
          onResetMeal={(type) => void restoreMeals(profile.id, [type])}
          onResetAll={() => void restoreMeals(profile.id, ALL_MEAL_SLOTS)}
          resetting={busy}
          workouts={workouts.filter((workout) => workout.profileId === profile.id)}
          movement={movement[profile.id]}
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
            <div className="grid grid-cols-3 gap-2">
              <LogTile icon={Sparkles} label="Texte / IA" onClick={() => startLog(addSlot.profileId, addSlot.type, "text")} />
              <LogTile icon={ScanBarcode} label="Code-barres" onClick={() => startLog(addSlot.profileId, addSlot.type, "barcode")} />
              <LogTile icon={Camera} label="Photo" onClick={() => startLog(addSlot.profileId, addSlot.type, "photo")} />
            </div>
          </div>
        </div>
      )}

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
              items: ingredients.map((item) => `${item.name} ${item.grams}g`),
            });
            closeLog();
            flash("Aliment ajouté");
          }}
          onSaveBarcode={(grams) => {
            const macros = scaleMacros(
              mockBarcodeProduct.macros,
              mockBarcodeProduct.servingG,
              grams,
            );
            void persistLoggedFood("barcode", {
              name: mockBarcodeProduct.name,
              macros,
              items: [`${mockBarcodeProduct.name} ${grams}g`],
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
              items: ingredients.map((item) => `${item.name} ${item.grams}g`),
            });
            storage.setJSON("last-photo-log", ingredients);
            closeLog();
            flash("Analyse confirmée et enregistrée");
          }}
        />
      )}

      {editingMeal && (
        <EditMealSheet
          meal={editingMeal}
          saving={savingEdit}
          onClose={() => setEditingMeal(null)}
          onSave={(next) => void persistEditedMeal(next)}
          onAdd={(mode) => startLog(editingMeal.profileId, editingMeal.type, mode)}
        />
      )}

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
  ratings,
  onRate,
  onAddToSlot,
  onEditMeal,
  onToggleSkip,
  onSkipEmpty,
  onResetMeal,
  onResetAll,
  resetting,
  workouts,
  movement,
}: {
  profile: Profile;
  meals: MealEntry[];
  ratings: { hunger: number; energy: number };
  onRate: (key: "hunger" | "energy", value: number) => void;
  onAddToSlot: (type: MealType) => void;
  onEditMeal: (meal: MealEntry) => void;
  onToggleSkip: (meal: MealEntry) => void;
  onSkipEmpty: (type: MealType) => void;
  onResetMeal: (type: MealType) => void;
  onResetAll: () => void;
  resetting: boolean;
  workouts: Workout[];
  movement: DailyMovement;
}) {
  const { updateAppliedAdjustments } = useProfile();
  const [confirmResetAll, setConfirmResetAll] = useState(false);
  const current = useMemo(() => sumMacros(meals), [meals]);
  const snackTemplate = templateForSlot(
    profile.mealTemplates ?? [],
    "collation",
    isoWeekday(),
  );
  const snack = snackTemplate
    ? { name: snackTemplate.name, macros: snackTemplate.macros }
    : suggestedSnacks[profile.id];
  const sportKcal = workouts.reduce((sum, workout) => sum + workout.calories, 0);
  const passiveKcal = passiveKcalFromMovement(movement.activeEnergyKcal, sportKcal);
  const restingDisplay = sanitizeRestingKcal(movement.restingEnergyKcal, {
    bmr: profile.bmr,
    tdee: profile.tdee,
  }).value;
  const insights = coachInsights[profile.id];
  const goal = profile.primaryGoal;
  const collations = meals.filter((m) => m.type === "collation");
  const collation = collations[0];
  const nutritionAdj = visibleNutrition(profile.appliedAdjustments);
  const presentTypes = useMemo(
    () => meals.filter((meal) => !meal.isSkipped).map((meal) => meal.type),
    [meals],
  );
  const mealCoachViews = useMemo(() => {
    const map = new Map<string, MealIngredientView>();
    if (!nutritionAdj) return map;
    for (const meal of meals) {
      if (meal.isSkipped) continue;
      map.set(
        meal.id,
        translateMealAdjustments({
          mealType: meal.type,
          items: meal.items ?? [],
          deltas: nutritionAdj.deltas,
          profileId: profile.id,
          presentTypes,
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
          accent={profile.accent}
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
          if (!meal) {
            return (
              <Card key={slot}>
                <div className="flex items-start justify-between gap-3">
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onAddToSlot(slot)}>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-health-muted">
                      {mealTypeLabel(slot)}
                    </p>
                    <p className="mt-0.5 text-[14px] text-health-muted">Pas encore enregistré</p>
                    <p className="mt-1 text-[12px] font-medium">Toucher pour ajouter</p>
                  </button>
                  <SkipToggle skipped={false} onClick={() => onSkipEmpty(slot)} />
                </div>
              </Card>
            );
          }
          return (
            <MealCard
              key={meal.id}
              meal={meal}
              dailyCalories={profile.targets.calories}
              goal={goal}
              coachView={mealCoachViews.get(meal.id)}
              onDismissCoach={nutritionAdj ? () => void hideNutrition() : undefined}
              onClick={() => onEditMeal(meal)}
              onToggleSkip={() => onToggleSkip(meal)}
              onReset={() => onResetMeal(meal.type)}
            />
          );
        })}
        {collation ? (
          <MealCard
            key={collation.id}
            meal={collation}
            dailyCalories={profile.targets.calories}
            goal={goal}
            coachView={mealCoachViews.get(collation.id)}
            onDismissCoach={nutritionAdj ? () => void hideNutrition() : undefined}
            onClick={() => onEditMeal(collation)}
            onToggleSkip={() => onToggleSkip(collation)}
            onReset={() => onResetMeal(collation.type)}
          />
        ) : (
          <Card>
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
          </Card>
        )}
      </div>

      <TodayPlannedCard profile={profile} />

      <SectionTitle>Activité</SectionTitle>
      <Card>
        {workouts.length > 0 ? (
          <div className="space-y-3">
            {workouts.map((workout) => (
              <div key={workout.id}>
                <p className="text-[15px] font-medium">{workout.name}</p>
                <p className="mt-0.5 text-[13px] text-health-muted">
                  {workout.durationMin} min · {workout.calories} kcal ·{" "}
                  {workout.source === "strava" ? "Strava" : "Apple Santé"}
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
          <HealthMetricTile compact label="Hors sport" value={`${passiveKcal}`} />
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

      <SectionTitle>Faim & énergie</SectionTitle>
      <Card>
        <RatingRow label="Faim" value={ratings.hunger} onChange={(v) => onRate("hunger", v)} />
        <div className="my-3 h-px bg-health-line" />
        <RatingRow label="Énergie" value={ratings.energy} onChange={(v) => onRate("energy", v)} />
      </Card>

      <SectionTitle>Coach</SectionTitle>
      <div className="space-y-2">
        {insights.map((insight) => (
          <Card key={insight.title}>
            <p className="text-[13px] font-semibold">{insight.title}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-health-muted">{insight.message}</p>
          </Card>
        ))}
      </div>
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
  onDismissCoach,
  onClick,
  onToggleSkip,
  onReset,
}: {
  meal: MealEntry;
  dailyCalories: number;
  goal: Profile["primaryGoal"];
  coachView?: MealIngredientView;
  onDismissCoach?: () => void;
  onClick: () => void;
  onToggleSkip: () => void;
  onReset?: () => void;
}) {
  const skipped = Boolean(meal.isSkipped);
  const adds = coachView?.adds ?? [];
  const highlighted = Boolean(!skipped && adds.length > 0);
  const displayItems = skipped
    ? []
    : (coachView?.items ?? (meal.items ?? []).map((text) => ({ text, boosted: false })));
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
            {displayItems.length > 0 && (
              <MealItemsList items={displayItems} mealType={meal.type} />
            )}
            {highlighted && (
              <div className="mt-2">
                <CoachBadge onDismiss={onDismissCoach} />
                <CoachDiffTags tags={coachView?.badges ?? []} />
              </div>
            )}
            {onReset && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onReset();
                }}
                className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-health-muted"
              >
                <RotateCcw size={11} />
                Réinit.
              </button>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
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

function MealItemsList({
  items,
  mealType,
}: {
  items: { text: string; boosted: boolean }[];
  mealType: MealType;
}) {
  const showSplit = mealType === "dejeuner" || mealType === "diner";
  const plat = items.filter((item) => !isDessertItemLine(item.text) && !isEmptyDessertMarker(item.text));
  const dessert = items.filter((item) => isDessertItemLine(item.text) && !isEmptyDessertMarker(item.text));

  if (!showSplit || dessert.length === 0) {
    const visible = items.filter((item) => !isEmptyDessertMarker(item.text));
    if (visible.length === 0) return null;
    return (
      <p className="mt-1 text-[12px] leading-relaxed text-health-muted">
        {visible.map((item, index) => (
          <span key={`${item.text}-${index}`}>
            {index > 0 ? " · " : null}
            <span className={item.boosted ? "font-medium text-coral-dark" : undefined}>
              {isDessertItemLine(item.text) ? stripDessertPrefix(item.text) : item.text}
            </span>
          </span>
        ))}
      </p>
    );
  }

  return (
    <div className="mt-1.5 space-y-1.5">
      {plat.length > 0 ? (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-health-muted">Plat</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-health-muted">
            {plat.map((item, index) => (
              <span key={`plat-${item.text}-${index}`}>
                {index > 0 ? " · " : null}
                <span className={item.boosted ? "font-medium text-coral-dark" : undefined}>{item.text}</span>
              </span>
            ))}
          </p>
        </div>
      ) : null}
      <div className="rounded-lg bg-amber-50 px-2 py-1.5 dark:bg-amber-950/40">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-800 dark:text-amber-200">
          Dessert
        </p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-health-ink">
          {dessert.map((item, index) => (
            <span key={`dessert-${item.text}-${index}`}>
              {index > 0 ? " · " : null}
              {stripDessertPrefix(item.text)}
            </span>
          ))}
        </p>
      </div>
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

function RatingRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[14px] font-medium">{label}</span>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={cn(
              "h-8 w-8 rounded-full text-[13px] font-semibold",
              n <= value ? "bg-health-ink text-white" : "bg-health-bg text-health-muted",
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

function LogSheet({
  mode,
  mealType,
  profileId,
  textInput,
  setTextInput,
  ingredients,
  setIngredients,
  onClose,
  onAnalyzeText,
  onSaveText,
  onSaveBarcode,
  onSavePhoto,
}: {
  mode: Exclude<LogMode, null>;
  mealType: MealType;
  profileId: ProfileId;
  textInput: string;
  setTextInput: (v: string) => void;
  ingredients: DetectedIngredient[];
  setIngredients: Dispatch<SetStateAction<DetectedIngredient[]>>;
  onClose: () => void;
  onAnalyzeText: () => void | Promise<void>;
  onSaveText: () => void;
  onSaveBarcode: (grams: number) => void;
  onSavePhoto: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [newGrams, setNewGrams] = useState("10");
  const [textReview, setTextReview] = useState(false);
  const [photoReady, setPhotoReady] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [barcodeGrams, setBarcodeGrams] = useState(mockBarcodeProduct.servingG);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    setTextReview(false);
    setPhotoReady(false);
    setPhotoError(null);
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setBarcodeGrams(mockBarcodeProduct.servingG);
  }, [mode]);

  async function analyzePhoto(file: File) {
    setAnalyzing(true);
    setPhotoError(null);
    setPhotoReady(false);
    setIngredients([]);
    const url = URL.createObjectURL(file);
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
    try {
      const form = new FormData();
      form.append("image", file);
      form.append("diet", profileId === "elodie" ? "omnivore" : "vegan");
      const res = await withGeminiWait("Gemini lit la photo…", () =>
        fetch("/api/log-photo", { method: "POST", body: form }),
      );
      const data = (await res.json()) as { ingredients?: DetectedIngredient[]; error?: string };
      if (!res.ok || !Array.isArray(data.ingredients) || data.ingredients.length === 0) {
        setPhotoError(data.error ?? "Aucun aliment reconnu. Réessaie avec une autre photo.");
        return;
      }
      setIngredients(data.ingredients);
      setPhotoReady(true);
    } catch {
      setPhotoError("Analyse photo indisponible. Réessaie.");
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
      <div className="w-full max-w-[430px] rounded-t-[24px] bg-white p-4 pb-8 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[17px] font-semibold">
            {mode === "text" && (textReview ? "Relecture texte / IA" : "Saisie texte / IA")}
            {mode === "barcode" && "Produit reconnu"}
            {mode === "photo" && (photoReady ? "Relecture photo" : "Photo du repas")}
          </h3>
          <button type="button" onClick={onClose} className="rounded-full bg-health-bg p-1.5">
            <X size={16} />
          </button>
        </div>
        <p className="mb-3 text-[12px] text-health-muted">
          {profileId === "alexis" ? "Alexis" : "Élodie"} · {mealTypeLabel(mealType)}
        </p>

        {mode === "text" && !textReview && (
          <>
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Ex. tranche de pain bûcheron avec de la margarine"
              className="h-24 w-full rounded-card bg-health-bg p-3 text-[14px] outline-none"
            />
            <p className="mt-2 text-[11px] leading-relaxed text-health-muted">
              Chaque aliment est séparé (avec, et, virgule). Un poids écrit comme 20 g / 20 gr est repris tel quel.
            </p>
            <button
              type="button"
              disabled={analyzing || !textInput.trim()}
              onClick={() => {
                void (async () => {
                  setAnalyzing(true);
                  try {
                    await onAnalyzeText();
                    setTextReview(true);
                  } finally {
                    setAnalyzing(false);
                  }
                })();
              }}
              className="mt-3 w-full rounded-card bg-health-ink py-3 text-[15px] font-semibold text-white disabled:opacity-50"
            >
              {analyzing ? "Analyse…" : "Analyser"}
            </button>
          </>
        )}

        {mode === "text" && textReview && (
          <IngredientReview
            ingredients={ingredients}
            setIngredients={setIngredients}
            newName={newName}
            setNewName={setNewName}
            newGrams={newGrams}
            setNewGrams={setNewGrams}
            onSave={onSaveText}
          />
        )}

        {mode === "barcode" && (
          <BarcodeQuantityEditor
            grams={barcodeGrams}
            onChange={setBarcodeGrams}
            mealType={mealType}
            onSave={() => onSaveBarcode(barcodeGrams)}
          />
        )}

        {mode === "photo" && !photoReady && (
          <>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-card bg-health-bg py-8">
              {photoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoPreview}
                  alt="Aperçu du repas"
                  className="h-28 w-28 rounded-2xl object-cover"
                />
              ) : (
                <Camera size={28} />
              )}
              <span className="text-[14px] font-semibold">
                {analyzing ? "Analyse de la photo…" : "Prendre / importer une photo"}
              </span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                disabled={analyzing}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void analyzePhoto(file);
                }}
              />
            </label>
            {photoError ? <p className="mt-2 text-[12px] text-coral">{photoError}</p> : null}
            <p className="mt-2 text-[11px] leading-relaxed text-health-muted">
              L&apos;IA liste les aliments visibles. Tu corriges les grammes avant d&apos;enregistrer.
            </p>
          </>
        )}

        {mode === "photo" && photoReady && (
          <>
            <button
              type="button"
              onClick={() => {
                setPhotoReady(false);
                setPhotoError(null);
              }}
              className="mb-3 text-[12px] font-semibold text-health-muted"
            >
              Autre photo
            </button>
            <IngredientReview
              ingredients={ingredients}
              setIngredients={setIngredients}
              newName={newName}
              setNewName={setNewName}
              newGrams={newGrams}
              setNewGrams={setNewGrams}
              onSave={onSavePhoto}
            />
          </>
        )}
      </div>
    </div>
  );
}

function BarcodeQuantityEditor({
  grams,
  onChange,
  mealType,
  onSave,
}: {
  grams: number;
  onChange: (grams: number) => void;
  mealType: MealType;
  onSave: () => void;
}) {
  const product = mockBarcodeProduct;
  const macros = scaleMacros(product.macros, product.servingG, grams);
  const presets = [
    { label: "¼ portion", value: Math.max(1, Math.round(product.servingG / 4)) },
    { label: "½ portion", value: Math.max(1, Math.round(product.servingG / 2)) },
    { label: "1 portion", value: product.servingG },
    { label: "1 paquet", value: product.packG },
  ];

  function setGrams(next: number) {
    onChange(Math.max(1, Math.round(next)));
  }

  return (
    <>
      <Card className="bg-health-bg shadow-none">
        <p className="text-[11px] text-health-muted">{product.barcode}</p>
        <p className="text-[16px] font-semibold">{product.name}</p>
        <p className="text-[13px] text-health-muted">
          {product.brand} · étiquette {product.servingG}g · paquet {product.packG}g
        </p>
      </Card>

      <p className="mb-2 mt-4 text-[13px] font-medium">Quantité consommée</p>
      <p className="mb-3 text-[12px] leading-relaxed text-health-muted">
        Tu n&apos;es pas obligé de logger tout le paquet. Ajuste les grammes, les macros suivent.
      </p>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {presets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => setGrams(preset.value)}
            className={cn(
              "rounded-full px-3 py-1.5 text-[12px] font-semibold",
              grams === preset.value ? "bg-health-ink text-white" : "bg-health-bg text-health-muted",
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-center gap-3 rounded-card bg-health-bg p-3">
        <button
          type="button"
          className="h-10 w-10 rounded-full bg-white text-xl leading-none"
          onClick={() => setGrams(grams - 5)}
        >
          −
        </button>
        <div className="flex items-baseline gap-1">
          <input
            inputMode="numeric"
            value={grams}
            onChange={(e) => setGrams(Number(e.target.value) || 1)}
            className="w-16 rounded-md bg-white py-1 text-center text-[22px] font-semibold tabular-nums"
          />
          <span className="text-[13px] text-health-muted">g</span>
        </div>
        <button
          type="button"
          className="h-10 w-10 rounded-full bg-white text-xl leading-none"
          onClick={() => setGrams(grams + 5)}
        >
          +
        </button>
      </div>

      <Card className="mt-3 bg-health-bg shadow-none">
        <p className="text-[13px] font-semibold tabular-nums">
          {macros.calories} kcal · {macros.protein}g P · {macros.carbs}g G · {macros.fat}g L
        </p>
        <p className="mt-1 text-[11px] text-health-muted">
          Recalculé depuis {product.servingG}g ({product.macros.calories} kcal)
        </p>
      </Card>

      <button
        type="button"
        onClick={onSave}
        className="mt-3 w-full rounded-card bg-health-ink py-3 text-[15px] font-semibold text-white"
      >
        Ajouter {grams}g au {mealTypeLabel(mealType).toLowerCase()}
      </button>
    </>
  );
}

function IngredientReview({
  ingredients,
  setIngredients,
  newName,
  setNewName,
  newGrams,
  setNewGrams,
  onSave,
}: {
  ingredients: DetectedIngredient[];
  setIngredients: Dispatch<SetStateAction<DetectedIngredient[]>>;
  newName: string;
  setNewName: (value: string) => void;
  newGrams: string;
  setNewGrams: (value: string) => void;
  onSave: () => void;
}) {
  const totals = macrosFromIngredients(ingredients);

  function bumpGrams(id: string, delta: number) {
    setIngredients((list) =>
      list.map((item) => (item.id === id ? scaleDetected(item, item.grams + delta) : item)),
    );
  }

  return (
    <>
      <p className="mb-2 text-[12px] leading-relaxed text-health-muted">
        L&apos;analyse n&apos;est pas enregistrée tant que tu n&apos;as pas confirmé. Ajuste, supprime ou ajoute.
      </p>
      <div className="max-h-[38vh] space-y-2 overflow-y-auto">
        {ingredients.map((ing) => (
          <div key={ing.id} className="flex items-center gap-2 rounded-card bg-health-bg p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium">{ing.name}</p>
              <p className="text-[11px] text-health-muted">
                {ing.calories} kcal · {ing.protein}g P · {ing.carbs ?? 0}g G · {ing.fat ?? 0}g L
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="h-8 w-8 rounded-full bg-white text-lg leading-none"
                onClick={() => bumpGrams(ing.id, -10)}
              >
                −
              </button>
              <input
                value={ing.grams}
                onChange={(e) => {
                  const grams = Number(e.target.value);
                  if (!Number.isFinite(grams) || grams <= 0) return;
                  setIngredients((list) =>
                    list.map((item) => (item.id === ing.id ? scaleDetected(item, grams) : item)),
                  );
                }}
                className="w-12 rounded-md bg-white text-center text-[13px] tabular-nums"
              />
              <span className="text-[11px] text-health-muted">g</span>
              <button
                type="button"
                className="h-8 w-8 rounded-full bg-white text-lg leading-none"
                onClick={() => bumpGrams(ing.id, 10)}
              >
                +
              </button>
              <button
                type="button"
                className="ml-1 text-health-muted"
                onClick={() => setIngredients((list) => list.filter((item) => item.id !== ing.id))}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
      {ingredients.length > 0 && (
        <p className="mt-2 text-[12px] font-semibold tabular-nums text-health-muted">
          Total {totals.calories} kcal · {totals.protein}g P · {totals.carbs}g G · {totals.fat}g L
        </p>
      )}
      <div className="mt-2 flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Huile d'olive"
          className="flex-1 rounded-card bg-health-bg px-3 text-[13px]"
        />
        <input
          value={newGrams}
          onChange={(e) => setNewGrams(e.target.value)}
          className="w-16 rounded-card bg-health-bg text-center text-[13px]"
        />
        <button
          type="button"
          className="rounded-card bg-health-bg px-3"
          onClick={() => {
            if (!newName.trim()) return;
            const grams = Number(newGrams) || 10;
            const parsed = parseFoodTextLocal(`${newName.trim()} ${grams}g`)[0];
            setIngredients((list) => [
              ...list,
              parsed
                ? { ...scaleDetected(parsed, grams), id: `n-${Date.now()}` }
                : {
                    id: `n-${Date.now()}`,
                    name: newName.trim(),
                    grams,
                    calories: Math.round(grams * 4.5),
                    protein: 0,
                  },
            ]);
            setNewName("");
          }}
        >
          <Plus size={16} />
        </button>
      </div>
      <button
        type="button"
        onClick={onSave}
        className="mt-3 w-full rounded-card bg-health-ink py-3 text-[15px] font-semibold text-white"
      >
        Confirmer & enregistrer
      </button>
    </>
  );
}
