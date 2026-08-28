"use client";

import { useEffect, useMemo, useState } from "react";
import { CatSticker } from "@/components/ui/CatSticker";
import {
  delightCopy,
  loadDelightFlags,
  markDelightShown,
  pendingDelightLayers,
  type DelightLayer,
} from "@/lib/today-delight";
import { todayISO } from "@/lib/dates";
import type { ProfileId } from "@/lib/types";

type ProfileReady = {
  id: ProfileId;
  name: string;
  meals: boolean;
  session: boolean;
  journal: boolean;
};

export function TodayDelight({
  profiles,
  couple,
  armed,
}: {
  profiles: ProfileReady[];
  couple: boolean;
  armed: boolean;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const signature = `${couple}:${profiles.map((p) => `${p.id}:${p.meals}:${p.session}:${p.journal}`).join("|")}`;
  const pending = useMemo(() => {
    if (!armed) return [];
    const date = todayISO();
    const next: Array<{ id: ProfileId; name: string; layers: DelightLayer[] }> = [];
    for (const profile of profiles) {
      const layers = pendingDelightLayers(
        { meals: profile.meals, session: profile.session, journal: profile.journal },
        loadDelightFlags(profile.id, date),
      );
      if (layers.length) next.push({ id: profile.id, name: profile.name, layers });
    }
    return next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [armed, signature]);

  useEffect(() => {
    if (pending.length === 0) return;
    const date = todayISO();
    const shared = couple && pending.length > 1;
    const text = shared
      ? delightCopy([...new Set(pending.flatMap((item) => item.layers))])
      : delightCopy(pending[0].layers, couple ? pending[0].name : undefined);
    setMessage(text);
    const hide = window.setTimeout(() => {
      for (const item of pending) markDelightShown(item.id, item.layers, date);
      setMessage(null);
    }, 2600);
    return () => window.clearTimeout(hide);
  }, [couple, pending]);

  if (!message) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--nav-height)+var(--safe-bottom)+20px)] z-[70] flex justify-center px-4">
      <div className="today-delight-pop flex max-w-[430px] items-center gap-2.5 rounded-card bg-health-ink px-3.5 py-2.5 text-health-on-fill shadow-card">
        <CatSticker mood="ok" className="h-8 w-9 shrink-0 text-health-on-fill" />
        <p className="text-[13px] font-semibold leading-snug">{message}</p>
      </div>
    </div>
  );
}
