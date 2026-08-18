"use client";

import { Moon, Sun } from "lucide-react";
import { useProfile } from "@/context/ProfileContext";
import { useTheme } from "@/context/ThemeContext";
import { cn } from "@/lib/utils";
import type { ViewMode } from "@/lib/types";

const OPTIONS: { id: ViewMode; label: string }[] = [
  { id: "alexis", label: "Alexis" },
  { id: "elodie", label: "Élodie" },
  { id: "couple", label: "Couple" },
];

export function ProfileToggle() {
  const { view, setView } = useProfile();
  const { toggleScheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 bg-health-bg/85 px-4 pb-3 pt-3 backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 rounded-full bg-health-card p-1 shadow-card">
          {OPTIONS.map((option) => {
            const active = view === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setView(option.id)}
                className={cn(
                  "flex-1 rounded-full py-2 text-[13px] font-semibold tracking-tight transition",
                  active && option.id === "alexis" && "bg-coral text-white shadow-sm",
                  active && option.id === "elodie" && "bg-violet text-white shadow-sm",
                  active && option.id === "couple" && "bg-health-ink text-white shadow-sm",
                  !active && "text-health-muted",
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>
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
