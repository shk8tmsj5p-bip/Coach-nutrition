"use client";

import { CatSticker } from "@/components/ui/CatSticker";
import { CAT_FEEL_LABELS, FEEL_MOODS, type CatFeelMood, type FeelAxis } from "@/lib/cat-feel";
import { cn } from "@/lib/utils";

export function FeelStickerRow({
  axis,
  label,
  hint,
  value,
  onChange,
  surface = "card",
}: {
  axis: FeelAxis;
  label: string;
  hint?: string;
  value: CatFeelMood | null;
  onChange: (value: CatFeelMood) => void;
  surface?: "card" | "wash";
}) {
  return (
    <div className="flex items-center justify-between gap-3" data-feel-axis={axis}>
      <div className="min-w-0">
        <span className="text-[14px] font-medium">{label}</span>
        {hint ? (
          <p className="mt-0.5 text-[11px] leading-snug text-health-muted">{hint}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 gap-1">
        {FEEL_MOODS.map((mood) => {
          const on = value === mood;
          return (
            <button
              key={mood}
              type="button"
              onClick={() => onChange(mood)}
              className={cn(
                "flex min-h-11 min-w-[3.15rem] flex-col items-center justify-center rounded-xl px-1 py-1",
                on
                  ? "bg-health-ink text-white"
                  : surface === "wash"
                    ? "bg-white text-health-muted"
                    : "bg-health-bg text-health-muted",
              )}
              aria-pressed={on}
              aria-label={`${label} ${CAT_FEEL_LABELS[mood]}`}
            >
              <CatSticker mood={mood} selected={on} className="h-8 w-8" />
              <span className="mt-0.5 text-[9px] font-semibold leading-none">
                {CAT_FEEL_LABELS[mood]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
