"use client";

import { Ban } from "lucide-react";
import { cn } from "@/lib/utils";

export function RejectMealButton({
  on,
  onClick,
  className,
}: {
  on: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={on ? "Retirer de Plus jamais" : "Plus jamais ce plat"}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-full",
        on ? "bg-red-50 text-red-600" : "bg-health-bg text-health-muted",
        className,
      )}
    >
      <Ban size={15} />
    </button>
  );
}
