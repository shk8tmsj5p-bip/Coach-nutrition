"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { EditMealSheet } from "@/components/today/EditMealSheet";
import { CompactMacrosRow } from "@/components/ui/MacroProgress";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { isStoredMealId, pickCanonicalMeals, setMealSkipped, upsertMeal } from "@/lib/supabase/today-data";
import { energyBalanceLook, formatSignedKcal } from "@/lib/energy-balance";
import { emptyMacros, mealsOnDate, sumDayMacros } from "@/lib/energy-history";
import { addDaysISO, formatLongDate, todayISO } from "@/lib/dates";
import { burnedKcalFromHealth } from "@/lib/health-energy";
import { formatFeelLine } from "@/lib/cat-feel";
import type { DailyFeelEntry } from "@/lib/daily-feel";
import type { DatedMeal } from "@/lib/recent-foods";
import type { DailyMovement, MealEntry, MealType, Profile } from "@/lib/types";
import { cn, mealTypeLabel } from "@/lib/utils";

const SLOTS: MealType[] = ["petit-dejeuner", "dejeuner", "diner", "collation"];

function kcal(value: number) {
  return Math.round(value).toLocaleString("fr-FR");
}

function draftMeal(profileId: Profile["id"], type: MealType, date: string): MealEntry {
  return {
    id: `draft-${profileId}-${type}-${date}`,
    name: mealTypeLabel(type),
    type,
    time: "",
    macros: emptyMacros(),
    profileId,
    source: "text",
    items: [],
    date,
  };
}

