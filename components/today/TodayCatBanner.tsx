"use client";

import { CatSticker } from "@/components/ui/CatSticker";
import { cn } from "@/lib/utils";

export function TodayCatBanner({
  line,
  streak,
}: {
  line: string;
  streak: number;
}) {
  return (
    <div className="mt-2 flex items-start gap-2.5">
      <div className="mt-0.5 shrink-0 text-health-ink">
        <CatSticker mood="ok" className="h-7 w-7" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] leading-snug text-health-ink">{line}</p>
        {streak > 0 ? (
          <p className={cn("mt-1 inline-flex items-center gap-1.5 text-[11px] font-semibold text-health-muted")}>
            <CoupleFlame />
            {streak} j ensemble
          </p>
        ) : null}
      </div>
    </div>
  );
}

function CoupleFlame() {
  return (
    <span className="relative inline-block h-3.5 w-3.5" aria-hidden>
      <svg viewBox="0 0 12 14" className="absolute left-0 top-0 h-3.5 w-3 text-coral">
        <path fill="currentColor" d="M6 1 C4 4 2 6 2 9 C2 12 4.2 14 6 14 C5 11 6.5 9 7 7 C5.5 8 5 10 6 12 C8.5 11 10 9 10 7 C10 4 8 2 6 1 Z" />
      </svg>
      <svg viewBox="0 0 12 14" className="absolute -right-0.5 top-0.5 h-3 w-2.5 text-violet">
        <path fill="currentColor" d="M6 1 C4 4 2 6 2 9 C2 12 4.2 14 6 14 C5 11 6.5 9 7 7 C5.5 8 5 10 6 12 C8.5 11 10 9 10 7 C10 4 8 2 6 1 Z" />
      </svg>
    </span>
  );
}
