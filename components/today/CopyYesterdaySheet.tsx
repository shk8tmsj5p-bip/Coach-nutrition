"use client";

import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { MEAL_TYPE_OPTIONS } from "@/lib/meal-items";
import type { MealEntry, MealType, Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CopyYesterdaySheet({
  yesterdayMeals,
  profiles,
  confirming,
  onClose,
  onConfirm,
}: {
  yesterdayMeals: MealEntry[];
  profiles: Profile[];
  confirming: boolean;
  onClose: () => void;
  onConfirm: (types: MealType[]) => void;
}) {
  const availableTypes = useMemo(
    () =>
      MEAL_TYPE_OPTIONS.filter((option) =>
        yesterdayMeals.some((meal) => meal.type === option.id && !meal.isSkipped),
      ).map((option) => option.id),
    [yesterdayMeals],
  );

  const [selected, setSelected] = useState<MealType[]>(availableTypes);

  function toggle(type: MealType) {
    if (!availableTypes.includes(type)) return;
    setSelected((current) =>
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type],
    );
  }

  const allSelected =
    availableTypes.length > 0 && availableTypes.every((type) => selected.includes(type));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
      <div className="w-full max-w-[430px] rounded-t-[24px] bg-white p-4 pb-8 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[17px] font-semibold">Copier d&apos;hier</h3>
          <button type="button" onClick={onClose} className="rounded-full bg-health-bg p-1.5">
            <X size={16} />
          </button>
        </div>
        <p className="mb-3 text-[13px] leading-snug text-health-muted">
          Choisis les repas à reprendre. Ils remplacent le même créneau aujourd&apos;hui.
        </p>

        {availableTypes.length > 1 && (
          <button
            type="button"
            onClick={() => setSelected(allSelected ? [] : availableTypes)}
            className="mb-2 text-[13px] font-semibold text-health-ink"
          >
            {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
          </button>
        )}

        <div className="grid gap-2">
          {MEAL_TYPE_OPTIONS.map((option) => {
            const meals = yesterdayMeals.filter(
              (meal) => meal.type === option.id && !meal.isSkipped,
            );
            const enabled = meals.length > 0;
            const isOn = selected.includes(option.id);

            return (
              <button
                key={option.id}
                type="button"
                disabled={!enabled}
                onClick={() => toggle(option.id)}
                className={cn(
                  "flex items-start gap-3 rounded-card px-3 py-3 text-left",
                  enabled ? "bg-health-bg" : "bg-health-bg opacity-40",
                  isOn && "ring-1 ring-health-ink/20",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                    isOn ? "bg-health-ink text-white" : "border border-health-muted/40 bg-white",
                  )}
                >
                  {isOn && <Check size={12} strokeWidth={3} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold">{option.label}</span>
                  {enabled ? (
                    meals.map((meal) => {
                      const profile = profiles.find((item) => item.id === meal.profileId);
                      return (
                        <span
                          key={meal.id}
                          className="mt-0.5 block truncate text-[12px] font-normal text-health-muted"
                        >
                          {profiles.length > 1 && profile ? `${profile.name} · ` : ""}
                          {meal.name}
                        </span>
                      );
                    })
                  ) : (
                    <span className="mt-0.5 block text-[12px] font-normal text-health-muted">
                      Aucun repas hier
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          disabled={confirming || selected.length === 0}
          onClick={() => onConfirm(selected)}
          className="mt-4 w-full rounded-card bg-health-ink py-3 text-[15px] font-semibold text-white disabled:opacity-50"
        >
          {confirming
            ? "Copie…"
            : selected.length <= 1
              ? "Copier ce repas"
              : `Copier ${selected.length} repas`}
        </button>
      </div>
    </div>
  );
}
