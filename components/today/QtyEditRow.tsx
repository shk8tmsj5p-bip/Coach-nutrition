"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { formatQtyNumber, qtyStep, unitShortLabel } from "@/lib/food-log";
import type { QtyUnit } from "@/lib/types";
import { cn } from "@/lib/utils";

function parseDecimal(raw: string) {
  const next = Number(raw.trim().replace(",", "."));
  return Number.isFinite(next) && next > 0 ? next : null;
}

function NumberField({
  value,
  suffix,
  width = "w-12",
  onCommit,
}: {
  value: number;
  suffix: string;
  width?: string;
  onCommit: (next: number) => void;
}) {
  const [text, setText] = useState(formatQtyNumber(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(formatQtyNumber(value));
  }, [value, focused]);

  function commitIfReady(raw: string) {
    if (/[.,]$/.test(raw.trim())) return;
    const next = parseDecimal(raw);
    if (next != null) onCommit(next);
  }

  return (
    <label className="flex shrink-0 items-center gap-0.5">
      <input
        inputMode="decimal"
        value={text}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          const next = parseDecimal(text);
          if (next != null) onCommit(next);
          else setText(formatQtyNumber(value));
        }}
        onChange={(e) => {
          const raw = e.target.value;
          setText(raw);
          commitIfReady(raw);
        }}
        className={cn(
          "rounded-md bg-white px-0.5 py-1 text-center text-[13px] tabular-nums leading-none dark:bg-health-card",
          width,
        )}
      />
      <span className="text-[10px] font-semibold text-health-muted">{suffix}</span>
    </label>
  );
}

export function QtyEditRow({
  name,
  qty,
  unit,
  grams,
  calories,
  detail,
  dessert,
  onQty,
  onGrams,
  onKcal,
  onRemove,
}: {
  name: string;
  qty: number;
  unit: QtyUnit;
  grams: number;
  calories?: number;
  detail?: string;
  dessert?: boolean;
  onQty: (qty: number) => void;
  onGrams?: (grams: number) => void;
  onKcal?: (kcal: number) => void;
  onRemove: () => void;
}) {
  const step = qtyStep(unit);
  const spoon = unit === "cs" || unit === "cc" || unit === "carreau" || unit === "ml";
  const setGrams = onGrams ?? onQty;

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-xl px-2 py-1.5",
        dessert ? "bg-amber-50 dark:bg-amber-950/40" : "bg-health-bg",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium leading-tight">{name}</p>
        {detail ? <p className="text-[10px] leading-tight text-health-muted">{detail}</p> : null}
      </div>
      {spoon ? (
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[15px] leading-none dark:bg-health-card"
            onClick={() => onQty(Math.max(0.1, qty - step))}
          >
            −
          </button>
          <NumberField value={qty} suffix={unitShortLabel(unit)} width="w-10" onCommit={onQty} />
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[15px] leading-none dark:bg-health-card"
            onClick={() => onQty(qty + step)}
          >
            +
          </button>
        </div>
      ) : null}
      <NumberField value={grams} suffix="g" onCommit={setGrams} />
      {onKcal && calories != null ? (
        <NumberField value={calories} suffix="kcal" width="w-[2.75rem]" onCommit={onKcal} />
      ) : null}
      <button type="button" className="shrink-0 p-0.5 text-health-muted" onClick={onRemove}>
        <Trash2 size={14} />
      </button>
    </div>
  );
}
