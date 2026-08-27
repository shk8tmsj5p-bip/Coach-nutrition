"use client";

import { useMemo, useState } from "react";
import { Card, SectionTitle } from "@/components/ui/Card";
import { RangeToggle } from "@/components/suivi/RangeToggle";
import { TrendChart } from "@/components/suivi/TrendChart";
import { energyBalanceLook, formatSignedKcal } from "@/lib/energy-balance";
import type { DailyEnergyRow } from "@/lib/energy-history";
import { addDaysISO, formatShortDate, todayISO } from "@/lib/dates";
import { sliceTrendRange, withMovingAverages, type TrendRange } from "@/lib/pesees";
import type { PrimaryGoal } from "@/lib/types";

function kcal(value: number) {
  return Math.round(value).toLocaleString("fr-FR");
}

export function DayEnergyCard({
  rows,
  goal,
  color,
  onOpenDay,
}: {
  rows: DailyEnergyRow[];
  goal: PrimaryGoal;
  color: string;
  onOpenDay: (date: string) => void;
}) {
  const [range, setRange] = useState<TrendRange>("14d");
  const today = todayISO();
  const series = useMemo(
    () =>
      withMovingAverages(
        rows.filter((row) => row.hasMeals || row.live).map((row) => ({ date: row.date, value: row.net })),
      ),
    [rows],
  );
  const visible = useMemo(() => sliceTrendRange(series, range, today), [series, range, today]);
  const visibleRows = useMemo(() => {
    const from = visible[0]?.date ?? addDaysISO(today, -13);
    return [...rows.filter((row) => row.date >= from && row.date <= today)].reverse();
  }, [rows, visible, today]);
  const last = visible[visible.length - 1];
  const ma7 = last?.ma7 ?? null;

  return (
    <>
      <SectionTitle>Journées</SectionTitle>
      <Card>
        <p className="text-[13px] leading-relaxed text-health-muted">
          Déficit = mangées − brûlées Santé. Touche un jour pour retoucher les repas.
        </p>
        <div className="mt-3">
          <RangeToggle value={range} onChange={setRange} />
        </div>
        <p className="mb-1 mt-3 text-[12px] text-health-muted">
          Quotidien · moyenne 7 j · moyenne 14 j
        </p>
        <TrendChart data={visible} color={color} unit="kcal" range={range} />
        {ma7 != null ? (
          <p className="mt-2 text-[13px]">
            Moy. 7 j{" "}
            <span className="font-semibold tabular-nums" style={{ color: energyBalanceLook(ma7, 0, goal).color }}>
              {formatSignedKcal(Math.round(ma7))} kcal
            </span>
            <span className="text-health-muted"> · mangées − brûlées</span>
          </p>
        ) : null}

        {visibleRows.length === 0 ? (
          <p className="mt-3 text-[13px] text-health-muted">Pas encore de journée à afficher.</p>
        ) : (
          <div className="mt-3 max-h-72 space-y-1 overflow-y-auto">
            {visibleRows.map((row) => {
              const look = energyBalanceLook(row.eaten.calories, row.burned, goal);
              return (
                <button
                  key={row.date}
                  type="button"
                  onClick={() => onOpenDay(row.date)}
                  className="flex w-full items-center justify-between gap-2 rounded-xl px-2 py-2 text-left active:bg-health-bg"
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold capitalize">{formatShortDate(row.date)}</p>
                    <p className="text-[11px] text-health-muted">
                      {row.hasMeals || row.live
                        ? `${kcal(row.eaten.calories)} mangées · ${kcal(row.burned)} brûlées${row.live ? "" : " · estimé"}`
                        : "Pas encore de repas"}
                    </p>
                  </div>
                  <p
                    className="shrink-0 text-[13px] font-semibold tabular-nums"
                    style={row.hasMeals || row.live ? { color: look.color } : undefined}
                  >
                    {row.hasMeals || row.live ? (
                      <>
                        {formatSignedKcal(look.net)}
                        <span className="ml-1 text-[11px] font-medium text-health-muted">{look.label}</span>
                      </>
                    ) : (
                      <span className="text-[11px] font-medium text-health-muted">Ouvrir</span>
                    )}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}
