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
          <span className="mt-0.5 text-[11px] text-health-muted">kcal mangées</span>
        </div>
      </div>
      <p className="mt-2 text-center text-[12px] font-medium" style={{ color: status.color }}>
        {status.label || "En cours"}
      </p>
    </div>
  );
}

export function CompactMacrosRow({
  current,
  target,
  goal,
}: {
  current: Macros;
  target: Macros;
  goal: PrimaryGoal;
}) {
  const rows: Array<{ label: string; kind: "carbs" | "protein" | "fat"; value: number; mark: number }> = [
    { label: "Glucides", kind: "carbs", value: current.carbs, mark: target.carbs },
    { label: "Protéines", kind: "protein", value: current.protein, mark: target.protein },
    { label: "Lipides", kind: "fat", value: current.fat, mark: target.fat },
  ];
  return (
    <div className="mt-4 grid grid-cols-3 gap-3">
      {rows.map((row) => {
        const pct = percentOf(row.value, row.mark);
        const status = macroStatus(row.kind, row.value, row.mark, goal);
        return (
          <div key={row.kind}>
            <p className="text-[11px] font-medium text-health-muted">{row.label}</p>
            <p className="mt-0.5 text-[15px] font-semibold tabular-nums leading-none" style={{ color: status.color }}>
              {Math.round(row.value)}
              <span className="text-[11px] font-normal text-health-muted">/{Math.round(row.mark)}g</span>
            </p>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-health-bg">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: status.color }} />
            </div>
          </div>
        );
      })}
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
    <div className="mt-3 grid gap-3">
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
