"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Card, SectionTitle } from "@/components/ui/Card";
import { RecipeTag } from "@/components/repas/RecipeTag";
import { groupPlanByDay, isEmptyMeal } from "@/lib/weekly-plan";
import type { PlannedMeal } from "@/lib/types";
import { cn, mealTypeLabel } from "@/lib/utils";
import {
  dessertAppliesOnDay,
  dessertPlanningId,
  dessertTagOf,
  parseDessertPlanningId,
  type WeekLunchDessert,
} from "@/lib/week-dessert";
import type { DessertSlot } from "@/lib/dessert-product";

const LONG_PRESS_MS = 420;
const CANCEL_PX = 12;

type DragGhost = {
  fromId: string;
  label: string;
  tag?: string;
  x: number;
  y: number;
  overId: string | null;
};

export function WeekAgenda({
  plan,
  tags,
  lunchDessert,
  dinnerDessert,
  busy,
  onOpen,
  onOpenDessert,
  onGenerate,
  onMoveSlot,
}: {
  plan: PlannedMeal[];
  tags: Map<string, string>;
  lunchDessert?: WeekLunchDessert | null;
  dinnerDessert?: WeekLunchDessert | null;
  busy?: boolean;
  onOpen: (meal: PlannedMeal, tag: string) => void;
  onOpenDessert?: (slot: DessertSlot) => void;
  onGenerate: (slotId: string) => void;
  onMoveSlot?: (fromId: string, target: { dayIndex: number; mealType: "dejeuner" | "diner" }) => void;
}) {
  const days = groupPlanByDay(plan);
  const [drag, setDrag] = useState<DragGhost | null>(null);
  const dragRef = useRef<DragGhost | null>(null);
  const pressTimer = useRef<number | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const skipClick = useRef(false);
  const planRef = useRef(plan);
  const moveHandler = useRef<
    ((fromId: string, target: { dayIndex: number; mealType: "dejeuner" | "diner" }) => void) | undefined
  >(undefined);
  planRef.current = plan;
  dragRef.current = drag;
  moveHandler.current = onMoveSlot;

  useEffect(() => {
    return () => {
      if (pressTimer.current) window.clearTimeout(pressTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!drag) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onMove = (event: PointerEvent) => {
      event.preventDefault();
      const current = dragRef.current;
      if (!current) return;
      const overId = slotFromPoint(event.clientX, event.clientY);
      const next = { ...current, x: event.clientX, y: event.clientY, overId };
      dragRef.current = next;
      setDrag(next);
    };
    const onUp = (event: PointerEvent) => {
      finishDrag(event.clientX, event.clientY);
    };
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    const lockScroll = (event: TouchEvent) => event.preventDefault();
    window.addEventListener("touchmove", lockScroll, { passive: false });
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("touchmove", lockScroll);
    };
  }, [drag?.fromId]);

  function clearPressTimer() {
    if (pressTimer.current) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }

  function slotFromPoint(x: number, y: number) {
    const node = document.elementFromPoint(x, y)?.closest("[data-week-slot]");
    return node instanceof HTMLElement ? node.dataset.weekSlot ?? null : null;
  }

  function targetOf(slotId: string | null) {
    if (!slotId) return null;
    const dessert = parseDessertPlanningId(slotId);
    if (dessert) {
      return {
        dayIndex: dessert.dayIndex,
        mealType: dessert.slot === "soir" ? ("diner" as const) : ("dejeuner" as const),
      };
    }
    const meal = planRef.current.find((item) => item.id === slotId);
    if (!meal || (meal.mealType !== "dejeuner" && meal.mealType !== "diner")) return null;
    return { dayIndex: meal.dayIndex, mealType: meal.mealType };
  }

  function finishDrag(x: number, y: number) {
    const current = dragRef.current;
    setDrag(null);
    dragRef.current = null;
    if (!current || !onMoveSlot) return;
    const overId = slotFromPoint(x, y);
    if (!overId || overId === current.fromId) return;
    const target = targetOf(overId);
    if (!target) return;
    skipClick.current = true;
    moveHandler.current?.(current.fromId, target);
  }

  function startPress(fromId: string, label: string, tag: string | undefined, event: React.PointerEvent) {
    if (busy || !onMoveSlot || event.button !== 0) return;
    const startX = event.clientX;
    const startY = event.clientY;
    pressStart.current = { x: startX, y: startY };
    clearPressTimer();
    pressTimer.current = window.setTimeout(() => {
      pressTimer.current = null;
      skipClick.current = true;
      const next: DragGhost = {
        fromId,
        label,
        tag,
        x: startX,
        y: startY,
        overId: fromId,
      };
      dragRef.current = next;
      setDrag(next);
    }, LONG_PRESS_MS);
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!pressTimer.current || !pressStart.current) return;
    const dx = event.clientX - pressStart.current.x;
    const dy = event.clientY - pressStart.current.y;
    if (Math.hypot(dx, dy) > CANCEL_PX) clearPressTimer();
  }

  return (
    <div onPointerMove={onPointerMove} onPointerUp={clearPressTimer} onPointerCancel={clearPressTimer}>
      <SectionTitle>Planning</SectionTitle>
      <p className="mb-1.5 text-[11px] leading-snug text-health-muted">
        Maintiens un plat ou un dessert, puis glisse-le sur un autre midi ou soir.
      </p>
      <Card className="p-3">
        <div className="space-y-3">
          {days.map(([day, meals]) => {
            const dayIndex = meals[0]?.dayIndex ?? 0;
            const midiDessert = dessertAppliesOnDay(lunchDessert, dayIndex) ? lunchDessert : null;
            const soirDessert = dessertAppliesOnDay(dinnerDessert, dayIndex) ? dinnerDessert : null;
            return (
              <div key={day}>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-health-muted">
                  {day}
                </p>
                <div className="space-y-1">
                  {meals.map((meal) => {
                    const empty = isEmptyMeal(meal);
                    const tag = tags.get(meal.id);
                    const slot = mealTypeLabel(meal.mealType);
                    const over = drag?.overId === meal.id;
                    const from = drag?.fromId === meal.id;
                    const short = slot === "Déjeuner" ? "Déj" : slot === "Dîner" ? "Dîn" : slot.slice(0, 3);
                    const dessert =
                      meal.mealType === "diner" ? soirDessert : meal.mealType === "dejeuner" ? midiDessert : null;
                    const dessertSlot: DessertSlot = meal.mealType === "diner" ? "soir" : "midi";
                    const dessertId = dessert ? dessertPlanningId(dessertSlot, dayIndex) : null;
                    const dessertTag = dessertTagOf(dessertSlot);
                    return (
                      <div key={meal.id} className="space-y-1">
                        <button
                          type="button"
                          data-week-slot={meal.id}
                          disabled={busy && !drag}
                          onContextMenu={(event) => event.preventDefault()}
                          onPointerDown={(event) => {
                            if (!empty) startPress(meal.id, meal.baseName, tag, event);
                          }}
                          onClick={() => {
                            if (skipClick.current) {
                              skipClick.current = false;
                              return;
                            }
                            if (drag) return;
                            if (empty) onGenerate(meal.id);
                            else if (tag) onOpen(meal, tag);
                          }}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left select-none",
                            empty ? "bg-health-bg" : "hover:bg-health-bg",
                            over && "ring-2 ring-health-ink",
                            from && "opacity-40",
                            busy && !drag && "disabled:opacity-50",
                          )}
                          style={{ WebkitTouchCallout: "none", touchAction: drag ? "none" : "manipulation" }}
                        >
                          <span className="w-8 shrink-0 text-[11px] font-semibold text-health-muted">{short}</span>
                          {empty ? (
                            <span className="text-[13px] text-health-muted">
                              {over && drag ? "Déposer ici" : "Aucun repas · Générer"}
                            </span>
                          ) : (
                            <>
                              {tag ? <RecipeTag recipeNo={tag} className="shrink-0" /> : null}
                              <span className="min-w-0 truncate text-[13px] font-medium leading-snug">
                                {meal.baseName}
                              </span>
                            </>
                          )}
                        </button>
                        {dessert && dessertId ? (
                          <button
                            type="button"
                            data-week-slot={dessertId}
                            disabled={busy && !drag}
                            onContextMenu={(event) => event.preventDefault()}
                            onPointerDown={(event) =>
                              startPress(dessertId, dessert.meal.baseName, dessertTag, event)
                            }
                            onClick={() => {
                              if (skipClick.current) {
                                skipClick.current = false;
                                return;
                              }
                              if (drag) return;
                              onOpenDessert?.(dessertSlot);
                            }}
                            className={cn(
                              "flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left select-none hover:bg-health-bg",
                              drag?.overId === dessertId && "ring-2 ring-health-ink",
                              drag?.fromId === dessertId && "opacity-40",
                              busy && !drag && "disabled:opacity-50",
                            )}
                            style={{ WebkitTouchCallout: "none", touchAction: drag ? "none" : "manipulation" }}
                          >
                            <span className="w-8 shrink-0 text-[11px] font-semibold text-health-muted">Des</span>
                            <RecipeTag recipeNo={dessertTag} className="shrink-0" />
                            <span className="min-w-0 truncate text-[13px] font-medium leading-snug">
                              {dessert.meal.baseName}
                            </span>
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
      {drag && typeof document !== "undefined"
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[90] flex max-w-[240px] items-center gap-2 rounded-xl bg-health-card px-2.5 py-1.5 shadow-card"
              style={{ left: drag.x + 12, top: drag.y - 18 }}
            >
              {drag.tag ? <RecipeTag recipeNo={drag.tag} className="shrink-0" /> : null}
              <span className="truncate text-[13px] font-semibold">{drag.label}</span>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