export function DayLogSheet({
  date,
  profile,
  meals,
  healthDays,
  feels,
  onClose,
  onChangeDate,
  onMealsSaved,
  onReload,
}: {
  date: string;
  profile: Profile;
  meals: DatedMeal[];
  healthDays: DailyMovement[];
  feels: DailyFeelEntry[];
  onClose: () => void;
  onChangeDate: (date: string) => void;
  onMealsSaved: (meals: DatedMeal[]) => void;
  onReload: () => Promise<void>;
}) {
  const today = todayISO();
  const [editing, setEditing] = useState<MealEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const dayMeals = useMemo(
    () => pickCanonicalMeals(mealsOnDate(meals, profile.id, date)).keep,
    [meals, profile.id, date],
  );
  const movement = healthDays.find((day) => day.date === date);
  const eaten = useMemo(() => sumDayMacros(dayMeals), [dayMeals]);
  const { burned, live } = burnedKcalFromHealth(
    movement ?? { activeEnergyKcal: 0, restingEnergyKcal: 0 },
    { bmr: profile.bmr, tdee: profile.tdee },
  );
  const balance = energyBalanceLook(eaten.calories, burned, profile.primaryGoal);
  const feel = feels.find((row) => row.date === date && row.profileId === profile.id);
  const prev = addDaysISO(date, -1);
  const next = addDaysISO(date, 1);
  const canNext = next <= today;

  function slotMeal(type: MealType) {
    return dayMeals.find((meal) => meal.type === type);
  }

  async function persist(next: MealEntry) {
    const dated: DatedMeal = { ...next, date };
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      onMealsSaved(upsertLocalMeals(meals, dated));
      return true;
    }
    const error = await upsertMeal(supabase, dated);
    if (error) {
      setNotice(error);
      return false;
    }
    await onReload();
    return true;
  }

  async function saveEdit(next: MealEntry) {
    setSaving(true);
    setNotice(null);
    const ok = await persist(next);
    setSaving(false);
    if (ok) setEditing(null);
  }

  async function toggleSkip(meal: MealEntry) {
    const nextSkipped = !meal.isSkipped;
    const supabase = createBrowserSupabaseClient();
    if (supabase && isStoredMealId(meal.id)) {
      const error = await setMealSkipped(supabase, meal.id, nextSkipped);
      if (error) {
        setNotice(error);
        return;
      }
      await onReload();
      return;
    }
    await persist({
      ...meal,
      isSkipped: nextSkipped,
      name: nextSkipped && !meal.name ? "Repas sauté" : meal.name,
      date,
    });
  }

  async function skipEmpty(type: MealType) {
    await persist({
      ...draftMeal(profile.id, type, date),
      name: "Repas sauté",
      isSkipped: true,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
      <div className="max-h-[88vh] w-full max-w-[430px] overflow-y-auto rounded-t-[24px] bg-white p-4 pb-8 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[17px] font-semibold">Journée</h3>
          <button type="button" onClick={onClose} className="rounded-full bg-health-bg p-1.5">
            <X size={16} />
          </button>
        </div>

        <div className="mb-3 flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={prev < addDaysISO(today, -365)}
            onClick={() => onChangeDate(prev)}
            className="rounded-full bg-health-bg p-1.5 disabled:opacity-30"
            aria-label="Jour précédent"
          >
            <ChevronLeft size={16} />
          </button>
          <p className="min-w-0 flex-1 text-center text-[14px] font-semibold capitalize">
            {formatLongDate(date)}
          </p>
          <button
            type="button"
            disabled={!canNext}
            onClick={() => onChangeDate(next)}
            className="rounded-full bg-health-bg p-1.5 disabled:opacity-30"
            aria-label="Jour suivant"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="rounded-2xl bg-health-bg px-3 py-3">
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-[11px] text-health-muted">Mangées</p>
              <p className="text-[18px] font-bold tabular-nums leading-none">{kcal(eaten.calories)}</p>
            </div>
            <div className="text-center">
              <p className="text-[18px] font-bold tabular-nums leading-none" style={{ color: balance.color }}>
                {formatSignedKcal(balance.net)}
              </p>
              <p className="mt-0.5 text-[11px] text-health-muted">{balance.label}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-health-muted">Brûlées{live ? "" : " · estimé"}</p>
              <p className="text-[18px] font-bold tabular-nums leading-none">{kcal(burned)}</p>
            </div>
          </div>
        </div>
        <CompactMacrosRow current={eaten} target={profile.targets} goal={profile.primaryGoal} />
        {feel && (feel.hunger != null || feel.energy != null || feel.fatigue != null) ? (
          <p className="mt-2 text-[12px] text-health-muted">{formatFeelLine(feel)}</p>
        ) : null}

        <p className="mb-2 mt-4 text-[12px] font-medium text-health-muted">Repas · toucher pour modifier</p>
        <div className="space-y-2">
          {SLOTS.map((type) => {
            const meal = slotMeal(type);
            if (!meal) {
              return (
                <div
                  key={type}
                  className="flex items-center justify-between gap-2 rounded-2xl bg-health-bg px-3 py-3"
                >
                  <button type="button" onClick={() => setEditing(draftMeal(profile.id, type, date))} className="min-w-0 text-left">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-health-muted">
                      {mealTypeLabel(type)}
                    </p>
                    <p className="text-[13px] text-health-muted">Vide · ajouter</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => void skipEmpty(type)}
                    className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-health-muted"
                  >
                    Sauter
                  </button>
                </div>
              );
            }
            const skipped = Boolean(meal.isSkipped);
            return (
              <div
                key={meal.id}
                className={cn(
                  "flex items-start justify-between gap-2 rounded-2xl bg-health-bg px-3 py-3",
                  skipped && "opacity-50",
                )}
              >
                <button type="button" onClick={() => setEditing(meal)} className="min-w-0 flex-1 text-left">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-health-muted">
                    {mealTypeLabel(meal.type)}
                    {meal.time ? ` · ${meal.time}` : ""}
                  </p>
                  <p className="mt-0.5 text-[14px] font-medium leading-snug">{meal.name}</p>
                  {!skipped && meal.items && meal.items.length > 0 ? (
                    <p className="mt-1 line-clamp-2 text-[12px] text-health-muted">{meal.items.join(" · ")}</p>
                  ) : null}
                </button>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => void toggleSkip(meal)}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                      skipped ? "bg-health-ink text-white" : "bg-white text-health-muted",
                    )}
                  >
                    {skipped ? "Sauté" : "Sauter"}
                  </button>
                  <p className="text-[13px] font-semibold tabular-nums">
                    {skipped ? "—" : meal.macros.calories}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        {notice ? <p className="mt-3 text-[12px] font-medium text-coral">{notice}</p> : null}
      </div>

      {editing ? (
        <EditMealSheet
          meal={editing}
          saving={saving}
          onClose={() => setEditing(null)}
          onSave={(next) => void saveEdit(next)}
        />
      ) : null}
    </div>
  );
}

function upsertLocalMeals(meals: DatedMeal[], next: DatedMeal): DatedMeal[] {
  const stored = isStoredMealId(next.id);
  if (stored) {
    return meals.map((row) => (row.id === next.id ? next : row));
  }
  const withoutSlot = meals.filter(
    (row) => !(row.profileId === next.profileId && row.date === next.date && row.type === next.type),
  );
  return [...withoutSlot, next];
}
