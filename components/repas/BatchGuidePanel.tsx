"use client";

import { useMemo, useRef, useState } from "react";
import { FileDown } from "lucide-react";
import { BatchPdfDocument } from "@/components/repas/BatchPdfDocument";
import { SectionTitle } from "@/components/ui/Card";
import { buildBatchSession, vegFamilyLabel } from "@/lib/batch-from-plan";
import { exportElementToPdf } from "@/lib/export-batch-pdf";
import { formatWeekRange } from "@/lib/dates";
import { groupedCellIngredients, cellSetting, blockHowto, shortCoverDays, itemQuantityLine, packingLists, assemblyHowto } from "@/lib/s34-copy";
import type { QtyMode } from "@/lib/qty-scale";
import type { BatchStep, BatchStepRecipeBlock, PlannedMeal } from "@/lib/types";
import { cn, mealTypeLabel } from "@/lib/utils";
import { RecipeTag } from "@/components/repas/RecipeTag";

function IngredientCell({ recipeNo, ings }: { recipeNo: string; ings: BatchStepRecipeBlock["ingredients"] }) {
  const groups = groupedCellIngredients(ings);
  if (groups.length === 0) return <p>—</p>;
  return (
    <div className="min-w-0 space-y-0.5 text-[12px] leading-snug text-health-ink">
      {groups.map((row) => (
        <p key={`${recipeNo}-${row.label}`}>
          <span
            className={cn(
              "font-semibold",
              row.label === "Alexis"
                ? "text-coral-dark"
                : row.label === "Élodie"
                  ? "text-violet-dark"
                  : "text-health-muted",
            )}
          >
            {row.label} :
          </span>{" "}
          {row.text}
        </p>
      ))}
    </div>
  );
}

function AssemblyCard({
  block,
  onOpen,
}: {
  block: BatchStepRecipeBlock;
  onOpen?: () => void;
}) {
  const pack = packingLists(block);
  return (
    <div className="rounded-xl bg-health-bg p-2.5">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-start gap-2 text-left"
      >
        <RecipeTag recipeNo={block.recipeNo} />
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold leading-snug text-health-ink">
            {block.recipeTitle}
          </span>
          <span className="text-[11px] text-health-muted">
            {shortCoverDays(block.coverLabel)} · {pack.boxLabel}
          </span>
        </span>
      </button>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <PackBox name="Alexis" accent="coral" lines={pack.boxA} />
        <PackBox name="Élodie" accent="violet" lines={pack.boxE} />
      </div>
      {pack.pot.length > 0 ? (
        <div className="mt-1.5 rounded-lg bg-health-card px-2.5 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-health-muted">
            Pot sauce · à part
          </p>
          <div className="mt-1 space-y-0.5">
            {pack.pot.map((line) => (
              <p key={line.name} className="flex justify-between gap-2 text-[12px] leading-snug">
                <span className="min-w-0 truncate font-medium text-health-ink">{line.name}</span>
                <span className="shrink-0 tabular-nums text-health-muted">{line.qty}</span>
              </p>
            ))}
          </div>
        </div>
      ) : null}
      <p className="mt-1.5 text-[11px] leading-snug text-health-muted">{assemblyHowto(block)}</p>
    </div>
  );
}

function PackBox({
  name,
  accent,
  lines,
}: {
  name: string;
  accent: "coral" | "violet";
  lines: { name: string; qty: string }[];
}) {
  return (
    <div
      className={cn(
        "rounded-lg px-2 py-2",
        accent === "coral" ? "bg-coral-soft" : "bg-violet-soft",
      )}
    >
      <p
        className={cn(
          "text-[10px] font-semibold uppercase tracking-[0.1em]",
          accent === "coral" ? "text-coral-dark" : "text-violet-dark",
        )}
      >
        Boîte {name}
      </p>
      <div className="mt-1 space-y-0.5">
        {lines.length === 0 ? (
          <p className="text-[11px] text-health-muted">—</p>
        ) : (
          lines.map((line) => (
            <p key={`${name}-${line.name}`} className="flex justify-between gap-1 text-[11px] leading-snug">
              <span className="min-w-0 truncate font-medium text-health-ink">{line.name}</span>
              <span
                className={cn(
                  "shrink-0 tabular-nums font-semibold",
                  accent === "coral" ? "text-coral-dark" : "text-violet-dark",
                )}
              >
                {line.qty}
              </span>
            </p>
          ))
        )}
      </div>
    </div>
  );
}

