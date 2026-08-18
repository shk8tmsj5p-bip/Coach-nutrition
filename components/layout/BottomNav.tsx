"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame, Home, Settings, TrendingUp, Utensils } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Aujourd'hui", icon: Home },
  { href: "/repas", label: "Repas", icon: Utensils },
  { href: "/suivi", label: "Suivi", icon: TrendingUp },
  { href: "/metabolique", label: "Métabo.", icon: Flame },
  { href: "/parametres", label: "Réglages", icon: Settings },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 border-t border-health-line/80 bg-health-card/92 backdrop-blur-xl"
      style={{ paddingBottom: "var(--safe-bottom)" }}
    >
      <ul className="grid grid-cols-5 px-1 pt-1.5">
        {TABS.map((tab) => {
          const active =
            tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
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
