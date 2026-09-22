"use client";

import { Ban, Coffee, CookingPot, KeyRound, ListChecks, Lock } from "lucide-react";

export type SettingsHubId = "acces" | "regles" | "aversions" | "materiel" | "habitudes" | "cles";

const ITEMS: Array<{ id: SettingsHubId; label: string; icon: typeof Lock }> = [
  { id: "acces", label: "Accès", icon: Lock },
  { id: "regles", label: "Règles", icon: ListChecks },
  { id: "aversions", label: "Aversions", icon: Ban },
  { id: "materiel", label: "Matériel", icon: CookingPot },
  { id: "habitudes", label: "Habitudes", icon: Coffee },
  { id: "cles", label: "Clés API", icon: KeyRound },
];

export function SettingsHubBar({ onOpen }: { onOpen: (id: SettingsHubId) => void }) {
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
