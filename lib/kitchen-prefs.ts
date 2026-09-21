import { storage } from "@/lib/storage";
import type { Profile } from "@/lib/types";
import { seasonLabelFr, weatherClimateFr, type Season, type WeatherKind } from "@/lib/season";

export type RecipePace = "express" | "equilibre" | "gastro";
export type HeatStyle = "complexe" | "doux" | "neutre";

export const KITCHEN_APPLIANCES = [
  { id: "Thermomix", label: "Thermomix TM31" },
  { id: "KitchenAid", label: "KitchenAid" },
  { id: "Cookeo", label: "Cookeo" },
  { id: "Airfryer", label: "Airfryer" },
  { id: "Mixer", label: "Mixer" },
  { id: "Cuiseur à riz", label: "Cuiseur à riz" },
] as const;

export type KitchenApplianceId = (typeof KITCHEN_APPLIANCES)[number]["id"];

export type KitchenClimate = {
  season: Season;
  weather: WeatherKind;
  tempC: number | null;
};

export type KitchenPrefs = {
  recipePace: RecipePace;
  heatStyle: HeatStyle;
  dinnersLowCal: boolean;
  tofuWeekdayFresh: boolean;
  mockMeatsWeekendOnly: boolean;
  weatherAdaptive: boolean;
  seasonalProduce: boolean;
  homemadeSauces: boolean;
  batchLabel: string;
  preferredHerbs: string[];
  preferredSpices: string[];
  extraAversions: string[];
  extraTastes: string[];
  /** Critères libres du foyer (tags), lus par Gem Chef. */
  extraRules: string[];
  appliances: Record<KitchenApplianceId, boolean>;
};

export const RECIPE_PACE_LABEL: Record<RecipePace, string> = {
  express: "Express",
  equilibre: "Équilibré",
  gastro: "Gourmet",
};

export const HEAT_STYLE_LABEL: Record<HeatStyle, string> = {
  complexe: "Complexes & Très épicées",
  doux: "Douces & Parfumées",
  neutre: "Neutres",
};

const ALL_APPLIANCES_ON: Record<KitchenApplianceId, boolean> = {
  Thermomix: true,
  KitchenAid: true,
  Cookeo: true,
  Airfryer: true,
  Mixer: true,
  "Cuiseur à riz": true,
};

export const DEFAULT_KITCHEN_PREFS: KitchenPrefs = {
  recipePace: "equilibre",
  heatStyle: "complexe",
  dinnersLowCal: true,
  tofuWeekdayFresh: true,
  mockMeatsWeekendOnly: true,
  weatherAdaptive: true,
  seasonalProduce: true,
  homemadeSauces: true,
  batchLabel: "Session express · sauces en pots",
  preferredHerbs: ["menthe", "basilic", "persil plat", "ciboulette"],
  preferredSpices: ["cumin", "paprika fumé", "gingembre frais", "5-épices", "raifort"],
  extraAversions: [],
  extraTastes: [],
  extraRules: [],
  appliances: { ...ALL_APPLIANCES_ON },
};

const STORAGE_KEY = "kitchen-prefs";

function asPace(value: unknown): RecipePace {
  return value === "express" ? "express" : "equilibre";
}

function asHeat(value: unknown): HeatStyle {
  return value === "complexe" ? "complexe" : "neutre";
}

function dropForcedHerb(rules: string[]) {
  return rules.filter((rule) => !/toujours une herbe/i.test(rule));
}

function asStringList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function asAppliances(value: unknown): Record<KitchenApplianceId, boolean> {
  const rec = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const next = { ...ALL_APPLIANCES_ON };
  for (const item of KITCHEN_APPLIANCES) {
    const flag = rec[item.id];
    if (typeof flag === "boolean") next[item.id] = flag;
  }
  return next;
}

export function parseKitchenPrefs(raw: unknown): KitchenPrefs {
  const rec = raw && typeof raw === "object" ? (raw as Partial<KitchenPrefs>) : {};
  return {
    ...DEFAULT_KITCHEN_PREFS,
    ...rec,
    recipePace: asPace(rec.recipePace),
    heatStyle: asHeat(rec.heatStyle),
    dinnersLowCal: rec.dinnersLowCal !== false,
    tofuWeekdayFresh: rec.tofuWeekdayFresh !== false,
    mockMeatsWeekendOnly: rec.mockMeatsWeekendOnly !== false,
    weatherAdaptive: rec.weatherAdaptive !== false,
    seasonalProduce: rec.seasonalProduce !== false,
    homemadeSauces: rec.homemadeSauces !== false,
    preferredHerbs: asStringList(rec.preferredHerbs, DEFAULT_KITCHEN_PREFS.preferredHerbs),
    preferredSpices: asStringList(rec.preferredSpices, DEFAULT_KITCHEN_PREFS.preferredSpices).filter(
      (spice) => !/^moutarde$/i.test(spice),
    ),
    extraAversions: asStringList(rec.extraAversions, []),
    extraTastes: asStringList(rec.extraTastes, []),
    extraRules: dropForcedHerb(asStringList(rec.extraRules, [])),
    appliances: asAppliances(rec.appliances),
  };
}

