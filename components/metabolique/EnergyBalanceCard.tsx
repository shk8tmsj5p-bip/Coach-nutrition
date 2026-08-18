import { Card } from "@/components/ui/Card";
import type { PrimaryGoal, Profile } from "@/lib/types";

const BAR_MAX_PX = 112;

function kcal(value: number) {
  return Math.round(value).toLocaleString("fr-FR");
}

function balanceTone(delta: number, goal: PrimaryGoal): { color: string; label: string } {
  const surplus = delta < 0;
  const amount = Math.abs(delta);
  if (goal === "prise") {
    if (surplus) return { color: "#34C759", label: "Surplus" };
    if (amount < 80) return { color: "#34C759", label: "Équilibre" };
    return { color: "#FF3B30", label: "Déficit" };
  }
  if (goal === "maintien") {
    if (amount <= 80) return { color: "#34C759", label: "Équilibre" };
    return { color: "#FF9F0A", label: surplus ? "Surplus" : "Déficit" };
  }
  if (surplus) return { color: "#FF3B30", label: "Surplus" };
  return { color: "#34C759", label: "Déficit" };
}

export function EnergyBalanceCard({ profile }: { profile: Profile }) {
  const eaten = profile.targets.calories;
  const burned = profile.tdee;
  const delta = burned - eaten;
  const tone = balanceTone(delta, profile.primaryGoal);
  const scale = Math.max(eaten, burned, Math.abs(delta), 1);
  const eatenColor = profile.accent === "coral" ? "#FF6B4A" : "#6B7CFF";
  const bars = [
    { label: "Mangées", value: eaten, color: eatenColor, display: kcal(eaten) },
    { label: "Brûlées", value: burned, color: "#5AC8FA", display: kcal(burned) },
    {
      label: tone.label,
      value: Math.abs(delta),
      color: tone.color,
      display: `${delta >= 0 ? "−" : "+"}${kcal(Math.abs(delta))}`,
    },
  ];

  const caption =
    delta > 80
      ? `Tu brûles ${kcal(delta)} kcal de plus que tu ne manges.`
      : delta < -80
        ? `Tu manges ${kcal(Math.abs(delta))} kcal de plus que tu ne brûles.`
        : "Mangées et brûlées sont alignées.";

  return (
    <Card>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-health-muted">
        Énergie du jour
      </p>
      <div className="mt-3 flex items-end justify-around gap-2">
        {bars.map((bar) => {
          const height = Math.max(8, Math.round((bar.value / scale) * BAR_MAX_PX));
          return (
            <div key={bar.label} className="flex min-w-0 flex-1 flex-col items-center">
              <p className="text-[16px] font-bold tabular-nums leading-none" style={{ color: bar.color }}>
                {bar.display}
              </p>
              <p className="mt-0.5 text-[10px] text-health-muted">kcal</p>
              <div className="mt-2 flex h-[112px] w-full items-end justify-center">
                <div
                  className="w-11 rounded-t-[10px] transition-all"
                  style={{ height, background: bar.color }}
                />
              </div>
              <p className="mt-2 text-[12px] font-semibold">{bar.label}</p>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-center text-[12px] leading-snug text-health-muted">{caption}</p>
      <p className="mt-1 text-center text-[11px] text-health-muted">
        Cible P {profile.targets.protein}g · G {profile.targets.carbs}g · L {profile.targets.fat}g
      </p>
    </Card>
  );
}