function CookbookTable({
  headers,
  rows,
  tone,
  perItem,
  groupByFamily,
  onOpenRecipe,
}: {
  headers: [string, string, string];
  rows: BatchStepRecipeBlock[];
  tone: "coral" | "sky" | "violet" | "cream";
  perItem?: boolean;
  groupByFamily?: boolean;
  onOpenRecipe?: (recipeNo: string) => void;
}) {
  const head =
    tone === "coral"
      ? "bg-coral-soft text-coral-dark"
      : tone === "sky"
        ? "bg-sky-50 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200"
        : tone === "violet"
          ? "bg-violet-soft text-violet-dark"
          : "bg-[#F3EBE0] text-amber-900 dark:bg-[#3A342C] dark:text-amber-200";

  return (
    <div className="mt-2 overflow-hidden rounded-xl bg-health-bg">
      <div className={cn("grid grid-cols-[2.4rem_1fr_5.6rem] gap-x-2 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide", head)}>
        <span>{headers[0]}</span>
        <span>{headers[1]}</span>
        <span className="text-right">{headers[2]}</span>
      </div>
      {rows.map((block, index) => {
        const family = groupByFamily && perItem ? vegFamilyLabel(block.ingredients[0]?.name ?? "") : "";
        const prevFamily = groupByFamily && perItem ? vegFamilyLabel(rows[index - 1]?.ingredients[0]?.name ?? "") : "";
        const showFamily = Boolean(groupByFamily && perItem && family && family !== prevFamily);
        return (
          <div key={`${block.recipeNo}-${block.recipeTitle}-${block.ingredients[0]?.name ?? index}`}>
            {showFamily ? (
              <p className="px-2 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-health-muted">
                {family}
              </p>
            ) : null}
            <div
              className={cn(
                "grid grid-cols-[2.4rem_1fr_5.6rem] items-start gap-x-2 px-2 py-1.5",
                index % 2 === 1 ? "bg-health-card/80" : "bg-transparent",
              )}
            >
              <RecipeTag
                recipeNo={block.recipeNo}
                onClick={onOpenRecipe ? () => onOpenRecipe(block.recipeNo) : undefined}
              />
              {perItem ? (
                <p className="min-w-0 text-[12px] leading-snug text-health-ink">
                  {block.ingredients.length > 0
                    ? block.ingredients.map((ing) => itemQuantityLine(ing)).join(" · ")
                    : "—"}
                </p>
              ) : (
                <div className="min-w-0">
                  <IngredientCell recipeNo={block.recipeNo} ings={block.ingredients} />
                  {blockHowto(block) ? (
                    <p className="mt-1 text-[11px] leading-snug text-health-muted">{blockHowto(block)}</p>
                  ) : null}
                </div>
              )}
              <p className="text-right text-[11px] font-semibold leading-snug text-health-ink">
                {cellSetting(block) || "—"}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function sectionTone(step: BatchStep): "coral" | "sky" | "violet" | "cream" {
  if (step.time === "1" || /airfryer/i.test(step.title)) return "coral";
  if (step.time === "2" || /eau|féculent/i.test(step.title)) return "sky";
  if (step.time === "3" || /thermomix/i.test(step.title)) return "violet";
  return "cream";
}

function sectionHeaders(step: BatchStep): [string, string, string] {
  if (step.time === "3" || /thermomix/i.test(step.title)) return ["Px", "Ingrédients", "TM"];
  if (step.time === "1" || /airfryer/i.test(step.title)) return ["Px", "Protéines", "Réglage"];
  if (step.time === "2" || /eau|féculent/i.test(step.title)) return ["Px", "Ingrédient", "Cuisson"];
  if (step.time === "4" || /découpe/i.test(step.title)) return ["Px", "Légume", "Découpe"];
  return ["Px", "Légumes", "Geste"];
}

function sectionShell(tone: "coral" | "sky" | "violet" | "cream") {
  if (tone === "coral") return "border-coral/25 bg-health-card";
  if (tone === "sky") return "border-sky-300/40 dark:border-sky-500/25 bg-health-card";
  if (tone === "violet") return "border-violet/25 bg-health-card";
  return "border-health-line bg-health-card";
}

export function BatchGuidePanel({
  weekStart,
  plan,
  qtyMode = "batch",
  onOpenRecipe,
}: {
  weekStart: string;
  plan: PlannedMeal[];
  qtyMode?: QtyMode;
  onOpenRecipe?: (recipeNo: string) => void;
}) {
  const session = useMemo(() => buildBatchSession(plan, qtyMode), [plan, qtyMode]);
  const weekLabel = formatWeekRange(weekStart);
  const pdfRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const cookSteps = session.steps.filter((step) => step.time !== "W");
  const weekendStep = session.steps.find((step) => step.time === "W");

  async function exportPdf() {
    if (!pdfRef.current) return;
    setExporting(true);
    try {
      await exportElementToPdf(pdfRef.current, `batchcooking-${weekStart}.pdf`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="mt-3 space-y-2">
      <button
        type="button"
        disabled={exporting}
        onClick={() => void exportPdf()}
        className="mb-1 flex w-full items-center justify-center gap-2 rounded-card bg-health-ink py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
      >
        <FileDown size={16} />
        {exporting ? "Export PDF…" : "Exporter le batchcooking PDF"}
      </button>

      <div className="overflow-hidden rounded-card border border-health-line bg-health-card shadow-card">
        <div className="bg-gradient-to-r from-coral to-violet px-3.5 py-3 text-white">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/80">
            Livre de batch · {weekLabel}
          </p>
          <p className="mt-0.5 text-[16px] font-semibold tracking-tight">Session {session.durationLabel}</p>
          <p className="mt-0.5 text-[12px] text-white/80">
            {session.recipes.length} plats ·{" "}
            {qtyMode === "batch" ? "4 assiettes" : "1 repas / pers."}
            {session.weekend.length > 0 ? ` · ${session.weekend.length} frais week-end` : ""}
          </p>
        </div>

        {session.recipes.length > 0 && (
          <div className="px-3 py-2.5">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-health-muted">
              Menu de la semaine
            </p>
            <div className="space-y-1">
              {session.recipes.map((meal) => (
                <button
                  key={meal.batchId}
                  type="button"
                  onClick={() => onOpenRecipe?.(meal.recipeNo)}
                  className="flex w-full items-start gap-2 rounded-xl px-0.5 py-1 text-left active:bg-health-bg"
                >
                  <RecipeTag recipeNo={meal.recipeNo} />
                  <p className="min-w-0 text-[13px] leading-snug text-health-ink">
                    <span className="font-medium">{meal.baseName}</span>
                    <span className="text-health-muted"> · {shortCoverDays(meal.coverLabel)}</span>
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {cookSteps.map((step) => {
        const tone = sectionTone(step);
        const rows = step.recipes ?? [];
        if (rows.length === 0) return null;
        return (
          <div
            key={`${step.time}-${step.title}`}
            className={cn("rounded-card border p-3 shadow-card", sectionShell(tone))}
          >
            <div className="flex items-baseline gap-2">
              <span className="text-[11px] font-bold tabular-nums text-health-muted">{step.time}.</span>
              <p className="text-[13px] font-semibold tracking-tight text-health-ink">
                {step.title.replace(/^\d+\.\s*/, "")}
              </p>
            </div>
            {(step.time === "5" || /boîte/i.test(step.title)) && step.detail ? (
              <p className="mt-1 text-[11px] leading-snug text-health-muted">{step.detail}</p>
            ) : null}
            {step.time === "5" || /boîte|assemblage/i.test(step.title) ? (
              <div className="mt-2 space-y-2">
                {rows.map((block) => (
                  <AssemblyCard
                    key={`${block.recipeNo}-${block.recipeTitle}`}
                    block={block}
                    onOpen={onOpenRecipe ? () => onOpenRecipe(block.recipeNo) : undefined}
                  />
                ))}
              </div>
            ) : (
              <CookbookTable
                headers={sectionHeaders(step)}
                rows={rows}
                tone={tone}
                perItem={step.rowMode === "per-item"}
                groupByFamily={step.time === "4"}
                onOpenRecipe={onOpenRecipe}
              />
            )}
          </div>
        );
      })}

      {weekendStep && (weekendStep.recipes?.length ?? 0) > 0 && (
        <div className="rounded-card border border-teal-500/30 bg-health-card p-3 shadow-card">
          <p className="text-[13px] font-semibold tracking-tight text-health-ink">Week-end · frais</p>
          <div className="mt-1.5 space-y-1">
            {(weekendStep.recipes ?? []).map((block) => (
              <button
                key={block.recipeNo}
                type="button"
                onClick={() => onOpenRecipe?.(block.recipeNo)}
                className="flex w-full items-start gap-2 rounded-xl py-0.5 text-left"
              >
                <RecipeTag recipeNo={block.recipeNo} />
                <p className="text-[13px] leading-snug">
                  {block.recipeTitle}
                  <span className="text-health-muted"> · {block.coverLabel}</span>
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {session.weekend.length > 0 && !weekendStep && (
        <>
          <SectionTitle>Week-end frais</SectionTitle>
          <div className="rounded-card border border-teal-500/30 bg-health-card p-3 shadow-card">
            {session.weekend.map((meal) => (
              <button
                key={meal.id}
                type="button"
                onClick={() => onOpenRecipe?.(meal.recipeNo)}
                className="flex w-full items-start gap-2 rounded-xl py-0.5 text-left text-[13px] leading-snug"
              >
                <RecipeTag recipeNo={meal.recipeNo} />
                <span>
                  {meal.day} {mealTypeLabel(meal.mealType)} · {meal.baseName}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {session.tips.length > 0 && (
        <div className="rounded-card border border-health-line bg-health-card p-3 shadow-card">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-health-muted">Astuces</p>
          {session.tips.map((tip) => (
            <p key={tip} className="mt-1 text-[12px] leading-snug text-health-ink">
              {tip}
            </p>
          ))}
        </div>
      )}
      {session.warnings.length > 0 && (
        <div className="rounded-card border border-amber-500/30 bg-amber-50 p-3 shadow-card dark:bg-amber-950/40">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-800 dark:text-amber-200">Vigilance</p>
          {session.warnings.map((line) => (
            <p key={line} className="mt-1 text-[12px] leading-snug text-amber-900 dark:text-amber-100">
              {line}
            </p>
          ))}
        </div>
      )}
      <div className="rounded-card border border-violet/25 bg-health-card p-3 shadow-card">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-dark">Conservation</p>
        {session.storage.map((line) => (
          <p key={line} className="mt-1 text-[12px] leading-snug text-health-ink">
            {line}
          </p>
        ))}
      </div>

      <div
        aria-hidden
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: 720,
          zIndex: -1,
          opacity: 0.01,
          pointerEvents: "none",
        }}
      >
        <div ref={pdfRef}>
          <BatchPdfDocument session={session} weekLabel={weekLabel} />
        </div>
      </div>
    </div>
  );
}
