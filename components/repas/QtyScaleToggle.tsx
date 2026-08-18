"use client";

import { cn } from "@/lib/utils";
import type { QtyMode } from "@/lib/qty-scale";

export type { QtyMode };

export function QtyScaleToggle({
  mode,
  onChange,
}: {
  mode: QtyMode;
  onChange: (mode: QtyMode) => void;
}) {
  return (
    <div className="mt-2 rounded-card bg-white p-1 shadow-card">
      <div className="flex">
          {(
            [
              ["repas", "1 repas / pers."],
              ["batch", "Total à cuisiner"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={cn(
                "flex-1 rounded-full py-2 text-[12px] font-semibold",
                mode === id ? "bg-health-ink text-white" : "text-health-muted",
              )}
            >
              {label}
            </button>
          ))}
      </div>
      <p className="px-2 pb-2 pt-1 text-center text-[11px] leading-snug text-health-muted">
        {mode === "batch"
          ? "Weekday : 2 pers. × 2 repas = 4 assiettes. Week-end : 1 repas / pers."
          : "Quantités pour 1 assiette. « Total à cuisiner » = ce que tu mets dans les casseroles."}
      </p>
    </div>
  );
}
