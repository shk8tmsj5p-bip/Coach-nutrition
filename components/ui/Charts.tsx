"use client";

export function Sparkline({
  values,
  color,
  height = 64,
}: {
  values: number[];
  color: string;
  height?: number;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 320;
  const pad = 4;
  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (v - min) / span) * (height - pad * 2);
    return `${x},${y}`;
  });
  const last = values[values.length - 1];
  const lastX = pad + ((values.length - 1) / (values.length - 1)) * (w - pad * 2);
  const lastY = pad + (1 - (last - min) / span) * (height - pad * 2);

  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="h-16 w-full" preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points.join(" ")}
      />
      <circle cx={lastX} cy={lastY} r="4" fill={color} />
    </svg>
  );
}

export function BarChart({
  values,
  labels,
  color,
}: {
  values: number[];
  labels: string[];
  color: string;
}) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex h-28 items-end gap-1.5">
      {values.map((v, i) => (
        <div key={labels[i] ?? i} className="flex flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-t-md"
            style={{
              height: `${Math.max(8, (v / max) * 100)}%`,
              background: color,
              opacity: 0.55 + (v / max) * 0.45,
            }}
          />
          <span className="text-[9px] text-health-muted">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}
