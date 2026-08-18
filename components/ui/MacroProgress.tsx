import { macroStatus } from "@/lib/macro-status";
import type { Macros, PrimaryGoal } from "@/lib/types";
import { cn, percentOf } from "@/lib/utils";

export function MacroBar({
  label,
  current,
  target,
  unit,
  kind,
  goal,
}: {
  label: string;
  current: number;
  target: number;
  unit: string;
  kind: "protein" | "carbs" | "fat";
  goal: PrimaryGoal;
}) {
  const pct = percentOf(current, target);
  const status = macroStatus(kind, current, target, goal);
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-[13px]">
        <span className="font-medium text-health-ink">{label}</span>
        <span className="tabular-nums" style={{ color: status.color }}>
          {Math.round(current)}
          <span className="text-health-muted/70">
            /{target}
            {unit}
          </span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-health-bg">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: status.color }}
        />
      </div>
    </div>
  );
}

export function MacroRing({
  current,
  target,
  goal,
}: {
  current: number;
  target: number;
  goal: PrimaryGoal;
}) {
  const size = 128;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(1, current / Math.max(target, 1));
  const offset = circ * (1 - pct);
  const remaining = Math.round(target - current);
  const status = macroStatus("calories", current, target, goal);

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgb(var(--c-track))"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={status.color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-[28px] font-semibold leading-none tabular-nums tracking-tight"
            style={{ color: status.color }}
          >
            {Math.round(current)}
          </span>
          <span className="mt-0.5 text-[11px] text-health-muted">kcal</span>
        </div>
      </div>
      <p className="mt-2 text-center text-[12px] text-health-muted">
        {status.label}
        {remaining > 0 ? (
          <>
            {" "}
            · <span className="tabular-nums">{remaining} rest.</span>
          </>
        ) : remaining === 0 ? (
          <span style={{ color: status.color }}> · objectif</span>
        ) : (
          <span className="tabular-nums" style={{ color: status.color }}>
            {" "}
            · +{Math.abs(remaining)}
          </span>
        )}
      </p>
    </div>
  );
}

export function MacrosGrid({
  current,
  target,
  goal,
}: {
  current: Macros;
  target: Macros;
  goal: PrimaryGoal;
}) {
  return (
    <div className="mt-4 grid gap-3">
      <MacroBar
        label="Glucides"
        current={current.carbs}
        target={target.carbs}
        unit="g"
        kind="carbs"
        goal={goal}
      />
      <MacroBar
        label="Protéines"
        current={current.protein}
        target={target.protein}
        unit="g"
        kind="protein"
        goal={goal}
      />
      <MacroBar
        label="Lipides"
        current={current.fat}
        target={target.fat}
        unit="g"
        kind="fat"
        goal={goal}
      />
    </div>
  );
}

export function GoalBadge({
  current,
  target,
  goal,
}: {
  current: number;
  target: number;
  goal: PrimaryGoal;
}) {
  const status = macroStatus("calories", current, target, goal);
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-[11px] font-semibold",
        status.tone === "good" && "bg-emerald-50 text-emerald-700",
        status.tone === "bad" && "bg-red-50 text-red-600",
        status.tone === "warn" && "bg-amber-50 text-amber-700",
        status.tone === "neutral" && "bg-health-bg text-health-muted",
      )}
    >
      {status.label || "En cours"}
    </span>
  );
}
