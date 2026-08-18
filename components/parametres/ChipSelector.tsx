"use client";

import { cn } from "@/lib/utils";

export function ChipSelector<T extends string>({
  value,
  options,
  onChange,
  stacked,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (value: T) => void;
  stacked?: boolean;
}) {
  return (
    <div className={cn(stacked ? "flex flex-col gap-1" : "flex rounded-full bg-health-bg p-0.5")}>
      {options.map((option) => {
        const active = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={cn(
              stacked
                ? "rounded-lg px-2.5 py-1.5 text-left text-[13px] font-semibold"
                : "flex-1 rounded-full px-1 py-1.5 text-[12px] font-semibold leading-tight",
              stacked && active && "bg-health-ink text-health-on-fill",
              stacked && !active && "bg-health-bg text-health-muted",
              !stacked && active && "bg-health-card text-health-ink shadow-sm",
              !stacked && !active && "text-health-muted",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
