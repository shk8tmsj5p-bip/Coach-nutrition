import type { PlannedMeal } from "@/lib/types";
import { dessertWeekdaysOf, isWeekLunchDessert } from "@/lib/week-dessert";

export type QtyMode = "repas" | "batch";

export function cookScale(meal: PlannedMeal, mode: QtyMode) {
  if (mode === "repas") return 1;
  if (isWeekLunchDessert(meal)) return Math.max(1, dessertWeekdaysOf(meal).length);
  return meal.servingsPerPerson || 1;
}

export function qtyModeChoices(meal: PlannedMeal): Array<{
  id: QtyMode;
  label: string;
  detail: string;
}> {
  if (isWeekLunchDessert(meal)) {
    const n = dessertWeekdaysOf(meal).length;
    const when = /soir/i.test(meal.day) ? "soir" : "midi";
    return [
      { id: "repas", label: "1 part", detail: `Une part / pers. · un ${when}` },
      {
        id: "batch",
        label: n > 1 ? `${n} jours` : "1 jour",
        detail: `Tout le dessert ${when} de la semaine · 2 pers.`,
      },
    ];
  }
  if (meal.servingsPerPerson === 2) {
    return [
      { id: "repas", label: "1 repas", detail: "Une assiette / pers." },
      {
        id: "batch",
        label: "2 repas",
        detail: `${meal.coverLabel || "batch"} · 4 assiettes foyer`,
      },
    ];
  }
  return [{ id: "repas", label: "1 repas", detail: "Une assiette / pers. · frais" }];
}

export function qtyModeShortLabel(meal: PlannedMeal, mode: QtyMode) {
  return qtyModeChoices(meal).find((row) => row.id === mode)?.label ?? "1 repas";
}

export function cookQtyCaption(meal: PlannedMeal, mode: QtyMode) {
  if (isWeekLunchDessert(meal)) {
    const n = dessertWeekdaysOf(meal).length;
    const when = /soir/i.test(meal.day) ? "soir" : "midi";
    if (mode === "repas") return `Quantités · 1 part / pers. (un ${when})`;
    return `Quantités · ${n} ${when}${n > 1 ? "s" : ""} × 2 pers.`;
  }
  if (mode === "repas") {
    return meal.servingsPerPerson === 2
      ? "Quantités · 1 repas / pers. · touche [P] pour voir les 2 repas"
      : "Quantités · 1 repas / pers.";
  }
  if (meal.servingsPerPerson === 2) {
    return "Quantités · 2 repas · 4 assiettes foyer";
  }
  return "Quantités · 1 repas foyer";
}