export function loadKitchenPrefs(): KitchenPrefs {
  return parseKitchenPrefs(storage.getJSON<Partial<KitchenPrefs>>(STORAGE_KEY, {}));
}

export function saveKitchenPrefsLocal(prefs: KitchenPrefs) {
  storage.setJSON(STORAGE_KEY, prefs);
}

/** Alias — Tab 5 et Gem Chef lisent la même clé localStorage. */
export const saveKitchenPrefs = saveKitchenPrefsLocal;

export function silentAversions(prefs: KitchenPrefs, profiles: Pick<Profile, "aversions">[]) {
  return [
    ...new Set([...profiles.flatMap((profile) => profile.aversions), ...prefs.extraAversions]),
  ];
}

export function householdTastes(prefs: KitchenPrefs, profiles: Pick<Profile, "name" | "preferences">[]) {
  const perProfile = profiles
    .map((profile) => `${profile.name} : ${profile.preferences.join(", ")}`)
    .join(" · ");
  const extra = prefs.extraRules.length ? ` Critères foyer : ${prefs.extraRules.join(" · ")}.` : "";
  return `${perProfile}.${extra}`;
}

export function enabledAppliances(prefs: KitchenPrefs) {
  return KITCHEN_APPLIANCES.filter((item) => prefs.appliances[item.id]).map((item) => item.label);
}

export function formatKitchenPrefsForPrompt(
  prefs: KitchenPrefs,
  profiles: Pick<Profile, "name" | "aversions" | "preferences" | "diet">[],
  climate?: KitchenClimate | null,
) {
  const aversions = silentAversions(prefs, profiles);
  const pace =
    prefs.recipePace === "express"
      ? "TYPE DE RECETTE : EXPRESS. Préparation très rapide."
      : "";
  const heat =
    prefs.heatStyle === "complexe"
      ? "GOÛT : n'hésite pas à choisir des recettes qui jouent d'une ou plusieurs épices, pour que ce soit goûtu. Les épices font partie du plat — n'en rajoute pas si la recette n'en a pas."
      : "";
  const mock = prefs.mockMeatsWeekendOnly
    ? "Simili-carnés : week-end uniquement (pas de simili-carné en semaine)."
    : "Simili-carnés : selon la recette.";
  const dinner = prefs.dinnersLowCal
    ? "Tous les dîners : low calorie."
    : "Dîners : pas de contrainte low cal.";
  const sauces = prefs.homemadeSauces
    ? "Quand le plat a une sauce : 100% maison, chaque composant dosé (jamais un pot du commerce). INTERDIT d'inventer une sauce ou une vinaigrette pour satisfaire cette règle."
    : "";
  const gear = enabledAppliances(prefs);
  const gearLine =
    gear.length === KITCHEN_APPLIANCES.length
      ? "MATÉRIEL : Thermomix TM31, KitchenAid, Cookeo, Airfryer, mixer, cuiseur à riz — tous dispo. Utilise-les au mieux pour CE plat."
      : `MATÉRIEL AUTORISÉ : ${gear.join(", ") || "plaque / four uniquement"}. Ne pas utiliser les appareils absents.`;
  const climateBit = climate
    ? weatherClimateFr(climate.weather, climate.tempC)
    : "";
  const weather = prefs.weatherAdaptive
    ? climateBit
      ? `Météo du jour (Eschentzwiller) : ${climateBit}. Éclairage seulement — plat plutôt chaud si froid / plutôt froid ou léger si chaud. Pas un menu imposé.`
      : "Météo : éclairage chaud / froid selon le jour. Pas un menu imposé."
    : "";
  const seasonal = prefs.seasonalProduce
    ? climate
      ? `Légumes de saison (${seasonLabelFr(climate.season)}, Alsace) : privilégie-les quand ça va avec le plat. Pas une liste fermée.`
      : "Légumes de saison : privilégie-les quand ça va avec le plat. Pas une liste fermée."
    : "";
  const rules = prefs.extraRules.length
    ? `CRITÈRES LIBRES À RESPECTER : ${prefs.extraRules.join(" · ")}.`
    : "";

  const head = [pace, heat].filter(Boolean).join("\n");

  return `PRÉFÉRENCES FOYER (onglet Paramètres — source de vérité) :
${head ? `${head}\n` : ""}${gearLine}
Goûts : ${householdTastes(prefs, profiles)}
${dinner} ${mock} ${sauces} ${weather} ${seasonal}
${rules}
Aversions foyer (ne pas les mettre dans la recette, ne pas les citer) : ${aversions.join(", ") || "aucune"}.`;
}
