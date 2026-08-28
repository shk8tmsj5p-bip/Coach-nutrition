"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { currentSeason, emptyWeatherNow, type Season, type WeatherKind, type WeatherNow } from "@/lib/season";

type SeasonWeather = WeatherNow & {
  season: Season;
  /** Same as `kind` — used by the chat du matin (canicule / pluie / neige). */
  weather: WeatherKind;
};

const SeasonWeatherContext = createContext<SeasonWeather>({
  season: currentSeason(),
  weather: "unknown",
  ...emptyWeatherNow(),
});

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

  useEffect(() => {
    document.documentElement.dataset.season = season;
  }, [season]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/weather")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Partial<WeatherNow> | null) => {
        if (cancelled || !data) return;
        const next = asWeather(data);
        setNow(next);
        if (next.kind !== "unknown") {
          document.documentElement.dataset.weather = next.kind;
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => ({ season, weather: now.kind, ...now }), [season, now]);
  return <SeasonWeatherContext.Provider value={value}>{children}</SeasonWeatherContext.Provider>;
}

export function useSeasonWeather() {
  return useContext(SeasonWeatherContext);
}
