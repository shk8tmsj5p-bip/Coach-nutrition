"use client";

import { Trash2 } from "lucide-react";
import { qtyStep, unitShortLabel } from "@/lib/food-log";
import type { QtyUnit } from "@/lib/types";
import { cn } from "@/lib/utils";

export function QtyEditRow({
  name,
  qty,
  unit,
  grams,
  detail,
  dessert,
  onQty,
  onRemove,
}: {
  name: string;
  qty: number;
  unit: QtyUnit;
  grams: number;
  detail?: string;
  dessert?: boolean;
  onQty: (qty: number) => void;
  onRemove: () => void;
}) {
  const step = qtyStep(unit);
  const visual = unit !== "g" && unit !== "ml";

  return (
    <div
      className={cn(
        "mb-1.5 flex items-center gap-2 rounded-card p-3",
        dessert ? "bg-amber-50 dark:bg-amber-950/40" : "bg-health-bg",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium">{name}</p>
        {detail ? <p className="text-[11px] text-health-muted">{detail}</p> : null}
        {visual ? (
          <p className="mt-0.5 text-[11px] tabular-nums text-health-muted">{Math.round(grams)} g</p>
        ) : null}
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="h-8 w-8 rounded-full bg-white text-lg leading-none"
          onClick={() => onQty(qty - step)}
        >
          −
        </button>
        <input
          inputMode="numeric"
          value={qty}
          onChange={(e) => {
            const next = Number(e.target.value.replace(",", "."));
            if (Number.isFinite(next) && next > 0) onQty(next);
          }}
          className="w-12 rounded-md bg-white text-center text-[13px] tabular-nums"
        />
        <span className="w-8 text-[11px] font-semibold text-health-muted">{unitShortLabel(unit)}</span>
        <button
          type="button"
          className="h-8 w-8 rounded-full bg-white text-lg leading-none"
          onClick={() => onQty(qty + step)}
        >
          +
        </button>
        <button type="button" className="ml-1 text-health-muted" onClick={onRemove}>
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
