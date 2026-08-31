import { NextResponse } from "next/server";
import {
  applyHeat,
  currentSeason,
  emptyWeatherNow,
  ESCHENTZWILLER_LAT,
  ESCHENTZWILLER_LON,
  weatherKindFromCode,
  weatherLabel,
  type WeatherDay,
  type WeatherNow,
} from "@/lib/season";

export const maxDuration = 15;

type WeatherPayload = WeatherNow & {
  season: ReturnType<typeof currentSeason>;
  forecast: WeatherDay[];
};

let cache: { at: number; body: WeatherPayload } | null = null;
const TTL_MS = 20 * 60 * 1000;
const FORECAST_DAYS = 7;

function fallback(): WeatherPayload {
  return { ...emptyWeatherNow(), season: currentSeason(), forecast: [] };
}

function num(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function firstDaily(value: unknown): number | null {
  if (Array.isArray(value)) return num(value[0]);
  return num(value);
}

function dailyForecast(daily: {
  time?: string[];
  weather_code?: number[];
  temperature_2m_max?: number[];
  temperature_2m_min?: number[];
}): WeatherDay[] {
  const dates = daily.time ?? [];
  return dates.slice(0, FORECAST_DAYS).map((date, index) => {
    const code = num(daily.weather_code?.[index]);
    const maxC = num(daily.temperature_2m_max?.[index]);
    const minC = num(daily.temperature_2m_min?.[index]);
    const sky = code != null ? applyHeat(weatherKindFromCode(code), maxC) : "unknown";
    return { date, code, sky, minC, maxC };
  });
}

export async function GET() {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json(cache.body);
  }
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(ESCHENTZWILLER_LAT));
  url.searchParams.set("longitude", String(ESCHENTZWILLER_LON));
  url.searchParams.set("current", "weather_code,temperature_2m");
  url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min");
  url.searchParams.set("forecast_days", String(FORECAST_DAYS));
  url.searchParams.set("timezone", "Europe/Paris");
  try {
    const res = await fetch(url, { next: { revalidate: 1200 } });
    if (!res.ok) return NextResponse.json(fallback());
    const json = (await res.json()) as {
      current?: { weather_code?: number; temperature_2m?: number };
      daily?: {
        time?: string[];
        weather_code?: number[];
        temperature_2m_max?: number[];
        temperature_2m_min?: number[];
      };
    };
    const code = num(json.current?.weather_code);
    const tempC = num(json.current?.temperature_2m);
    const minC = firstDaily(json.daily?.temperature_2m_min);
    const maxC = firstDaily(json.daily?.temperature_2m_max);
    const sky = code != null ? weatherKindFromCode(code) : "unknown";
    const kind = applyHeat(sky, tempC);
    const body: WeatherPayload = {
      kind,
      sky,
      label: weatherLabel(sky, code),
      tempC,
      minC,
      maxC,
      code,
      season: currentSeason(),
      forecast: dailyForecast(json.daily ?? {}),
    };
    cache = { at: Date.now(), body };
    return NextResponse.json(body);
  } catch {
    return NextResponse.json(fallback());
  }
}
