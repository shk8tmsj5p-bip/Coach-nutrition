"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function CoachBadge({
  onDismiss,
}: {
  onDismiss?: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-coral-soft px-2 py-0.5 text-[11px] font-semibold text-coral-dark">
      Ajustement Coach
      {onDismiss ? (
        <button
          type="button"
          aria-label="Masquer l’ajustement"
          onClick={(event) => {
            event.stopPropagation();
            onDismiss();
          }}
          className="rounded-full p-0.5 text-coral-dark/80 hover:bg-white/60"
        >
          <X size={11} />
        </button>
      ) : null}
    </span>
  );
}

export function CoachDiffTags({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full bg-coral-soft px-2 py-0.5 text-[11px] font-semibold tabular-nums text-coral-dark"
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-coral" />
          {tag}
        </span>
      ))}
    </div>
  );
}

export function coachHighlightClass(active: boolean) {
  return cn(active && "ring-1 ring-coral/35");
}
