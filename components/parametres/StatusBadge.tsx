"use client";

import { cn } from "@/lib/utils";

export type ConnectionTone = "ok" | "warn" | "off";

export function StatusBadge({ tone, label }: { tone: ConnectionTone; label: string }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        tone === "ok" && "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
        tone === "warn" && "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
        tone === "off" && "bg-health-bg text-health-muted",
      )}
    >
      {label}
    </span>
  );
}
