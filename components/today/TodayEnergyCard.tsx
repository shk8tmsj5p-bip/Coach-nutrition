"use client";

import { useState } from "react";
import { burnedKcalFromHealth } from "@/lib/health-energy";
import { macroStatus, TONE_COLOR } from "@/lib/macro-status";
import type { Macros, PrimaryGoal, Profile } from "@/lib/types";
import { CoachDiffTags } from "@/components/today/CoachDelta";
import { CompactMacrosRow } from "@/components/ui/MacroProgress";
import { energyBalanceLook, formatSignedKcal } from "@/lib/energy-balance";
import { openBottomArc } from "@/lib/open-bottom-arc";

function kcal(value: number) {
  return Math.round(value).toLocaleString("fr-FR");
}

function overflowColor(goal: PrimaryGoal) {
  return goal === "prise" ? TONE_COLOR.good : TONE_COLOR.bad;
}

function EatenBar({
  title,
  eaten,
  mark,
  markName,
  fillColor,
  goal,
  status,
  extra,
}: {
  title: string;
  eaten: number;
  mark: number;
  markName: string;
  fillColor: string;
  goal: PrimaryGoal;
  status: string;
  extra?: string;
}) {
  const scale = Math.max(eaten, mark, 1);
  const okPct = (Math.min(eaten, mark) / scale) * 100;
  const overPct = (Math.max(0, eaten - mark) / scale) * 100;
  const markPct = (mark / scale) * 100;
  const over = overflowColor(goal);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-health-muted">{title}</p>
        <p className="text-[11px] font-semibold" style={{ color: eaten > mark * 1.05 ? over : fillColor }}>
          {status}
        </p>
      </div>

      <div className="mt-1.5 flex items-end justify-between gap-2">
        <div>
          <p className="text-[10px] text-health-muted">Mangées</p>
          <p className="text-[18px] font-bold tabular-nums leading-none" style={{ color: fillColor }}>
            {kcal(eaten)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-health-muted">{markName}</p>
          <p className="text-[18px] font-bold tabular-nums leading-none text-health-muted">{kcal(mark)}</p>
        </div>
      </div>

      <div className="relative mt-2">
        <div className="relative h-2.5 overflow-hidden rounded-full bg-health-bg">
          <div
            className="absolute inset-y-0 left-0 h-2.5 rounded-full"
            style={{ width: `${okPct}%`, background: fillColor }}
          />
          {overPct > 0 ? (
            <div
              className="absolute inset-y-0 h-2.5"
              style={{ left: `${markPct}%`, width: `${overPct}%`, background: over }}
            />
          ) : null}
        </div>
        <div
          className="pointer-events-none absolute top-[-3px] h-4 w-0.5 rounded-full bg-health-ink"
          style={{ left: `calc(${markPct}% - 1px)` }}
          aria-hidden
        />
      </div>
      <p className="mt-1 text-[10px] text-health-muted">
        Barre = mangées · trait = {markName.toLowerCase()}
        {extra ? ` · ${extra}` : ""}
      </p>
    </div>
  );
}

function SideStat({
  value,
  label,
  color,
  align,
}: {
  value: number;
  label: string;
  color?: string;
  align: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "w-[4.75rem] shrink-0 text-right" : "w-[4.75rem] shrink-0"}>
      <p
        className="text-[22px] font-bold tabular-nums leading-none tracking-tight"
        style={color ? { color } : undefined}
      >
        {kcal(value)}
      </p>
      <p className="mt-1 text-[11px] text-health-muted">{label}</p>
    </div>
  );
}

function ProgressArc({
  eaten,
  target,
  fillColor,
  centerValue,
  centerLabel,
  centerColor,
}: {
  eaten: number;
  target: number;
  fillColor: string;
  centerValue: string;
  centerLabel: string;
  centerColor: string;
}) {
  const size = 168;
  const stroke = 10;
  const { d: arc, cropH } = openBottomArc(size, stroke);
  const pct = target > 0 ? Math.min(100, Math.round((eaten / target) * 100)) : 0;

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center">
      <div className="relative overflow-hidden" style={{ width: size, height: cropH }}>
        <svg width={size} height={size} aria-hidden>
          <path
            d={arc}
            fill="none"
            stroke="rgb(var(--c-track))"
            strokeWidth={stroke}
            strokeLinecap="round"
          />
          <path
            d={arc}
            fill="none"
            stroke={fillColor}
            strokeWidth={stroke}
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${pct} 100`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 pb-1 pt-3 text-center">
          <p className="text-[28px] font-bold tabular-nums leading-none tracking-tight" style={{ color: centerColor }}>
            {centerValue}
          </p>
          <p className="mt-0.5 text-[12px] leading-tight text-health-muted">{centerLabel}</p>
        </div>
      </div>
    </div>
  );
}

export function TodayEnergyCard({
  current,
  targets,
  goal,
  movement,
  profile,
  coachTags,
}: {
  current: Macros;
  targets: Macros;
  goal: PrimaryGoal;
  movement: { activeEnergyKcal: number; restingEnergyKcal: number };
  profile: Profile;
  coachTags?: string[];
}) {
  const [details, setDetails] = useState(false);
  const eaten = current.calories;
  const plan = macroStatus("calories", eaten, targets.calories, goal);
  const { burned, live } = burnedKcalFromHealth(movement, {
    bmr: profile.bmr,
    tdee: profile.tdee,
  });
  const delta = burned - eaten;
  const surplus = delta < 0;
  const amount = Math.abs(delta);
  const balance = energyBalanceLook(eaten, burned, goal);
  const balanceStatus =
    Math.abs(delta) <= Math.max(80, burned * 0.05)
      ? "Équilibre"
      : surplus
        ? `Surplus +${kcal(amount)}`
        : `Déficit −${kcal(amount)}`;

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-health-muted">Résumé</p>
        <button
          type="button"
          onClick={() => setDetails((open) => !open)}
          className="text-[13px] font-semibold text-health-ink"
        >
          {details ? "Masquer" : "Détails"}
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between gap-1">
        <SideStat value={eaten} label="Mangées" color={plan.color} align="left" />
        <ProgressArc
          eaten={eaten}
          target={targets.calories}
          fillColor={plan.color}
          centerValue={formatSignedKcal(balance.net)}
          centerLabel={balance.label}
          centerColor={balance.color}
        />
        <SideStat value={burned} label="Brûlées" align="right" />
      </div>

      <CompactMacrosRow current={current} target={targets} goal={goal} />

      {details ? (
        <div className="mt-4 space-y-4 border-t border-health-line pt-4">
          <EatenBar
            title="Vs le plan"
            eaten={eaten}
            mark={targets.calories}
            markName="Plan"
            fillColor={plan.color}
            goal={goal}
            status={plan.label}
          />
          <EatenBar
            title="Vs Santé"
            eaten={eaten}
            mark={burned}
            markName="Brûlées"
            fillColor={plan.color}
            goal={goal}
            status={balanceStatus}
            extra={live ? undefined : "lance le raccourci Santé"}
          />
        </div>
      ) : null}

      {coachTags && coachTags.length > 0 ? <CoachDiffTags tags={coachTags} /> : null}
    </>
  );
}
