"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDaysISO, formatWeekRange, mondayOf, todayISO } from "@/lib/dates";
import { cn } from "@/lib/utils";

export function WeekNav({
  weekStart,
  onChange,
}: {
  weekStart: string;
  onChange: (weekStart: string) => void;
}) {
  const current = mondayOf(todayISO());
  const isCurrent = weekStart === current;

  return (
    <div className="mt-3 rounded-card bg-white p-2 shadow-card">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(addDaysISO(weekStart, -7))}
          className="flex flex-1 items-center justify-center gap-0.5 rounded-full py-2 text-[11px] font-semibold text-health-muted"
        >
          <ChevronLeft size={14} />
          Semaine précédente
        </button>
        <button
          type="button"
          disabled={isCurrent}
          onClick={() => onChange(current)}
          className={cn(
            "rounded-full px-3 py-2 text-[12px] font-semibold",
            isCurrent ? "bg-health-ink text-white" : "bg-health-bg text-health-ink",
          )}
        >
          Aujourd&apos;hui
        </button>
        <button
          type="button"
          onClick={() => onChange(addDaysISO(weekStart, 7))}
          className="flex flex-1 items-center justify-center gap-0.5 rounded-full py-2 text-[11px] font-semibold text-health-muted"
        >
          Semaine suivante
          <ChevronRight size={14} />
        </button>
      </div>
      <p className="mt-1 text-center text-[13px] font-semibold capitalize">{formatWeekRange(weekStart)}</p>
    </div>
  );
}
