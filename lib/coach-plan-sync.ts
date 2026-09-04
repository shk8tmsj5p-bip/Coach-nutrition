import {
  FULL_DAY_SLOTS,
  mergeCoachNote,
  normalizeFoodName,
  stripCoachNote,
  translateMealAdjustments,
  type CoachIngredientAdd,
} from "@/lib/coach-ingredients";
import { isoWeekday, mondayOf, todayISO } from "@/lib/dates";
import { aisleFor, shoppingItemsFromPlan } from "@/lib/shopping-from-plan";
import { storage } from "@/lib/storage";
import {
  persistWeekShopping,
  shopCheckedKey,
  shopCustomKey,
} from "@/lib/supabase/shopping-list";
import type { Macros, PlannedMeal, ProfileId, RecipeIngredient, ShoppingListItem } from "@/lib/types";
import { gramsFor, isEmptyMeal } from "@/lib/weekly-plan";

export type PlanBoostAddition = {
  mealId: string;
  ingredientId: string;
  grams: number;
  name: string;
  created?: boolean;
};

export type PlanBoostRecord = {
  weekStart: string;
  profileId: ProfileId;
  deltas: Macros;
  additions: PlanBoostAddition[];
};

function boostKey(weekStart: string, profileId: ProfileId) {
  return `coach-plan-boost:${weekStart}:${profileId}`;
}

export function isShoppingCompleted(weekStart: string, plan: PlannedMeal[]) {
  const derived = shoppingItemsFromPlan(plan);
  if (derived.length === 0) return false;
  const checked = storage.getJSON<string[]>(shopCheckedKey(weekStart), []);
  return derived.every((item) => checked.includes(item.id));
}

export function remainingDaysInWeek(weekStart: string, today = todayISO()) {
  const currentMonday = mondayOf(today);
  if (weekStart > currentMonday) return 7;
  if (weekStart < currentMonday) return 0;
  return 8 - isoWeekday(today);
}

function sameDeltas(a: Macros, b: Macros) {
  return a.calories === b.calories && a.protein === b.protein && a.carbs === b.carbs && a.fat === b.fat;
}

export function loadBoostRecord(weekStart: string, profileId: ProfileId): PlanBoostRecord | null {
  const raw = storage.getJSON<PlanBoostRecord | null>(boostKey(weekStart, profileId), null);
  if (!raw || raw.weekStart !== weekStart || raw.profileId !== profileId) return null;
  return raw;
}

function saveBoostRecord(record: PlanBoostRecord | null, weekStart: string, profileId: ProfileId) {
  if (!record) {
    storage.remove(boostKey(weekStart, profileId));
    return;
  }
  storage.setJSON(boostKey(weekStart, profileId), record);
}

function patchProfileGrams(item: RecipeIngredient, profileId: ProfileId, delta: number): RecipeIngredient {
  if (profileId === "alexis") {
    return { ...item, gramsAlexis: Math.max(0, Math.round(item.gramsAlexis + delta)) };
  }
  return { ...item, gramsElodie: Math.max(0, Math.round(item.gramsElodie + delta)) };
}

function revertProfileBoost(plan: PlannedMeal[], record: PlanBoostRecord | null): PlannedMeal[] {
  if (!record || record.additions.length === 0) return plan;
  return plan.map((meal) => {
    const mealAdds = record.additions.filter((item) => item.mealId === meal.id);
    if (mealAdds.length === 0) return meal;
    const ingredients = meal.ingredients
      .map((ing) => {
        const add = mealAdds.find((item) => item.ingredientId === ing.id);
        if (!add) return ing;
        const hasCoachNote = /dont [+\-−]?\d+\s*g coach/i.test(ing.notes ?? "");
        if (!hasCoachNote && !add.created) return ing;
        const next = patchProfileGrams(ing, record.profileId, -add.grams);
        return {
          ...next,
          notes: stripCoachNote(ing.notes) || undefined,
        };
      })
      .filter((ing) => {
        const created = mealAdds.find((item) => item.ingredientId === ing.id)?.created;
        if (!created) return true;
        return gramsFor(ing, record.profileId) > 0;
      });
    return { ...meal, ingredients };
  });
}

