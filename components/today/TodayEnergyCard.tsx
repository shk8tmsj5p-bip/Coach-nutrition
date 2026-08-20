import { burnedKcalFromHealth } from "@/lib/health-energy";
import { macroStatus, TONE_COLOR } from "@/lib/macro-status";
import type { Macros, PrimaryGoal, Profile } from "@/lib/types";
import { CoachDiffTags } from "@/components/today/CoachDelta";
import { MacrosGrid } from "@/components/ui/MacroProgress";

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

export function TodayEnergyCard({
  current,
  targets,
  goal,
  accent,
  movement,
  profile,
  coachTags,
}: {
  current: Macros;
  targets: Macros;
  goal: PrimaryGoal;
  accent: Profile["accent"];
  movement: { activeEnergyKcal: number; restingEnergyKcal: number };
  profile: Profile;
  coachTags?: string[];
}) {
  const eaten = current.calories;
  const plan = macroStatus("calories", eaten, targets.calories, goal);
  const fillColor = accent === "coral" ? "#FF6B4A" : "#6B7CFF";
  const { burned, live } = burnedKcalFromHealth(movement, {
    bmr: profile.bmr,
    tdee: profile.tdee,
  });
  const delta = burned - eaten;
  const surplus = delta < 0;
  const amount = Math.abs(delta);
  const balanceStatus =
    Math.abs(delta) <= Math.max(80, burned * 0.05)
      ? "Équilibre"
      : surplus
        ? `Surplus +${kcal(amount)}`
        : `Déficit −${kcal(amount)}`;

  return (
    <>
      <div className="space-y-4">
        <EatenBar
          title="Vs le plan"
          eaten={eaten}
          mark={targets.calories}
          markName="Cible"
          fillColor={fillColor}
          goal={goal}
          status={plan.label}
        />
        <EatenBar
          title="Vs le réel"
          eaten={eaten}
          mark={burned}
          markName="Brûlées"
          fillColor={fillColor}
          goal={goal}
          status={balanceStatus}
          extra={live ? undefined : "lance le raccourci Santé"}
        />
      </div>
      <MacrosGrid current={current} target={targets} goal={goal} />
      {coachTags && coachTags.length > 0 ? <CoachDiffTags tags={coachTags} /> : null}
    </>
  );
}
