"use client";

import { Bike, Dumbbell, Footprints, Sparkles } from "lucide-react";
import type { SportActivity } from "@/lib/types";

export type SportHubId = SportActivity | "coach";

const ITEMS: Array<{ id: SportHubId; label: string; icon: typeof Bike }> = [
  { id: "course", label: "Course", icon: Footprints },
  { id: "velo", label: "Vélo", icon: Bike },
  { id: "muscu", label: "Muscu", icon: Dumbbell },
  { id: "coach", label: "Coach", icon: Sparkles },
];

export function SportHubBar({ onOpen }: { onOpen: (id: SportHubId) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onOpen(item.id)}
          className="flex flex-col items-center gap-1 rounded-card bg-health-bg py-2.5 text-[11px] font-semibold text-health-ink"
        >
          <item.icon size={16} strokeWidth={2} />
          {item.label}
        </button>
      ))}
    </div>
  );
}
