"use client";

import { ProfileToggle } from "@/components/layout/ProfileToggle";
import { BottomNav } from "@/components/layout/BottomNav";
import { GeminiWaitHost } from "@/components/ui/GeminiWait";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-[430px] bg-health-bg">
      <ProfileToggle />
      <main className="px-4 pb-nav pt-2">{children}</main>
      <BottomNav />
      <GeminiWaitHost />
    </div>
  );
}
