"use client";

import { useState } from "react";
import { ChevronDown, RefreshCw, Repeat2, ThermometerSun, Trash2, ArrowRightLeft } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { RecipeTag } from "@/components/repas/RecipeTag";
import { HoldTip } from "@/components/ui/HoldTip";
import { isFluffLine, isLogisticsTip, isStepSection, sanitizeCopy, stepSectionLabel } from "@/lib/recipe-copy";
import { stripCoachNote } from "@/lib/coach-ingredients";
import { groupMealIngredients } from "@/lib/ingredient-groups";
import { aisleStyle } from "@/lib/plan-colors";
import { aisleFor, isUnlistedShoppingIng } from "@/lib/shopping-from-plan";
import { formatIngredientLine, scaleVisualQuantity, formatVisualAndWeight } from "@/lib/visual-quantity";
import { gramsFor, ingredientsForView, isEmptyMeal } from "@/lib/weekly-plan";
import { portionsDiffer } from "@/lib/meal-coach";
import { cookQtyCaption, cookScale, type QtyMode } from "@/lib/qty-scale";
import type { PlannedMeal, RecipeDeclination, RecipeIngredient, ViewMode } from "@/lib/types";
import { cn, mealTypeLabel } from "@/lib/utils";

export function MealPlanCard({
  meal,
  planTag,
  view,
  busy,
  qtyMode = "repas",
  defaultOpen = false,
  onRegenerate,
  onSwapIngredient,
  onDelete,
  onMove,
}: {
  meal: PlannedMeal;
  planTag?: string;
  view: ViewMode;
  busy?: boolean;
  qtyMode?: QtyMode;
  defaultOpen?: boolean;
  onRegenerate?: () => void;
  onSwapIngredient?: () => void;
  onDelete?: () => void;
  onMove?: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const empty = isEmptyMeal(meal);
  const visibleIngredients = ingredientsForView(meal.ingredients, view).filter(
    (item) => !isUnlistedShoppingIng(item.name),
  );
  const scale = cookScale(meal, qtyMode);
  const visibleTips = meal.tips.filter((line) => isLogisticsTip(line));

  return (
    <Card>
      <button type="button" onClick={() => setOpen((value) => !value)} className="w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-health-muted">
            {mealTypeLabel(meal.mealType)}
            {meal.lowCalorie ? " · low cal" : ""}
            {!empty && meal.theme && meal.theme !== "Base" ? ` · ${meal.theme}` : ""}
          </p>
          <span className="flex items-center gap-1 text-health-muted">
            {meal.weatherNote && (
              <span className="inline-flex items-center gap-1 text-[11px] text-amber-600">
                <ThermometerSun size={12} />
                {meal.weatherNote}
              </span>
            )}
            <ChevronDown size={16} className={cn("transition", open && "rotate-180")} />
          </span>
        </div>
        <p className="mt-1 text-[15px] font-semibold leading-snug">
          {planTag ? <RecipeTag recipeNo={planTag} className="mr-1.5 align-middle" /> : null}
          {empty ? "Aucun repas" : meal.baseName}
        </p>
        {empty ? (
          <p className="mt-1 text-[12px] text-health-muted">Génère un repas pour remplir ce créneau.</p>
        ) : null}
      </button>

      {!empty && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {meal.appliances.map((appliance) => (
            <span key={appliance} className="rounded-full bg-health-bg px-2 py-0.5 text-[11px] font-medium">
              {appliance}
            </span>
          ))}
          {planTag ? <RecipeTag recipeNo={planTag} /> : null}
          <span className="rounded-full bg-health-bg px-2 py-0.5 text-[11px] font-medium">
            {meal.servingsPerPerson === 2
              ? `Batch ×2 · ${meal.coverLabel}`
              : `Frais ×1 · ${meal.coverLabel}`}
          </span>
        </div>
      )}

      {!empty && <Declinations meal={meal} view={view} />}

      {open && !empty && (
        <div className="mt-3 border-t border-health-line pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-health-muted">
            {cookQtyCaption(meal, qtyMode)}
          </p>
          <div className="mt-1.5 space-y-2">
            {groupMealIngredients(visibleIngredients, meal).map((group) => (
              <div key={group.label ?? "base"}>
                {group.label ? (
                  <p className="mb-0.5 text-[13px] font-semibold text-violet-dark">{group.label} :</p>
                ) : null}
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <IngredientRow key={item.id} item={item} view={view} scale={scale} />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-health-muted">Étapes</p>
          <RecipeSteps steps={meal.steps} />

          {visibleTips.length > 0 && (
            <>
              <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-health-muted">
                Astuces
              </p>
              <ul className="mt-1 space-y-1">
                {visibleTips.map((tip) => (
                  <li key={tip} className="text-[13px] leading-relaxed text-health-muted">
                    {tip}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {(onRegenerate || onMove || onSwapIngredient || onDelete) && (
      <div className="mt-3 grid grid-cols-2 gap-2">
        {onRegenerate ? (
        <button
          type="button"
          disabled={busy}
          onClick={onRegenerate}
          className="flex items-center justify-center gap-1.5 rounded-full bg-health-bg py-2 text-[12px] font-semibold disabled:opacity-50"
        >
          <RefreshCw size={13} />
          {empty ? "Générer" : "Régénérer"}
        </button>
        ) : null}
        {onMove ? (
        <button
          type="button"
          disabled={busy}
          onClick={onMove}
          className="flex items-center justify-center gap-1.5 rounded-full bg-health-bg py-2 text-[12px] font-semibold disabled:opacity-50"
        >
          <ArrowRightLeft size={13} />
          Déplacer
        </button>
        ) : null}
        {!empty && onSwapIngredient ? (
          <button
            type="button"
            disabled={busy}
            onClick={onSwapIngredient}
            className="flex items-center justify-center gap-1.5 rounded-full bg-health-bg py-2 text-[12px] font-semibold disabled:opacity-50"
          >
            <Repeat2 size={13} />
            Ingrédient
          </button>
        ) : null}
        {!empty && onDelete ? (
          <button
            type="button"
            disabled={busy}
            onClick={onDelete}
            className="flex items-center justify-center gap-1.5 rounded-full bg-red-50 py-2 text-[12px] font-semibold text-red-600 disabled:opacity-50"
          >
            <Trash2 size={13} />
            Supprimer
          </button>
        ) : null}
      </div>
      )}
    </Card>
  );
}

function IngredientRow({
  item,
  view,
  scale,
}: {
  item: RecipeIngredient;
  view: ViewMode;
  scale: number;
}) {
  const coachBoost = /dont [+\-−]?\d+\s*g coach/i.test(item.notes ?? "");
  const aisle = aisleStyle(aisleFor(item.name));
  const notes =
    item.notes && sanitizeCopy(item.notes)
      ? coachBoost
        ? item.notes
        : stripCoachNote(sanitizeCopy(item.notes))
      : "";
  const who = item.role === "alexis" ? "Alexis" : item.role === "elodie" ? "Élodie" : "";
  const qty = ingredientQtyText(item, view, scale);
  const full = [qty, who, notes].filter(Boolean).join(" · ");
  return (
    <div className="flex items-center gap-1.5 text-[13px] leading-tight">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: aisle.hex }} />
      <HoldTip label={full} className={cn("font-medium", coachBoost && "text-coral-dark")}>
        <IngredientQty item={item} view={view} scale={scale} />
        {who ? (
          <span
            className={cn(
              "ml-1 text-[10px] font-semibold uppercase",
              item.role === "alexis" ? "text-coral" : "text-violet",
            )}
          >
            {who}
          </span>
        ) : null}
        {notes ? (
          <span className={cn("font-normal", coachBoost ? "text-coral-dark" : "text-health-muted")}>
            {" · "}
            {notes}
          </span>
        ) : null}
      </HoldTip>
    </div>
  );
}

function ingredientQtyText(
  item: Parameters<typeof gramsFor>[0] & { visualQuantity?: string; name: string },
  view: ViewMode,
  scale: number,
) {
  const visual = scaleVisualQuantity(item.visualQuantity, scale);
  if (view === "couple") {
    const gramsA = Math.round(item.gramsAlexis * scale);
    const gramsE = Math.round(item.gramsElodie * scale);
    if (gramsA > 0 && gramsE > 0) {
      if (portionsDiffer(gramsA, gramsE)) {
        const maxG = Math.max(item.gramsAlexis, item.gramsElodie, 1);
        const visualA = scaleVisualQuantity(item.visualQuantity, scale * (item.gramsAlexis / maxG));
        const visualE = scaleVisualQuantity(item.visualQuantity, scale * (item.gramsElodie / maxG));
        return `${item.name} : Alexis ${formatVisualAndWeight(gramsA, visualA)} · Élodie ${formatVisualAndWeight(gramsE, visualE)}`;
      }
      const grams = gramsA + gramsE;
      const visualTotal = scaleVisualQuantity(
        item.visualQuantity,
        scale * ((gramsA + gramsE) / Math.max(gramsA, gramsE, 1)),
      );
      return formatIngredientLine({ name: item.name, grams, visual: visualTotal });
    }
    return formatIngredientLine({ name: item.name, grams: gramsA || gramsE, visual });
  }
  return formatIngredientLine({ name: item.name, grams: Math.round(gramsFor(item, view) * scale), visual });
}

function IngredientQty({
  item,
  view,
  scale,
}: {
  item: Parameters<typeof gramsFor>[0] & { visualQuantity?: string; name: string };
  view: ViewMode;
  scale: number;
}) {
  return <>{ingredientQtyText(item, view, scale)}</>;
}

function RecipeSteps({ steps }: { steps: string[] }) {
  return (
    <div className="mt-1 space-y-2">
      {steps.map((step, index) => {
        if (isStepSection(step)) {
          return (
            <p
              key={`${step}-${index}`}
              className="pt-1 text-[11px] font-semibold uppercase tracking-wide text-health-muted"
            >
              {stepSectionLabel(step)}
            </p>
          );
        }
        if (isFluffLine(step)) return null;
        return (
          <p key={`${step}-${index}`} className="pl-3 text-[13px] leading-relaxed text-health-ink">
            <span className="mr-1.5 font-semibold tabular-nums text-health-muted">
              {steps.slice(0, index + 1).filter((line) => !isStepSection(line)).length}.
            </span>
            {step}
          </p>
        );
      })}
    </div>
  );
}

function Declinations({ meal, view }: { meal: PlannedMeal; view: ViewMode }) {
  if (view === "couple") {
    return (
      <div className="mt-3 grid grid-cols-2 gap-2">
        <ProfileMacros name="Alexis" accent="coral" decl={meal.alexis} />
        <ProfileMacros name="Élodie" accent="violet" decl={meal.elodie} />
      </div>
    );
  }
  const decl = view === "elodie" ? meal.elodie : meal.alexis;
  return (
    <p className="mt-3 text-[13px]">
      <span className="font-semibold">Protéine : </span>
      {decl.protein}
      <span className="mt-0.5 block tabular-nums text-health-muted">
        {decl.calories} kcal · {decl.proteinG}g P · {decl.carbsG}g G · {decl.fatG}g L
      </span>
    </p>
  );
}

function ProfileMacros({
  name,
  accent,
  decl,
}: {
  name: string;
  accent: "coral" | "violet";
  decl: RecipeDeclination;
}) {
  return (
    <div className={cn("rounded-xl p-2.5", accent === "coral" ? "bg-coral-soft" : "bg-violet-soft")}>
      <p className={cn("text-[11px] font-semibold", accent === "coral" ? "text-coral" : "text-violet")}>
        {name}
      </p>
      <p className="mt-0.5 text-[12px] leading-snug">{decl.protein}</p>
      <p className="mt-1 text-[11px] tabular-nums text-health-muted">
        {decl.calories} kcal · {decl.proteinG}g P · {decl.carbsG}g G
      </p>
    </div>
  );
}
