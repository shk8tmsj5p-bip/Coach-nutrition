import { CatSticker } from "@/components/ui/CatSticker";
import { CAT_FEEL_LABELS, type CatFeelMood } from "@/lib/cat-feel";

const FILL: Record<CatFeelMood, number> = { ok: 0.28, bof: 0.58, creve: 1 };
const COLOR: Record<CatFeelMood, string> = {
  ok: "#34C759",
  bof: "#FF9F0A",
  creve: "#FF6B4A",
};

export function ScoreGauge({
  label,
  mood,
}: {
  label: string;
  mood: CatFeelMood;
}) {
  const size = 76;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - FILL[mood]);
  const color = COLOR[mood];

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
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ color }}>
          <CatSticker mood={mood} className="h-6 w-7" />
          <span className="mt-0.5 text-[10px] font-semibold leading-none">
            {CAT_FEEL_LABELS[mood]}
          </span>
        </div>
      </div>
      <p className="mt-1.5 text-[12px] font-semibold">{label}</p>
    </div>
  );
}