function findIngredientForAdd(
  ingredients: RecipeIngredient[],
  profileId: ProfileId,
  add: CoachIngredientAdd,
) {
  const addKey = normalizeFoodName(add.name);
  const scored = ingredients
    .filter(
      (ing) =>
        ing.role === "shared" || ing.role === profileId || gramsFor(ing, profileId) > 0,
    )
    .map((ing) => {
      const key = normalizeFoodName(ing.name);
      const nameHit = key.includes(addKey) || addKey.includes(key);
      return { ing, nameHit, grams: gramsFor(ing, profileId) };
    })
    .filter((row) => row.nameHit);
  return scored.sort((a, b) => b.grams - a.grams)[0]?.ing;
}

function applyAddsToMeal(
  meal: PlannedMeal,
  profileId: ProfileId,
  adds: CoachIngredientAdd[],
): { meal: PlannedMeal; additions: PlanBoostAddition[] } {
  if (adds.length === 0) return { meal, additions: [] };
  let ingredients = meal.ingredients.map((item) => ({ ...item }));
  const additions: PlanBoostAddition[] = [];

  for (const add of adds) {
    const existing = findIngredientForAdd(ingredients, profileId, add);
    if (existing) {
      ingredients = ingredients.map((ing) => {
        if (ing.id !== existing.id) return ing;
        const next = patchProfileGrams(ing, profileId, add.addGrams);
        return { ...next, notes: mergeCoachNote(ing.notes, add.addGrams) };
      });
      additions.push({
        mealId: meal.id,
        ingredientId: existing.id,
        grams: add.addGrams,
        name: existing.name,
      });
      continue;
    }

    const id = `coach-boost-${profileId}-${add.kind}-${meal.id}`;
    const created: RecipeIngredient = {
      id,
      name: add.name,
      role: profileId,
      gramsAlexis: profileId === "alexis" ? Math.max(0, add.addGrams) : 0,
      gramsElodie: profileId === "elodie" ? Math.max(0, add.addGrams) : 0,
      notes: mergeCoachNote(undefined, add.addGrams),
    };
    ingredients = [...ingredients, created];
    additions.push({
      mealId: meal.id,
      ingredientId: id,
      grams: add.addGrams,
      name: add.name,
      created: true,
    });
  }

  return { meal: { ...meal, ingredients }, additions };
}

function extrasFromAdds(
  profileId: ProfileId,
  adds: CoachIngredientAdd[],
  remainingDays: number,
): ShoppingListItem[] {
  if (remainingDays <= 0) return [];
  return adds.map((add) => {
    const total = Math.round(Math.abs(add.addGrams) * remainingDays);
    const gramsAlexis = profileId === "alexis" ? total : 0;
    const gramsElodie = profileId === "elodie" ? total : 0;
    return {
      id: `coach-extra:${profileId}:${normalizeFoodName(add.name)}`,
      name: add.name,
      aisle: aisleFor(add.name),
      quantityLabel: `${total}g`,
      gramsAlexis,
      gramsElodie,
      notes: `${add.badge} × ${remainingDays} j`,
      custom: true,
    };
  });
}

function upsertCoachShopExtras(weekStart: string, profileId: ProfileId, extras: ShoppingListItem[]) {
  const current = storage.getJSON<ShoppingListItem[]>(shopCustomKey(weekStart), []);
  const prefix = `coach-extra:${profileId}:`;
  const kept = current.filter((item) => !item.id.startsWith(prefix));
  const custom = [...kept, ...extras];
  const checked = storage.getJSON<string[]>(shopCheckedKey(weekStart), []);
  storage.setJSON(shopCustomKey(weekStart), custom);
  void persistWeekShopping(weekStart, { checked, custom });
}

