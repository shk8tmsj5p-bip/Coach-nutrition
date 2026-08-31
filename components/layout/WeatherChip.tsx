"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Sun, X } from "lucide-react";
import { useSeasonWeather } from "@/context/SeasonContext";
import { todayISO } from "@/lib/dates";
import {
  formatForecastWeekday,
  formatTempC,
  weatherLabel,
  type WeatherDay,
  type WeatherKind,
} from "@/lib/season";

export function WeatherGlyph({
  sky,
  code,
  size = 17,
}: {
  sky: WeatherKind;
  code: number | null;
  size?: number;
}) {
  const props = { size, strokeWidth: 2, className: "shrink-0 text-health-ink" } as const;
  if (code != null && code >= 95) return <CloudLightning {...props} />;
  if (sky === "rain") return <CloudRain {...props} />;
  if (sky === "snow") return <CloudSnow {...props} />;
  if (sky === "fog") return <CloudFog {...props} />;
  if (sky === "clear" || sky === "heat") return <Sun {...props} />;
  if (code === 1 || code === 2) return <CloudSun {...props} />;
  return <Cloud {...props} />;
}

export function WeatherChip() {
  const { sky, label, tempC, minC, maxC, code, forecast } = useSeasonWeather();
  const [open, setOpen] = useState(false);
  const current = formatTempC(tempC);
  const min = formatTempC(minC);
  const max = formatTempC(maxC);
  if (!current && !min && !max) return null;

  const range = min && max ? `${min} / ${max}` : min || max;
  const spoken = ["Eschentzwiller", label, current && `${Math.round(tempC ?? 0)} degrés`, range && `min max ${range}`]
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-health-card py-1 pl-2 pr-2.5 shadow-card"
        aria-label={`${spoken}. Ouvrir les prévisions.`}
        title="Prévisions Eschentzwiller"
      >
        <WeatherGlyph sky={sky} code={code} />
        <div className="min-w-0 leading-none text-left">
          {current ? <p className="text-[15px] font-semibold tabular-nums">{current}</p> : null}
          {range ? <p className="mt-0.5 text-[10px] tabular-nums text-health-muted">{range}</p> : null}
        </div>
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <WeatherForecastSheet forecast={forecast} onClose={() => setOpen(false)} />,
            document.body,
          )
        : null}
    </>
  );
}

function WeatherForecastSheet({
  forecast,
  onClose,
}: {
  forecast: WeatherDay[];
  onClose: () => void;
}) {
  const today = todayISO();
  const days = forecast.filter((day) => day.date >= today).slice(0, 7);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40"
      onClick={onClose}
      onPointerDown={(event) => event.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="weather-forecast-title"
    >
      <div
        className="max-h-[calc(100dvh-var(--safe-top)-24px)] w-full max-w-[430px] overflow-y-auto rounded-t-[24px] bg-white p-4 pb-8 shadow-card"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h3 id="weather-forecast-title" className="text-[17px] font-semibold">
            Eschentzwiller
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-health-bg"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>
        <p className="mb-4 text-[12px] text-health-muted">Les 7 prochains jours</p>
        {days.length === 0 ? (
          <p className="text-[13px] text-health-muted">Prévisions indisponibles pour le moment.</p>
        ) : (
          <ul className="divide-y divide-health-line">
            {days.map((day) => {
              const min = formatTempC(day.minC);
              const max = formatTempC(day.maxC);
              const spoken = [
                formatForecastWeekday(day.date, today),
                weatherLabel(day.sky, day.code),
                min && max ? `${min} à ${max}` : min || max,
              ]
                .filter(Boolean)
                .join(", ");
              return (
                <li key={day.date} className="flex items-center gap-3 py-2.5" aria-label={spoken}>
                  <p className="w-[7.5rem] shrink-0 text-[14px] font-medium">
                    {formatForecastWeekday(day.date, today)}
                  </p>
                  <WeatherGlyph sky={day.sky} code={day.code} size={20} />
                  <p className="ml-auto text-[14px] tabular-nums text-health-muted">
                    {min && max ? `${min} / ${max}` : min || max || "—"}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
