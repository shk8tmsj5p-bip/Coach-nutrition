"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Sparkles, X } from "lucide-react";
import { ToggleRow } from "@/components/parametres/ToggleRow";
import { Card } from "@/components/ui/Card";
import { useProfile } from "@/context/ProfileContext";
import { loadHouseholdCoachBias } from "@/lib/coach-apply";
import { requestGenerateMeals } from "@/lib/gemini/client";
import { loadKitchenPrefs, formatKitchenPrefsForPrompt } from "@/lib/kitchen-prefs";
import { buildMealCoachFromProfiles, formatMealCoachForPrompt } from "@/lib/meal-coach";
import {
  DEFAULT_STOCK,
  formatStockForPrompt,
  formatStockItem,
  loadLocalStock,
  removeStockItems,
  stockIsActive,
  stockItemsUsedInNames,
  type HouseholdStock,
} from "@/lib/stock";
import { loadStock, persistStock } from "@/lib/supabase/stock";
import { MEAL_TYPE_OPTIONS } from "@/lib/meal-items";
import { pickSwapProposal, SWAP_THEMES, type SwapProposal } from "@/lib/swap-proposals";
import type { MealEntry, MealType, Profile, ProfileId } from "@/lib/types";
import { cn, mealTypeLabel } from "@/lib/utils";
import { loadRejected } from "@/lib/supabase/rejected";
import { mergeAvoidTitles } from "@/lib/rejected";

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
  const { catalog } = useProfile();
  const availableTypes = MEAL_TYPE_OPTIONS.filter((option) =>
    profiles.some((profile) =>
      meals.some(
        (meal) =>
          meal.profileId === profile.id && meal.type === option.id && !meal.isSkipped,
      ),
    ),
  );

  const [mealType, setMealType] = useState<MealType | null>(null);
  const [nonce, setNonce] = useState(0);
  const [theme, setTheme] = useState<string | null>(null);
  const [themeOpen, setThemeOpen] = useState(false);
  const [customTheme, setCustomTheme] = useState("");
  const [proposals, setProposals] = useState<Partial<Record<ProfileId, SwapProposal>> | null>(
    null,
  );
  const [generating, setGenerating] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [stock, setStock] = useState<HouseholdStock>(DEFAULT_STOCK);

  const activeTheme = theme;

  useEffect(() => {
    void loadStock().then(setStock);
  }, []);

  function catalogFallback(type: MealType, index: number, th: string | null) {
    const next: Partial<Record<ProfileId, SwapProposal>> = {};
    for (const profile of profiles) {
      next[profile.id] = pickSwapProposal(profile.id, type, index, th);
    }
    return next;
  }

  useEffect(() => {
    if (!mealType) return;
    let cancelled = false;
    setGenerating(true);
    setWarning(null);
    void (async () => {
      try {
        const banned = await loadRejected();
        const pastMeals = mergeAvoidTitles(
          meals.map((meal) => meal.name.trim()).filter(Boolean),
          banned,
        );
        const kitchenContext = [
          formatKitchenPrefsForPrompt(loadKitchenPrefs(), [catalog.alexis, catalog.elodie]),
          formatMealCoachForPrompt(buildMealCoachFromProfiles(catalog.alexis, catalog.elodie)),
          formatStockForPrompt(loadLocalStock()),
        ]
          .filter(Boolean)
          .join("\n\n");
        const result = await requestGenerateMeals({
          mode: "today-swap",
          theme: activeTheme ?? "",
          mealType,
          nonce,
          coachBias: loadHouseholdCoachBias(),
          pastMeals,
          kitchenContext,
          nutritionCoach: buildMealCoachFromProfiles(catalog.alexis, catalog.elodie),
        });
        if (cancelled) return;
        const hasProposal = Boolean(result.proposals?.alexis || result.proposals?.elodie);
        if (hasProposal && result.proposals) {
          setProposals(result.proposals);
          setFallback(false);
          setWarning(result.warning ?? null);
        } else {
          setProposals(catalogFallback(mealType, nonce, activeTheme));
          setFallback(true);
          setWarning("Liste de secours — Gem Chef indisponible.");
        }
      } catch {
        if (cancelled) return;
        setProposals(catalogFallback(mealType, nonce, activeTheme));
        setFallback(true);
        setWarning("Liste de secours — Gem Chef indisponible.");
      } finally {
        if (!cancelled) setGenerating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // regenerate only when the slot, theme, or “nouvelle proposition” changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mealType, activeTheme, nonce]);

  const rows = useMemo(() => {
    if (!mealType) return [];
    return profiles.map((profile) => {
      const current = meals.find(
        (meal) => meal.profileId === profile.id && meal.type === mealType && !meal.isSkipped,
      );
      const proposal = generating && !proposals ? null : (proposals?.[profile.id] ?? null);
      return { profile, current, proposal };
    });
  }, [profiles, meals, mealType, generating, proposals]);

  const canSwap = !generating && rows.some((row) => row.current && row.proposal);

  function applyTheme(next: string) {
    const value = next.trim();
    if (!value) return;
    setTheme(value);
    setThemeOpen(false);
    setCustomTheme("");
    setProposals(null);
    setNonce((n) => n + 1);
  }

  function patchUseStock(useStock: boolean) {
    const next = { ...loadLocalStock(), useStock };
    setStock(next);
    void persistStock(next);
    if (mealType) {
      setProposals(null);
      setNonce((n) => n + 1);
    }
  }

  async function confirm() {
    if (!mealType || !proposals) return;
    const next: Partial<Record<ProfileId, SwapProposal>> = {};
    for (const row of rows) {
      if (row.current && row.proposal) next[row.profile.id] = row.proposal;
    }
    if (!fallback && stockIsActive(loadLocalStock())) {
      const pantry = loadLocalStock();
      const names = Object.values(next).flatMap((proposal) =>
        proposal ? [proposal.nom, ...proposal.items] : [],
      );
      const used = stockItemsUsedInNames(pantry.items, names);
      if (used.length > 0) {
        await persistStock(removeStockItems(pantry, used.map((item) => item.id)));
      }
    }
    onConfirm(mealType, next);
  }

  function resetSlot() {
    setMealType(null);
    setTheme(null);
    setThemeOpen(false);
    setNonce(0);
    setProposals(null);
    setFallback(false);
    setWarning(null);
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
            {stock.items.length > 0 ? (
              <p className="mb-3 text-[12px] leading-snug text-health-muted">
                Stock : {stock.items.slice(0, 4).map(formatStockItem).join(" · ")}
                {stock.items.length > 4 ? "…" : ""}
                {stock.useStock ? " — Gem peut s’en servir." : " — toggle off."}
              </p>
            ) : null}
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
                      setNonce(0);
                      setTheme(null);
                      setProposals(null);
                      setFallback(false);
                      setWarning(null);
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
              {fallback ? " · secours" : " · Gem Chef"}
            </p>
            {stock.items.length > 0 ? (
              <div className="mb-3 rounded-card bg-health-bg px-3 py-1">
                <ToggleRow
                  label="Utiliser le stock"
                  hint={stock.items.slice(0, 3).map((item) => item.name).join(" · ")}
                  checked={stock.useStock}
                  onChange={patchUseStock}
                />
              </div>
            ) : null}

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
                      {proposal ? (
                        <>
                          <p className="text-[14px] font-medium leading-snug">{proposal.nom}</p>
                          <p className="mt-1 text-[12px] text-health-muted">
                            {proposal.items.join(" · ")}
                          </p>
                          <p className="mt-0.5 text-[12px] tabular-nums text-health-muted">
                            {proposal.calories} kcal · {proposal.proteines_g}g P
                            {proposal.lowCalorie ? " · low cal" : ""}
                          </p>
                        </>
                      ) : (
                        <p className="text-[13px] text-health-muted">Gem Chef prépare le plat…</p>
                      )}
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
                disabled={generating}
                onClick={() => {
                  setProposals(null);
                  setNonce((n) => n + 1);
                }}
                className="flex items-center justify-center gap-1.5 rounded-card bg-health-bg py-3 text-[13px] font-semibold disabled:opacity-50"
              >
                <RefreshCw size={14} />
                Nouvelle proposition
              </button>
              <button
                type="button"
                disabled={generating}
                onClick={() => setThemeOpen((open) => !open)}
                className="flex items-center justify-center gap-1.5 rounded-card bg-health-bg py-3 text-[13px] font-semibold disabled:opacity-50"
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
              onClick={resetSlot}
            >
              Changer de repas
            </button>

            <button
              type="button"
              disabled={!canSwap || confirming}
              onClick={() => void confirm()}
              className="mt-3 w-full rounded-card bg-health-ink py-3 text-[15px] font-semibold text-white disabled:opacity-50"
            >
              {confirming ? "Remplacement…" : "Confirmer le remplacement"}
            </button>
            <p className="mt-2 text-center text-[11px] text-health-muted">
              {warning ??
                (fallback
                  ? "Catalogue de secours"
                  : "Même plat, portions par profil · 1 repas aujourd’hui")}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
