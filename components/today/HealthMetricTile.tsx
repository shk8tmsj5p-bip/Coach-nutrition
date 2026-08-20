export function HealthMetricTile({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="rounded-lg bg-health-bg px-2 py-1.5">
        <p className="text-[10px] leading-none text-health-muted">{label}</p>
        <p className="mt-0.5 text-[13px] font-semibold tabular-nums leading-tight">{value}</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl bg-health-bg px-3 py-2.5">
      <p className="text-[11px] text-health-muted">{label}</p>
      <p className="mt-0.5 text-[17px] font-bold tabular-nums leading-tight">{value}</p>
    </div>
  );
}
