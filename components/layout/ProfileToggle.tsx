"use client";

import { Moon, Sun } from "lucide-react";
import { WeatherChip } from "@/components/layout/WeatherChip";
import { useProfile } from "@/context/ProfileContext";
import { useTheme } from "@/context/ThemeContext";
import { VIEW_ORDER } from "@/lib/view-cycle";
import { cn } from "@/lib/utils";
import type { ViewMode } from "@/lib/types";

const LABELS: Record<ViewMode, string> = {
  alexis: "Alexis",
  elodie: "Élodie",
  couple: "Couple",
};

export function ProfileToggle() {
  const { view, setView } = useProfile();
  const { toggleScheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 bg-health-bg/85 px-4 pb-3 pt-3 backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 rounded-full bg-health-card p-1 shadow-card">
          {VIEW_ORDER.map((id) => {
            const active = view === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setView(id)}
                className={cn(
                  "flex-1 rounded-full py-2 text-[13px] font-semibold tracking-tight transition",
                  active && id === "alexis" && "bg-coral text-white shadow-sm",
                  active && id === "elodie" && "bg-violet text-white shadow-sm",
                  active && id === "couple" && "bg-health-ink text-white shadow-sm",
                  !active && "text-health-muted",
                )}
              >
                {LABELS[id]}
              </button>
            );
          })}
        </div>
        <WeatherChip />
        <button
          type="button"
          onClick={toggleScheme}
          aria-label="Mode clair ou sombre"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-health-card text-health-ink shadow-card"
        >
          <Moon size={18} strokeWidth={2} className="dark:hidden" />
          <Sun size={18} strokeWidth={2} className="hidden dark:block" />
        </button>
      </div>
    </header>
  );
}
