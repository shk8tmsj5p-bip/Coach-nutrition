"use client";

import { useMemo, useState } from "react";
import { RefreshCw, Sparkles, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { MEAL_TYPE_OPTIONS } from "@/lib/meal-items";
import {
  getSwapPool,
  pickSwapProposal,
  SWAP_THEMES,
  type SwapProposal,
} from "@/lib/swap-proposals";
import type { MealEntry, MealType, Profile, ProfileId } from "@/lib/types";
import { cn, mealTypeLabel } from "@/lib/utils";

export function SwapProposalSheet({
  profiles,
  meals,
  confirming,
  onClose,
  onConfirm,
}: {
  profiles: Profile[];
  meals: MealEntry[];
  confirming: boolean;
  onClose: () => void;
  onConfirm: (
    mealType: MealType,
    proposals: Partial<Record<ProfileId, SwapProposal>>,
  ) => void;
}) {
  const availableTypes = MEAL_TYPE_OPTIONS.filter((option) =>
    profiles.some((profile) =>
      meals.some(
        (meal) =>
          meal.profileId === profile.id && meal.type === option.id && !meal.isSkipped,
      ),
    ),
  );

  const [mealType, setMealType] = useState<MealType | null>(null);
  const [index, setIndex] = useState(0);
  const [theme, setTheme] = useState<string | null>(null);
  const [themeOpen, setThemeOpen] = useState(false);
  const [customTheme, setCustomTheme] = useState("");

  const activeTheme = theme;

  const rows = useMemo(() => {
    if (!mealType) return [];
    return profiles.map((profile) => {
      const current = meals.find(
        (meal) => meal.profileId === profile.id && meal.type === mealType && !meal.isSkipped,
      );
      const proposal = pickSwapProposal(profile.id, mealType, index, activeTheme);
      return { profile, current, proposal };
    });
  }, [profiles, meals, mealType, index, activeTheme]);

  const canSwap = rows.some((row) => row.current);
  const poolSize = mealType
    ? Math.max(...profiles.map((profile) => getSwapPool(profile.id, mealType, activeTheme).length), 1)
    : 1;

  function applyTheme(next: string) {
    const value = next.trim();
    if (!value) return;
    setTheme(value);
    setIndex(0);
    setThemeOpen(false);
    setCustomTheme("");
  }

  function confirm() {
    if (!mealType) return;
    const proposals: Partial<Record<ProfileId, SwapProposal>> = {};
    for (const row of rows) {
      if (row.current) proposals[row.profile.id] = row.proposal;
    }
    onConfirm(mealType, proposals);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
      <div className="w-full max-w-[430px] rounded-t-[24px] bg-white p-4 pb-8 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[17px] font-semibold">Remplacement</h3>
          <button type="button" onClick={onClose} className="rounded-full bg-health-bg p-1.5">
            <X size={16} />
          </button>
        </div>

        {!mealType ? (
          <>
            <p className="mb-4 text-[15px] leading-snug">Quel repas veux-tu remplacer&nbsp;?</p>
            <div className="grid gap-2">
              {MEAL_TYPE_OPTIONS.map((option) => {
                const enabled = availableTypes.some((item) => item.id === option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={!enabled}
                    onClick={() => {
                      setMealType(option.id);
                      setIndex(0);
                      setTheme(null);
                    }}
                    className="rounded-card bg-health-bg py-3.5 text-[15px] font-semibold disabled:opacity-40"
                  >
                    {option.label}
                    {!enabled && (
                      <span className="mt-0.5 block text-[12px] font-normal text-health-muted">
                        Aucun repas loggé
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <p className="mb-3 text-[13px] text-health-muted">
              {mealTypeLabel(mealType)}
              {activeTheme ? ` · thème ${activeTheme}` : ""}
            </p>

            <div className="max-h-[38vh] space-y-3 overflow-y-auto">
              {rows.map(({ profile, current, proposal }) => (
                <Card key={profile.id} className="bg-health-bg shadow-none">
                  <p className="text-[13px] font-semibold">{profile.name}</p>
                  {current ? (
                    <>
                      <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-health-muted">
                        Actuel
                      </p>
                      <p className="text-[14px] leading-snug">{current.name}</p>
                      <p className="mt-0.5 text-[12px] tabular-nums text-health-muted">
                        {current.macros.calories} kcal · {current.macros.protein}g P
                      </p>
                      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-health-muted">
                        Proposition
                      </p>
                      <p className="text-[14px] font-medium leading-snug">{proposal.nom}</p>
                      <p className="mt-1 text-[12px] text-health-muted">{proposal.items.join(" · ")}</p>
                      <p className="mt-0.5 text-[12px] tabular-nums text-health-muted">
                        {proposal.calories} kcal · {proposal.proteines_g}g P
                        {proposal.lowCalorie ? " · low cal" : ""}
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-[13px] text-health-muted">Pas de repas à remplacer.</p>
                  )}
                </Card>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIndex((value) => value + 1)}
                className="flex items-center justify-center gap-1.5 rounded-card bg-health-bg py-3 text-[13px] font-semibold"
              >
                <RefreshCw size={14} />
                Nouvelle proposition
              </button>
              <button
                type="button"
                onClick={() => setThemeOpen((open) => !open)}
                className="flex items-center justify-center gap-1.5 rounded-card bg-health-bg py-3 text-[13px] font-semibold"
              >
                <Sparkles size={14} />
                Thème
              </button>
            </div>

            {themeOpen && (
              <div className="mt-3 rounded-card bg-health-bg p-3">
                <p className="mb-2 text-[12px] font-medium text-health-muted">
                  Un thème pour générer le plat
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {SWAP_THEMES.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => applyTheme(item)}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-[12px] font-semibold",
                        activeTheme === item ? "bg-health-ink text-white" : "bg-white text-health-ink",
                      )}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    value={customTheme}
                    onChange={(e) => setCustomTheme(e.target.value)}
                    placeholder="Autre : tomate, italien…"
                    className="flex-1 rounded-xl bg-white px-3 py-2 text-[13px] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => applyTheme(customTheme)}
                    className="rounded-xl bg-health-ink px-3 text-[12px] font-semibold text-white"
                  >
                    OK
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              className="mt-2 text-[12px] font-medium text-health-muted"
              onClick={() => {
                setMealType(null);
                setTheme(null);
                setThemeOpen(false);
                setIndex(0);
              }}
            >
              Changer de repas
            </button>

            <button
              type="button"
              disabled={!canSwap || confirming}
              onClick={confirm}
              className="mt-3 w-full rounded-card bg-health-ink py-3 text-[15px] font-semibold text-white disabled:opacity-50"
            >
              {confirming ? "Remplacement…" : "Confirmer le remplacement"}
            </button>
            <p className="mt-2 text-center text-[11px] text-health-muted">
              Proposition { (index % poolSize) + 1 } / {poolSize}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
