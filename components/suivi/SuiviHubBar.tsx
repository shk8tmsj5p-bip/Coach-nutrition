"use client";

import { BookOpen, CalendarDays, Dumbbell, Heart, PersonStanding, Scale } from "lucide-react";

export type SuiviHubId = "journal" | "journees" | "poids" | "corps" | "sante" | "sport";

const ITEMS: Array<{ id: SuiviHubId; label: string; icon: typeof Scale }> = [
  { id: "journal", label: "Journal", icon: BookOpen },
  { id: "journees", label: "Journées", icon: CalendarDays },
  { id: "poids", label: "Poids", icon: Scale },
  { id: "corps", label: "Corps", icon: PersonStanding },
  { id: "sante", label: "Santé", icon: Heart },
  { id: "sport", label: "Sport", icon: Dumbbell },
];

export function SuiviHubBar({ onOpen }: { onOpen: (id: SuiviHubId) => void }) {
  return (
    <div className="mt-3 grid grid-cols-3 gap-1.5">
      {ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onOpen(item.id)}
          className="flex flex-col items-center gap-1 rounded-card bg-white py-2.5 text-[11px] font-semibold text-health-ink shadow-card"
        >
          <item.icon size={16} strokeWidth={2} />
          {item.label}
        </button>
      ))}
    </div>
  );
}
