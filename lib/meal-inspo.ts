import { silentAversions, type HeatStyle, type KitchenPrefs } from "@/lib/kitchen-prefs";
import { normalizeTitle } from "@/lib/recipe-diversity";
import type { Season, WeatherKind } from "@/lib/season";
import type { Profile } from "@/lib/types";

export type MealInspo = {
  theme: string;
  seasons: Season[] | "all";
  weather?: WeatherKind[];
  heat?: HeatStyle[];
  /** Mots à croiser avec les aversions (même si absents du thème). */
  ban?: string[];
  stock?: string[];
  trendy?: boolean;
};

/**
 * Thèmes que Gem Chef peut vraiment star-iser.
 * Pas de coriandre / piment / chou-fleur / fenouil / mangue / pastèque / seitan / tempeh / cacahuète.
 */
export const MEAL_INSPO_POOL: MealInspo[] = [
  { theme: "Tomate", seasons: ["summer", "autumn"], stock: ["tomate"], trendy: true },
  { theme: "Ratatouille", seasons: ["summer"], stock: ["courgette", "aubergine", "poivron"] },
  { theme: "Niçoise", seasons: ["spring", "summer"], weather: ["heat", "clear"] },
  { theme: "Gazpacho", seasons: ["summer"], weather: ["heat"], stock: ["tomate"] },
  { theme: "Maïs grillé", seasons: ["summer"], trendy: true, stock: ["mais", "maïs"] },
  { theme: "Courgette", seasons: ["summer"], stock: ["courgette"] },
  { theme: "Aubergine miso", seasons: ["summer", "autumn"], stock: ["aubergine", "miso"], trendy: true },
  { theme: "Poivron romesco", seasons: ["summer", "autumn"], stock: ["poivron", "amande"] },
  { theme: "Bo bun", seasons: ["summer"], weather: ["heat", "clear"], trendy: true },
  { theme: "Bowl satay sésame", seasons: "all", weather: ["heat", "clear"], heat: ["complexe"], stock: ["tofu", "sésame", "sesame"], trendy: true },
  { theme: "Concombre croquant", seasons: ["spring", "summer"], weather: ["heat"], stock: ["concombre"] },
  { theme: "Orzo pesto", seasons: ["spring", "summer"], heat: ["doux", "complexe"], stock: ["basilic"] },
  { theme: "Coréen", seasons: "all", heat: ["complexe"], trendy: true },
  { theme: "Yassa citron", seasons: ["spring", "summer", "autumn"], heat: ["complexe"] },
  { theme: "Chermoula", seasons: ["spring", "summer", "autumn"], heat: ["complexe"] },
  { theme: "Riz croustillant", seasons: "all", trendy: true, stock: ["riz"] },
  { theme: "Tofu smash", seasons: "all", trendy: true, stock: ["tofu"] },
  { theme: "Tacos cumin-citron", seasons: ["summer", "autumn"], trendy: true, ban: ["coriandre", "coriander"] },
  { theme: "Bowl miso", seasons: ["autumn", "winter"], weather: ["rain", "snow", "cloud"], stock: ["miso", "tofu"] },
  { theme: "Japchae", seasons: "all", heat: ["complexe"] },
  { theme: "Vermicelles nuoc", seasons: ["summer"], weather: ["heat"], heat: ["complexe"] },
  { theme: "Teriyaki gingembre", seasons: "all", heat: ["complexe"], stock: ["gingembre"] },
  { theme: "Risotto citron", seasons: ["autumn", "winter"], weather: ["rain", "snow"], heat: ["doux"] },
  { theme: "Velouté", seasons: ["autumn", "winter"], weather: ["rain", "snow", "fog"] },
  { theme: "Champignon", seasons: ["autumn", "winter"], stock: ["champignon"] },
  { theme: "Butternut", seasons: ["autumn", "winter"], stock: ["butternut", "courge"] },
  { theme: "Poireau", seasons: ["autumn", "winter", "spring"], stock: ["poireau"] },
  { theme: "Petit pois menthe", seasons: ["spring"], stock: ["petit pois", "pois"] },
  { theme: "Asperge", seasons: ["spring"], stock: ["asperge"] },
  { theme: "Artichaut", seasons: ["spring"] },
  { theme: "Lentilles du Puy", seasons: ["autumn", "winter"], stock: ["lentille"] },
  { theme: "Pasta e ceci", seasons: ["autumn", "winter"], stock: ["pois chiche"] },
  { theme: "Mezze tahini", seasons: ["spring", "summer"], heat: ["doux", "complexe"], stock: ["pois chiche", "tahini"] },
  { theme: "Bowl", seasons: "all", weather: ["heat", "clear"], trendy: true },
  { theme: "Italien", seasons: "all" },
  { theme: "Asiatique", seasons: "all", heat: ["complexe"] },
  { theme: "Provençal", seasons: ["spring", "summer"] },
  { theme: "Zaalouk", seasons: ["summer", "autumn"], stock: ["aubergine"] },
  { theme: "Edamame sésame", seasons: "all", stock: ["edamame"], trendy: true },
  { theme: "Patate douce airfryer", seasons: ["autumn", "winter"], stock: ["patate douce"] },
];