function applyProfileBoost(
  plan: PlannedMeal[],
  profileId: ProfileId,
  deltas: Macros,
  weekStart: string,
  today = todayISO(),
): { plan: PlannedMeal[]; record: PlanBoostRecord; extras: ShoppingListItem[] } {
  const remainingDays = remainingDaysInWeek(weekStart, today);
  const currentMonday = mondayOf(today);
  const minDayIndex =
    weekStart === currentMonday ? isoWeekday(today) - 1 : weekStart > currentMonday ? 0 : 99;

  const breakfastView = translateMealAdjustments({
    mealType: "petit-dejeuner",
    items: ["Flocons d'avoine 60g", "Graines de chia 10g"],
    deltas,
    profileId,
    presentTypes: FULL_DAY_SLOTS,
  });
  const snackView = translateMealAdjustments({
    mealType: "collation",
    items: ["Banane 80g"],
    deltas,
    profileId,
    presentTypes: FULL_DAY_SLOTS,
  });

  let next = plan;
  const additions: PlanBoostAddition[] = [];

  next = next.map((meal) => {
    if (isEmptyMeal(meal) || meal.dayIndex < minDayIndex) return meal;
    const items = meal.ingredients
      .filter((ing) => ing.role === "shared" || ing.role === profileId || gramsFor(ing, profileId) > 0)
      .map((ing) => `${ing.name} ${gramsFor(ing, profileId)}g`);
    const view = translateMealAdjustments({
      mealType: meal.mealType,
      items,
      deltas,
      profileId,
      presentTypes: FULL_DAY_SLOTS,
    });
    const applied = applyAddsToMeal(meal, profileId, view.adds);
    additions.push(...applied.additions);
    return applied.meal;
  });

  return {
    plan: next,
    record: { weekStart, profileId, deltas, additions },
    extras: [
      ...extrasFromAdds(profileId, breakfastView.adds, remainingDays),
      ...extrasFromAdds(profileId, snackView.adds, remainingDays),
    ],
  };
}

export function applyCoachBoostsToLoadedPlan(opts: {
  weekStart: string;
  plan: PlannedMeal[];
  profiles: Array<{ id: ProfileId; deltas: Macros | null }>;
  today?: string;
  force?: boolean;
}): { plan: PlannedMeal[]; skippedShopping: boolean; changed: boolean } {
  const today = opts.today ?? todayISO();
  if (opts.plan.every(isEmptyMeal)) {
    return { plan: opts.plan, skippedShopping: false, changed: false };
  }
  if (isShoppingCompleted(opts.weekStart, opts.plan)) {
    return { plan: opts.plan, skippedShopping: true, changed: false };
  }
  if (remainingDaysInWeek(opts.weekStart, today) <= 0) {
    return { plan: opts.plan, skippedShopping: false, changed: false };
  }

  let plan = opts.plan;
  let changed = false;

  for (const profile of opts.profiles) {
    const previous = loadBoostRecord(opts.weekStart, profile.id);
    if (!profile.deltas) {
      if (previous) {
        plan = revertProfileBoost(plan, previous);
        saveBoostRecord(null, opts.weekStart, profile.id);
        upsertCoachShopExtras(opts.weekStart, profile.id, []);
        changed = true;
      }
      continue;
    }
    if (!opts.force && previous && sameDeltas(previous.deltas, profile.deltas)) {
      const missing = previous.additions.some((add) => {
        const meal = plan.find((item) => item.id === add.mealId);
        return !meal?.ingredients.some((ing) => ing.id === add.ingredientId);
      });
      if (!missing) continue;
    }

    plan = revertProfileBoost(plan, previous);
    const applied = applyProfileBoost(plan, profile.id, profile.deltas, opts.weekStart, today);
    plan = applied.plan;
    saveBoostRecord(applied.record, opts.weekStart, profile.id);
    upsertCoachShopExtras(opts.weekStart, profile.id, applied.extras);
    changed = true;
  }

  return { plan, skippedShopping: false, changed };
}
