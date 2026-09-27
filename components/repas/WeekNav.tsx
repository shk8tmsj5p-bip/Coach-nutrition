"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addMonthsISO,
  formatMonthYear,
  mondayOf,
  monthGridWeeks,
  startOfMonth,
  todayISO,
} from "@/lib/dates";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"] as const;

export function WeekNav({
  weekStart,
  onChange,
}: {
  weekStart: string;
  onChange: (weekStart: string) => void;
}) {
  const today = todayISO();
  const current = mondayOf(today);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(weekStart));

  useEffect(() => {
    setViewMonth(startOfMonth(weekStart));
  }, [weekStart]);

  const weeks = monthGridWeeks(viewMonth);
  const viewKey = startOfMonth(viewMonth);
  const showToday = weekStart !== current || viewKey !== startOfMonth(today);

  return (
    <div className="mt-3 rounded-card bg-health-card px-2 py-1.5 shadow-card">
      <div className="flex items-center">
        <button
          type="button"
          aria-label="Mois précédent"
          onClick={() => setViewMonth(addMonthsISO(viewMonth, -1))}
          className="flex h-7 w-7 items-center justify-center rounded-full text-health-muted"
        >
          <ChevronLeft size={16} />
        </button>
        <p className="min-w-0 flex-1 truncate text-center text-[13px] font-semibold capitalize">
          {formatMonthYear(viewMonth)}
        </p>
        {showToday ? (
          <button
            type="button"
            onClick={() => onChange(current)}
            className="shrink-0 pr-0.5 text-[11px] font-semibold text-health-muted"
          >
            Aujourd&apos;hui
          </button>
        ) : null}
        <button
          type="button"
          aria-label="Mois suivant"
          onClick={() => setViewMonth(addMonthsISO(viewMonth, 1))}
          className="flex h-7 w-7 items-center justify-center rounded-full text-health-muted"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7">
        {WEEKDAYS.map((label, index) => (
          <p key={`${label}-${index}`} className="text-center text-[10px] font-semibold leading-4 text-health-muted">
            {label}
          </p>
        ))}
      </div>

      <div>
        {weeks.map((days) => {
          const rowStart = days[0]!;
          const selected = mondayOf(rowStart) === weekStart;
          return (
            <div
              key={rowStart}
              className={cn("grid grid-cols-7 rounded-lg", selected && "bg-[rgb(var(--c-track))]")}
            >
              {days.map((iso) => {
                const inMonth = startOfMonth(iso) === viewKey;
                const isToday = iso === today;
                const day = Number(iso.slice(8, 10));
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => onChange(mondayOf(iso))}
                    aria-label={dayAria(iso, isToday, selected)}
                    aria-current={isToday ? "date" : undefined}
                    aria-pressed={selected}
                    className="flex h-7 items-center justify-center"
                  >
                    <span
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold",
                        !inMonth && "text-health-muted/40",
                        inMonth && "text-health-ink",
                        isToday && "ring-1 ring-health-ink",
                        isToday && selected && "bg-health-ink text-white ring-0",
                      )}
                    >
                      {day}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function dayAria(iso: string, isToday: boolean, selected: boolean) {
  const date = new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const bits = [date];
  if (isToday) bits.push("aujourd'hui");
  bits.push(selected ? "semaine affichée" : "choisir cette semaine");
  return bits.join(", ");
}
