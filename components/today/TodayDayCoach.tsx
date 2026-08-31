"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui/Card";
import { requestCoachToday } from "@/lib/gemini/client";
import type { CoachTodayAdvice } from "@/lib/gemini/coach-today";
import type { CoachTodaySnapshot, TodayCoachRemark } from "@/lib/today-coach";
import { cn } from "@/lib/utils";

export function TodayDayCoach({
  remark,
  snapshot,
}: {
  remark: TodayCoachRemark | null;
  snapshot: CoachTodaySnapshot | null;
}) {
  const [advice, setAdvice] = useState<CoachTodayAdvice | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setAdvice(null);
  }, [snapshot?.hunger, snapshot?.energy, snapshot?.fatigue, snapshot?.eaten, snapshot?.pendingMin]);

  async function ask() {
    if (!snapshot) return;
    setBusy(true);
    try {
      setAdvice(await requestCoachToday(snapshot));
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
          {busy ? "Le coach prépare 3 actions…" : "Conseil du moment"}
        </button>
        {advice ? (
          <div className="mt-3 space-y-2">
            <p className="text-[12px] font-semibold text-health-muted">{advice.title}</p>
            {advice.actions.map((action) => (
              <div key={action.label} className="rounded-2xl bg-health-bg px-3 py-2.5">
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
