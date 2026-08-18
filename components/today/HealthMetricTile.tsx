export function HealthMetricTile({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-health-bg px-3 py-2.5">
      <p className="text-[11px] text-health-muted">{label}</p>
      <p className="mt-0.5 text-[17px] font-bold tabular-nums leading-tight">{value}</p>
    </div>
  );
}
