"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  currentSeason,
  emptyWeatherNow,
  type Season,
  type WeatherDay,
  type WeatherKind,
  type WeatherNow,
} from "@/lib/season";

type SeasonWeather = WeatherNow & {
  season: Season;
  /** Same as `kind` — used by the chat du matin (canicule / pluie / neige). */
  weather: WeatherKind;
  forecast: WeatherDay[];
};

const SeasonWeatherContext = createContext<SeasonWeather>({
  season: currentSeason(),
  weather: "unknown",
  forecast: [],
  ...emptyWeatherNow(),
});

function asDays(value: unknown): WeatherDay[] {
  if (!Array.isArray(value)) return [];
  const days: WeatherDay[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    if (typeof rec.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(rec.date)) continue;
    const code = typeof rec.code === "number" ? rec.code : null;
    const minC = typeof rec.minC === "number" ? rec.minC : null;
    const maxC = typeof rec.maxC === "number" ? rec.maxC : null;
    const sky =
      rec.sky === "clear" ||
      rec.sky === "cloud" ||
      rec.sky === "rain" ||
      rec.sky === "snow" ||
      rec.sky === "heat" ||
      rec.sky === "fog"
        ? rec.sky
        : "unknown";
    days.push({ date: rec.date, code, sky, minC, maxC });
  }
  return days;
}

function asWeather(data: Partial<WeatherNow> | null | undefined): WeatherNow {
  const base = emptyWeatherNow();
  if (!data) return base;
  return {
    kind: data.kind ?? base.kind,
    sky: data.sky ?? data.kind ?? base.sky,
    label: typeof data.label === "string" ? data.label : base.label,
    tempC: typeof data.tempC === "number" ? data.tempC : null,
    minC: typeof data.minC === "number" ? data.minC : null,
    maxC: typeof data.maxC === "number" ? data.maxC : null,
    code: typeof data.code === "number" ? data.code : null,
  };
}

export function SeasonWeatherProvider({ children }: { children: ReactNode }) {
  const [season] = useState(() => currentSeason());
  const [now, setNow] = useState<WeatherNow>(emptyWeatherNow);
  const [forecast, setForecast] = useState<WeatherDay[]>([]);

  useEffect(() => {
    document.documentElement.dataset.season = season;
  }, [season]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/weather")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: (Partial<WeatherNow> & { forecast?: unknown }) | null) => {
        if (cancelled || !data) return;
        const next = asWeather(data);
        setNow(next);
        setForecast(asDays(data.forecast));
        if (next.kind !== "unknown") {
          document.documentElement.dataset.weather = next.kind;
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({ season, weather: now.kind, forecast, ...now }),
    [season, now, forecast],
  );
  return <SeasonWeatherContext.Provider value={value}>{children}</SeasonWeatherContext.Provider>;
}

export function useSeasonWeather() {
  return useContext(SeasonWeatherContext);
}
