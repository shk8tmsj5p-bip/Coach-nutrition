"use client";

import { usePathname } from "next/navigation";
import { ProfileToggle } from "@/components/layout/ProfileToggle";
import { BottomNav } from "@/components/layout/BottomNav";
import { useProfileSwipe } from "@/components/layout/useProfileSwipe";
import { GeminiWaitHost } from "@/components/ui/GeminiWait";
import { SeasonWeatherProvider } from "@/context/SeasonContext";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/unlock") {
    return (
      <div className="mx-auto min-h-dvh w-full max-w-[430px] bg-health-bg pt-[var(--safe-top)]">
        {children}
      </div>
    );
  }
  return (
    <SeasonWeatherProvider>
      <SwipableShell>{children}</SwipableShell>
    </SeasonWeatherProvider>
  );
}

function SwipableShell({ children }: { children: React.ReactNode }) {
  const swipe = useProfileSwipe();
  return (
    <div className="relative mx-auto min-h-dvh w-full max-w-[430px] bg-health-bg">
      <div
        className="relative z-10"
        onPointerDown={swipe.onPointerDown}
        onPointerUp={swipe.onPointerUp}
        onPointerCancel={swipe.onPointerCancel}
      >
        <ProfileToggle />
        <main className="px-4 pb-nav pt-2">{children}</main>
        <BottomNav />
      </div>
      <GeminiWaitHost />
    </div>
  );
}
