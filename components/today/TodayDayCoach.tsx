"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui/Card";
import { requestCoachToday } from "@/lib/gemini/client";
import type { CoachTodayAdvice } from "@/lib/gemini/coach-today";
import {
  loadCoachTodayAdvice,
  persistCoachTodayAdvice,
  type CoachTodaySnapshot,
  type TodayCoachRemark,
} from "@/lib/today-coach";
import type { ProfileId } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TodayDayCoach({
  profileId,
  remark,
  snapshot,
}: {
  profileId: ProfileId;
  remark: TodayCoachRemark | null;
  snapshot: CoachTodaySnapshot | null;
}) {
  const [advice, setAdvice] = useState<CoachTodayAdvice | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setAdvice(loadCoachTodayAdvice(profileId));
  }, [profileId]);

  async function ask() {
    if (!snapshot) return;
    setBusy(true);
    try {
      const next = await requestCoachToday(snapshot);
      persistCoachTodayAdvice(profileId, next);
      setAdvice(next);
    } finally {
      setBusy(false);
    }
  }

  if (!remark || !snapshot) return null;

  const tone =
    remark.tone === "warn"
      ? "text-amber-800 dark:text-amber-200"
      : remark.tone === "go"
        ? "text-emerald-700 dark:text-emerald-300"
        : "text-health-ink";

  return (
    <>
      <SectionTitle>Coach du jour</SectionTitle>
      <Card className={cn(remark.tone === "warn" && "border border-amber-200 dark:border-amber-900")}>
        <p className={cn("text-[15px] font-semibold", tone)}>{remark.title}</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-health-ink">{remark.message}</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void ask()}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-card bg-health-bg py-2.5 text-[13px] font-semibold disabled:opacity-50"
        >
          <Sparkles size={14} />
          {busy ? "Le coach prépare 3 actions…" : advice ? "Nouveau conseil" : "Conseil du moment"}
        </button>
        {advice ? (
          <div className="mt-3 space-y-2">
            <p className="text-[12px] font-semibold text-health-muted">{advice.title}</p>
            {advice.actions.map((action, index) => (
              <div key={`${action.label}-${index}`} className="rounded-2xl bg-health-bg px-3 py-2.5">
                <p className="text-[13px] font-semibold">{action.label}</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-health-muted">{action.detail}</p>
              </div>
            ))}
          </div>
        ) : null}
      </Card>
    </>
  );
}
