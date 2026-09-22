"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame, Home, Settings, TrendingUp, Utensils } from "lucide-react";
import { APP_TAB_HREFS } from "@/lib/tabs";
import { cn } from "@/lib/utils";

const TAB_META = {
  "/": { label: "Aujourd'hui", icon: Home },
  "/repas": { label: "Repas", icon: Utensils },
  "/suivi": { label: "Suivi", icon: TrendingUp },
  "/metabolique": { label: "Métabo.", icon: Flame },
  "/parametres": { label: "Réglages", icon: Settings },
} as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 border-t border-health-line/80 bg-health-card/92 backdrop-blur-xl"
      style={{ paddingBottom: "var(--safe-bottom)" }}
    >
      <ul className="grid grid-cols-5 px-1 pt-1.5">
        {APP_TAB_HREFS.map((href) => {
          const tab = TAB_META[href];
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          const Icon = tab.icon;
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-1.5 text-[10px] font-medium",
                  active ? "text-health-ink" : "text-health-muted",
                )}
              >
                <Icon
                  size={22}
                  strokeWidth={active ? 2.4 : 1.8}
                  className={active ? "text-health-ink" : "text-health-muted"}
                />
                <span className="leading-tight">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