function hitsBan(blob: string, aversions: string[]) {
  return aversions.some((item) => {
    const needle = normalizeTitle(item);
    if (needle.length >= 3 && blob.includes(needle)) return true;
    return needle
      .split(" ")
      .filter((part) => part.length >= 4)
      .some((part) => blob.includes(part));
  });
}

function stockHit(tags: string[] | undefined, stockNames: string[]) {
  if (!tags?.length || stockNames.length === 0) return false;
  return tags.some((tag) => stockNames.some((name) => name.includes(normalizeTitle(tag)) || normalizeTitle(tag).includes(name)));
}

function scoreInspo(
  item: MealInspo,
  opts: {
    season: Season;
    weather: WeatherKind;
    heat: HeatStyle;
    stockNames: string[];
    weatherAdaptive: boolean;
  },
) {
  let score = item.trendy ? 2 : 0;
  if (item.seasons === "all") score += 1;
  else if (item.seasons.includes(opts.season)) score += 4;
  else return -1;
  if (opts.weatherAdaptive && item.weather?.includes(opts.weather)) score += 3;
  if (item.heat?.includes(opts.heat)) score += 2;
  if (stockHit(item.stock, opts.stockNames)) score += 3;
  return score;
}

export function pickMealInspirations(opts: {
  weekStart: string;
  season: Season;
  weather: WeatherKind;
  prefs: KitchenPrefs;
  profiles: Pick<Profile, "aversions">[];
  avoid: string[];
  stockNames: string[];
  offset?: number;
  count?: number;
}) {
  const count = opts.count ?? 6;
  const aversions = silentAversions(opts.prefs, opts.profiles).map(normalizeTitle);
  const avoid = opts.avoid.map(normalizeTitle).filter(Boolean);
  const stockNames = opts.stockNames.map(normalizeTitle).filter(Boolean);
  const ranked = MEAL_INSPO_POOL.map((item) => {
    const blob = normalizeTitle([item.theme, ...(item.ban ?? []), ...(item.stock ?? [])].join(" "));
    if (hitsBan(blob, aversions)) return null;
    if (avoid.some((needle) => needle.length >= 3 && blob.includes(needle))) return null;
    const score = scoreInspo(item, {
      season: opts.season,
      weather: opts.weather,
      heat: opts.prefs.heatStyle,
      stockNames,
      weatherAdaptive: opts.prefs.weatherAdaptive,
    });
    if (score < 0) return null;
    return { theme: item.theme, score };
  }).filter((row): row is { theme: string; score: number } => Boolean(row));

  ranked.sort((a, b) => b.score - a.score || a.theme.localeCompare(b.theme, "fr"));
  const unique: string[] = [];
  for (const row of ranked) {
    if (!unique.includes(row.theme)) unique.push(row.theme);
  }
  if (unique.length === 0) return ["Tomate", "Bowl", "Italien", "Asiatique"].slice(0, count);

  let seed = 0;
  for (const char of `${opts.weekStart}:${opts.offset ?? 0}`) {
    seed = (seed * 33 + char.charCodeAt(0)) >>> 0;
  }
  const start = unique.length ? seed % unique.length : 0;
  const rotated = [...unique.slice(start), ...unique.slice(0, start)];
  return rotated.slice(0, Math.min(count, rotated.length));
}
