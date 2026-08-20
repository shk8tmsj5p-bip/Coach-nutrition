"use client";

import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

export function FavoriteHeart({
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
      aria-label={on ? "Retirer des favoris" : "Garder en favori"}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-full",
        on ? "bg-coral-soft text-coral-dark" : "bg-health-bg text-health-muted",
        className,
      )}
    >
      <Heart size={15} fill={on ? "currentColor" : "none"} />
    </button>
  );
}
