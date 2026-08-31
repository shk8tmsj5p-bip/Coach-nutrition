import { isEmptyDessertMarker } from "@/lib/meal-templates";
import type { MealEntry, MealType, ProfileId } from "@/lib/types";

export const MEAL_SLOT_TIME: Record<MealType, string> = {
  "petit-dejeuner": "08:00",
  dejeuner: "12:30",
  diner: "20:00",
  collation: "16:30",
};

export function slotTime(type: MealType) {
  return MEAL_SLOT_TIME[type];
}

export function slotOfProfile(list: MealEntry[], profileId: ProfileId, type: MealType) {
  return list.find((meal) => meal.profileId === profileId && meal.type === type);
}

export function isFilledMeal(meal: MealEntry | undefined) {
  if (!meal || meal.isSkipped) return false;
  const items = (meal.items ?? []).filter(
    (line) => line.trim() && !isEmptyDessertMarker(line),
  );
  if (items.length > 0) return true;
  if (meal.macros.calories > 0) return true;
  const name = meal.name.trim().toLowerCase();
  return name.length > 0 && name !== "repas sauté";
}

export function skippedSlotPlaceholder(
  profileId: ProfileId,
  type: MealType,
  date?: string,
): Omit<MealEntry, "id"> {
  return {
    name: "Repas sauté",
    type,
    time: slotTime(type),
    macros: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    profileId,
    source: "log",
    items: [],
    isSkipped: true,
    date,
  };
}

/** Si le créneau cible a déjà un repas, on échange les deux. Sinon on déplace. */
export function planSlotMove(
  original: MealEntry,
  next: MealEntry,
  occupant: MealEntry | undefined,
): { moved: MealEntry; displaced?: MealEntry; vacated?: Omit<MealEntry, "id"> } {
  const moved: MealEntry = {
    ...next,
    id: original.id,
    profileId: original.profileId,
    type: next.type,
    time: slotTime(next.type),
    date: next.date ?? original.date,
  };
  if (next.type === original.type) {
    return { moved: { ...moved, time: next.time || original.time || slotTime(next.type) } };
  }
  if (occupant && occupant.id !== original.id) {
    return {
      moved,
      displaced: {
        ...occupant,
        type: original.type,
        time: occupant.time || slotTime(original.type),
      },
    };
  }
  return {
    moved,
    vacated: skippedSlotPlaceholder(original.profileId, original.type, original.date ?? next.date),
  };
}

export function occupantOfSlot(
  list: MealEntry[],
  profileId: ProfileId,
  type: MealType,
  exceptId?: string,
  date?: string,
) {
  return list.find((meal) => {
    if (meal.profileId !== profileId || meal.type !== type || meal.id === exceptId) return false;
    if (date && meal.date && meal.date !== date) return false;
    return true;
  });
}

export function applySlotMoveToMeals<T extends MealEntry>(
  list: T[],
  original: T,
  next: T,
): T[] {
  const date = next.date ?? original.date;
  const occupant = occupantOfSlot(
    list,
    original.profileId,
    next.type,
    original.id,
    date,
  ) as T | undefined;
  const plan = planSlotMove(original, next, occupant);
  const inList = list.some((row) => row.id === original.id);
  let result = inList
    ? list.map((row) => {
        if (row.id === plan.moved.id) return { ...row, ...plan.moved } as T;
        if (plan.displaced && row.id === plan.displaced.id) {
          return { ...row, ...plan.displaced } as T;
        }
        return row;
      })
    : [...list, plan.moved as T];
  if (plan.vacated) {
    result = [
      ...result,
      {
        ...plan.vacated,
        id: `skip-${plan.vacated.profileId}-${plan.vacated.type}-${Date.now()}`,
      } as T,
    ];
  }
  return result;
}

/** Rempli ou sauté — les quatre créneaux sont « rangés ». */
export function isAccountedMeal(meal: MealEntry | undefined) {
  if (!meal) return false;
  if (meal.isSkipped) return true;
  return isFilledMeal(meal);
}
