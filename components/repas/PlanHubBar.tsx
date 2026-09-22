"use client";

import { Cookie, Trash2, Utensils, Warehouse } from "lucide-react";
import { cn } from "@/lib/utils";

export type PlanHubId = "stock" | "plat" | "dessert";

export function PlanHubBar({
  busy,
  canClear,
  onOpen,
  onClearWeek,
}: {
  busy?: boolean;
  canClear?: boolean;
  onOpen: (id: PlanHubId) => void;
  onClearWeek: () => void;
}) {
  return (
    <div className="mt-3 grid grid-cols-4 gap-1.5">
      {(
        [
          { id: "stock" as const, label: "Stock", icon: Warehouse },
          { id: "plat" as const, label: "Plat", icon: Utensils },
          { id: "dessert" as const, label: "Dessert", icon: Cookie },
        ] as const
      ).map((item) => (
        <button
          key={item.id}
          type="button"
          disabled={busy}
          onClick={() => onOpen(item.id)}
          className="flex flex-col items-center gap-1 rounded-card bg-white py-2.5 text-[11px] font-semibold text-health-ink shadow-card disabled:opacity-50"
        >
          <item.icon size={16} strokeWidth={2} />
          {item.label}
        </button>
      ))}
      <button
        type="button"
        disabled={busy || !canClear}
        onClick={onClearWeek}
        className={cn(
          "flex flex-col items-center gap-1 rounded-card px-1 py-2.5 text-center text-[11px] font-semibold leading-tight shadow-card disabled:opacity-40",
          "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300",
        )}
      >
        <Trash2 size={16} strokeWidth={2} />
        Vider semaine
      </button>
    </div>
  );
}
