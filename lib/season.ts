import { todayISO } from "@/lib/dates";

export type Season = "spring" | "summer" | "autumn" | "winter";
export type WeatherKind = "clear" | "cloud" | "rain" | "snow" | "heat" | "fog" | "unknown";

/** Foyer — Eschentzwiller (Haut-Rhin). */
export const ESCHENTZWILLER_LAT = 47.7233;
export const ESCHENTZWILLER_LON = 7.4008;

export type WeatherNow = {
  kind: WeatherKind;
  sky: WeatherKind;
  label: string;
  tempC: number | null;
  minC: number | null;
  maxC: number | null;
  code: number | null;
};

export type WeatherDay = {
  date: string;
  code: number | null;
  sky: WeatherKind;
  minC: number | null;
  maxC: number | null;
};

export function emptyWeatherNow(): WeatherNow {
  return {
    kind: "unknown",
    sky: "unknown",
    label: "",
    tempC: null,
    minC: null,
    maxC: null,
    code: null,
  };
}

export function monthInParis(date = new Date()) {
  const month = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Paris", month: "numeric" }).format(date),
  );
  return Number.isFinite(month) ? month : date.getMonth() + 1;
}

/** Saisons météo France (équinoxes approximés par le mois). */
export function currentSeason(date = new Date()): Season {
  const month = monthInParis(date);
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

export function seasonFromIso(iso = todayISO()): Season {
  return currentSeason(new Date(`${iso}T12:00:00`));
}

/** WMO weather codes (Open-Meteo). Heat is applied by the caller from temperature. */
export function weatherKindFromCode(code: number): WeatherKind {
  if (code === 0) return "clear";
  if (code >= 1 && code <= 3) return "cloud";
  if (code === 45 || code === 48) return "fog";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95 && code <= 99)) {
    return "rain";
  }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  return "cloud";
}

export function applyHeat(kind: WeatherKind, tempC: number | null): WeatherKind {
  if (tempC != null && tempC >= 28 && kind !== "rain" && kind !== "snow") return "heat";
  return kind;
}

export function weatherLabelFromCode(code: number): string {
  if (code === 0) return "Soleil";
  if (code === 1) return "Clair";
  if (code === 2) return "Voilé";
  if (code === 3) return "Couvert";
  if (code === 45 || code === 48) return "Brume";
  if (code >= 51 && code <= 57) return "Bruine";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "Pluie";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "Neige";
  if (code >= 95 && code <= 99) return "Orage";
  return "Nuageux";
}

export function weatherLabel(kind: WeatherKind, code?: number | null) {
  if (code != null && Number.isFinite(code)) return weatherLabelFromCode(code);
  if (kind === "clear" || kind === "heat") return "Soleil";
  if (kind === "cloud") return "Nuageux";
  if (kind === "rain") return "Pluie";
  if (kind === "snow") return "Neige";
  if (kind === "fog") return "Brume";
  return "";
}

export function formatTempC(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return null;
  return `${Math.round(value)}°`;
}

export function formatForecastWeekday(iso: string, today = todayISO()) {
  if (iso === today) return "Aujourd’hui";
  const label = new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", {
    weekday: "short",
    timeZone: "Europe/Paris",
  });
  return label.replace(".", "").replace(/^./, (ch) => ch.toUpperCase());
}
