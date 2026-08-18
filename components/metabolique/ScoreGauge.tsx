export function ScoreGauge({
  label,
  value,
  max = 5,
  invert = false,
}: {
  label: string;
  value: number;
  max?: number;
  invert?: boolean;
}) {
  const clamped = Math.max(0, Math.min(max, value));
  const pct = clamped / max;
  const color = invert
    ? pct >= 0.8
      ? "#FF6B4A"
      : pct >= 0.6
        ? "#FF9F0A"
        : "#34C759"
    : pct <= 0.4
      ? "#FF6B4A"
      : pct >= 0.6
        ? "#34C759"
        : "#FF9F0A";
  const size = 76;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);

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
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[20px] font-bold leading-none tabular-nums" style={{ color }}>
            {clamped}
          </span>
          <span className="text-[10px] text-health-muted">/{max}</span>
        </div>
      </div>
      <p className="mt-1.5 text-[12px] font-semibold">{label}</p>
    </div>
  );
}
