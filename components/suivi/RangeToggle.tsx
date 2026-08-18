"use client";

import { TREND_RANGES, type TrendRange } from "@/lib/pesees";
import { cn } from "@/lib/utils";

export function RangeToggle({
  value,
  onChange,
}: {
  value: TrendRange;
  onChange: (range: TrendRange) => void;
}) {
  return (
    <div className="flex rounded-full bg-health-bg p-0.5">
      {TREND_RANGES.map((option) => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={cn(
              "flex-1 rounded-full px-1 py-1.5 text-[11px] font-semibold leading-tight",
              active ? "bg-white text-health-ink shadow-sm" : "text-health-muted",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
