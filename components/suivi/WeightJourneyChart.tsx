import { progressPct } from "@/lib/goals";
import type { PrimaryGoal } from "@/lib/types";

function kgShort(value: number) {
  return value.toFixed(1).replace(".", ",");
}

function signedKg(value: number) {
  const abs = kgShort(Math.abs(value));
  if (value > 0.05) return `+${abs} kg`;
  if (value < -0.05) return `−${abs} kg`;
  return `${abs} kg`;
}

function shortDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
  });
}

const START_BLUE = "#5AC8FA";
const TARGET_GREEN = "#30D158";

export function WeightJourneyChart({
  start,
  current,
  target,
  goal,
  color,
  date,
  gradientId,
}: {
  start: number;
  current: number;
  target: number;
  goal: PrimaryGoal;
  color: string;
  date?: string;
  gradientId: string;
}) {
  const pct = progressPct(start, current, target, goal);
  const size = 176;
  const stroke = 10;
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - stroke) / 2 - 4;
  const toPt = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  const from = toPt(135);
  const to = toPt(45);
  const arc = `M ${from.x} ${from.y} A ${r} ${r} 0 1 1 ${to.x} ${to.y}`;
  const gid = `weight-arc-${gradientId}`;
  const cropH = Math.ceil(to.y + stroke * 0.75);

  const moved = goal === "maintien" ? current - target : current - start;
  const remainAbs = Math.abs(target - current);
  const remainLine =
    goal === "maintien"
      ? `Écart ${signedKg(current - target)}`
      : `Encore ${kgShort(remainAbs)} kg`;

  return (
    <div>
      <div className="relative mx-auto overflow-hidden" style={{ width: size, height: cropH }}>
        <svg width={size} height={size} aria-hidden>
          <defs>
            <linearGradient
              id={gid}
              gradientUnits="userSpaceOnUse"
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
            >
              <stop offset="0%" stopColor={START_BLUE} />
              <stop offset="100%" stopColor={TARGET_GREEN} />
            </linearGradient>
          </defs>
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
            stroke={`url(#${gid})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${pct} 100`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center px-8 pb-1 pt-3 text-center">
          {date && <p className="text-[11px] leading-none text-health-muted">{shortDate(date)}</p>}
          <p className="mt-1 text-[32px] font-bold tabular-nums tracking-tight leading-none">
            {kgShort(current)}
          </p>
          <p className="mt-0.5 text-[12px] leading-tight text-health-muted">kg · aujourd&apos;hui</p>
        </div>
      </div>

      <div className="mt-1 flex items-start justify-between px-1">
        <div>
          <p className="text-[11px] leading-none text-health-muted">Départ</p>
          <p className="mt-0.5 text-[13px] font-semibold tabular-nums leading-tight" style={{ color: START_BLUE }}>
            {kgShort(start)} kg
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] leading-none text-health-muted">Cible</p>
          <p className="mt-0.5 text-[13px] font-semibold tabular-nums leading-tight" style={{ color: TARGET_GREEN }}>
            {kgShort(target)} kg
          </p>
        </div>
      </div>

      <div className="mt-2.5 flex flex-col items-center gap-1">
        <span
          className="rounded-full px-3 py-0.5 text-[13px] font-semibold tabular-nums"
          style={{ background: `${color}22`, color }}
        >
          {signedKg(moved)}
        </span>
        <p className="text-[12px] leading-tight text-health-muted">
          {remainLine}
          <span> · </span>
          <span className="font-semibold text-health-ink">{pct}%</span> du chemin
        </p>
      </div>
    </div>
  );
}
