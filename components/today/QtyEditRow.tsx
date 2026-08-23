"use client";

import { Trash2 } from "lucide-react";
import { qtyStep, unitShortLabel } from "@/lib/food-log";
import type { QtyUnit } from "@/lib/types";
import { cn } from "@/lib/utils";

const FRUIT_QTY = [0.5, 1, 2] as const;

export function QtyEditRow({
  name,
  qty,
  unit,
  grams,
  detail,
  dessert,
  onQty,
  onGrams,
  onRemove,
}: {
  name: string;
  qty: number;
  unit: QtyUnit;
  grams: number;
  detail?: string;
  dessert?: boolean;
  onQty: (qty: number) => void;
  onGrams?: (grams: number) => void;
  onRemove: () => void;
}) {
  const step = qtyStep(unit);
  const visual = unit !== "g" && unit !== "ml";
  const fruit = unit === "piece";
  const fruitLabel = fruit && !/oeuf|œuf/i.test(name) ? "fruit" : null;

  return (
    <div
      className={cn(
        "mb-1.5 rounded-card p-3",
        dessert ? "bg-amber-50 dark:bg-amber-950/40" : "bg-health-bg",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium">{name}</p>
          {detail ? <p className="text-[11px] text-health-muted">{detail}</p> : null}
        </div>
        <button type="button" className="mt-0.5 shrink-0 text-health-muted" onClick={onRemove}>
          <Trash2 size={16} />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {fruit ? (
          <div className="flex items-center gap-1">
            {FRUIT_QTY.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onQty(n)}
                className={cn(
                  "h-8 min-w-8 rounded-full px-2.5 text-[12px] font-semibold",
                  qty === n
                    ? "bg-health-ink text-white"
                    : "bg-white text-health-muted dark:bg-health-card",
                )}
              >
                {n === 0.5 ? "½" : n}
              </button>
            ))}
            <span className="pl-0.5 text-[11px] font-semibold text-health-muted">
              {fruitLabel ?? "pce"}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="h-8 w-8 rounded-full bg-white text-lg leading-none dark:bg-health-card"
              onClick={() => onQty(qty - step)}
            >
              −
            </button>
            <input
              inputMode="decimal"
              value={qty}
              onChange={(e) => {
                const next = Number(e.target.value.replace(",", "."));
                if (Number.isFinite(next) && next > 0) onQty(next);
              }}
              className="w-12 rounded-md bg-white text-center text-[13px] tabular-nums dark:bg-health-card"
            />
            <span className="w-8 text-[11px] font-semibold text-health-muted">{unitShortLabel(unit)}</span>
            <button
              type="button"
              className="h-8 w-8 rounded-full bg-white text-lg leading-none dark:bg-health-card"
              onClick={() => onQty(qty + step)}
            >
              +
            </button>
          </div>
        )}
        {visual && onGrams ? (
          <label className="ml-auto flex items-center gap-1">
            <input
              inputMode="numeric"
              value={Math.round(grams)}
              onChange={(e) => {
                const next = Number(e.target.value.replace(",", "."));
                if (Number.isFinite(next) && next > 0) onGrams(next);
              }}
              className="w-14 rounded-md bg-white py-1.5 text-center text-[13px] tabular-nums dark:bg-health-card"
            />
            <span className="text-[11px] font-semibold text-health-muted">g</span>
          </label>
        ) : null}
      </div>
    </div>
  );
}
