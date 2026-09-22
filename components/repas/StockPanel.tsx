"use client";

import { useState } from "react";
import { ToggleRow } from "@/components/parametres/ToggleRow";
import {
  STOCK_GROUPS,
  addStockItem,
  formatStockItem,
  removeStockItem,
  type HouseholdStock,
  type StockGroup,
  type StockIntensity,
} from "@/lib/stock";
import { cn } from "@/lib/utils";

export function StockPanel({
  stock,
  onChange,
}: {
  stock: HouseholdStock;
  onChange: (next: HouseholdStock) => void;
}) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [group, setGroup] = useState<StockGroup>("epicerie");

  function add(rawName = name, qty = quantity, nextGroup = group) {
    const next = addStockItem(stock, { name: rawName, quantity: qty, group: nextGroup });
    if (next === stock) return;
    onChange(next);
    setName("");
    setQuantity("");
  }

  return (
    <div>
      {stock.items.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {stock.items.map((item) => (
            <span
              key={item.id}
              className="inline-flex max-w-full items-center gap-0.5 rounded-full bg-health-bg px-2 py-0.5 text-[11px] font-medium"
            >
              <span className="truncate">{formatStockItem(item)}</span>
              <button
                type="button"
                aria-label={`Retirer ${item.name}`}
                onClick={() => onChange(removeStockItem(stock, item.id))}
                className="shrink-0 opacity-70"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-[12px] text-health-muted">Aucun aliment pour l’instant.</p>
      )}

      <div className="mt-2 flex flex-wrap gap-1">
        {STOCK_GROUPS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setGroup(item.id)}
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-semibold",
              group === item.id ? "bg-health-ink text-white" : "bg-health-bg text-health-muted",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <form
        className="mt-1.5 flex gap-1.5"
        onSubmit={(event) => {
          event.preventDefault();
          add();
        }}
      >
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ex. Tofu ferme, restes curry P2"
          className="min-w-0 flex-1 rounded-lg bg-health-bg px-2.5 py-1.5 text-[13px] outline-none"
        />
        <input
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          placeholder="1 bloc"
          className="w-[72px] shrink-0 rounded-lg bg-health-bg px-2 py-1.5 text-[13px] outline-none"
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg bg-health-bg px-2.5 py-1.5 text-[12px] font-semibold"
        >
          Ajouter
        </button>
      </form>

      <div className="mt-2">
        <ToggleRow
          label="Utiliser le stock"
          checked={stock.useStock}
          onChange={(useStock) => onChange({ ...stock, useStock })}
        />
      </div>

      {stock.useStock && stock.items.length > 0 ? (
        <div className="mt-2 flex gap-1.5">
          {(
            [
              ["use", "S’en servir"],
              ["empty", "Vider le stock"],
            ] as const satisfies ReadonlyArray<readonly [StockIntensity, string]>
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => onChange({ ...stock, intensity: id })}
              className={cn(
                "flex-1 rounded-full py-1.5 text-[11px] font-semibold",
                stock.intensity === id ? "bg-health-ink text-white" : "bg-health-bg text-health-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
