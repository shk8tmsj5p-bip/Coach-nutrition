"use client";

import { cn } from "@/lib/utils";
import { qtyModeChoices, type QtyMode } from "@/lib/qty-scale";
import type { PlannedMeal } from "@/lib/types";

export type { QtyMode };

const FALLBACK = [
  { id: "repas" as const, label: "1 repas", detail: "Une assiette / pers." },
  { id: "batch" as const, label: "2 repas", detail: "Le batch semaine · 4 assiettes foyer" },
];

export function QtyScaleToggle({
  mode,
  onChange,
  meal,
}: {
  mode: QtyMode;
  onChange: (mode: QtyMode) => void;
  meal?: PlannedMeal;
}) {
  const choices = meal ? qtyModeChoices(meal) : FALLBACK;
  const active = choices.find((row) => row.id === mode) ?? choices[0];
  return (
    <div className="mt-2 rounded-card bg-white p-1 shadow-card">
      <div className="flex">
        {choices.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => onChange(row.id)}
            className={cn(
              "flex-1 rounded-full py-2 text-[12px] font-semibold",
              mode === row.id ? "bg-health-ink text-white" : "text-health-muted",
            )}
          >
            {row.label}
          </button>
        ))}
      </div>
      <p className="px-2 pb-2 pt-1 text-center text-[11px] leading-snug text-health-muted">
        {active?.detail}
      </p>
    </div>
  );
}
