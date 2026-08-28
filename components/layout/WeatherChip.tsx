"use client";

import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Sun } from "lucide-react";
import { useSeasonWeather } from "@/context/SeasonContext";
import { formatTempC, type WeatherKind } from "@/lib/season";

function WeatherGlyph({ sky, code }: { sky: WeatherKind; code: number | null }) {
  const props = { size: 17, strokeWidth: 2, className: "shrink-0 text-health-ink" } as const;
  if (code != null && code >= 95) return <CloudLightning {...props} />;
  if (sky === "rain") return <CloudRain {...props} />;
  if (sky === "snow") return <CloudSnow {...props} />;
  if (sky === "fog") return <CloudFog {...props} />;
  if (sky === "clear" || sky === "heat") return <Sun {...props} />;
  if (code === 1 || code === 2) return <CloudSun {...props} />;
  return <Cloud {...props} />;
}

export function WeatherChip() {
  const { sky, label, tempC, minC, maxC, code } = useSeasonWeather();
  const current = formatTempC(tempC);
  const min = formatTempC(minC);
  const max = formatTempC(maxC);
  if (!current && !min && !max) return null;

  const range = min && max ? `${min} / ${max}` : min || max;
  const spoken = ["Eschentzwiller", label, current && `${Math.round(tempC ?? 0)} degrés`, range && `min max ${range}`]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      className="flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-health-card py-1 pl-2 pr-2.5 shadow-card"
      aria-label={spoken}
      title={spoken}
    >
      <WeatherGlyph sky={sky} code={code} />
      <div className="min-w-0 leading-none">
        {current ? <p className="text-[15px] font-semibold tabular-nums">{current}</p> : null}
        {range ? <p className="mt-0.5 text-[10px] tabular-nums text-health-muted">{range}</p> : null}
      </div>
    </div>
  );
}
