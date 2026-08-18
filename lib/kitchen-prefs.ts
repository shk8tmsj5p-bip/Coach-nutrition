import { storage } from "@/lib/storage";
import type { Profile } from "@/lib/types";

export type RecipePace = "express" | "equilibre" | "gastro";
export type HeatStyle = "complexe" | "doux" | "neutre";

export const KITCHEN_APPLIANCES = [
  { id: "Thermomix", label: "Thermomix" },
  { id: "Airfryer", label: "Airfryer" },
  { id: "Cookeo", label: "Cookeo" },
  { id: "Cuiseur à riz", label: "Cuiseur à riz" },
  { id: "KitchenAid", label: "KitchenAid" },
] as const;

export type KitchenApplianceId = (typeof KITCHEN_APPLIANCES)[number]["id"];

export type KitchenPrefs = {
  recipePace: RecipePace;
  heatStyle: HeatStyle;
  dinnersLowCal: boolean;
  tofuWeekdayFresh: boolean;
  mockMeatsWeekendOnly: boolean;
  weatherAdaptive: boolean;
  batchLabel: string;
  preferredHerbs: string[];
  preferredSpices: string[];
  extraAversions: string[];
  extraTastes: string[];
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
  Airfryer: true,
  Cookeo: true,
  "Cuiseur à riz": true,
  KitchenAid: true,
};

export const DEFAULT_KITCHEN_PREFS: KitchenPrefs = {
  recipePace: "express",
  heatStyle: "complexe",
  dinnersLowCal: true,
  tofuWeekdayFresh: true,
  mockMeatsWeekendOnly: true,
  weatherAdaptive: true,
  batchLabel: "Session express · sauces en pots",
  preferredHerbs: ["menthe", "basilic", "persil plat", "ciboulette"],
  preferredSpices: ["cumin", "paprika fumé", "gingembre frais", "5-épices", "moutarde", "raifort"],
  extraAversions: [],
  extraTastes: ["sauces maison complexes", "herbes fraîches", "umami"],
  appliances: { ...ALL_APPLIANCES_ON },
};

const STORAGE_KEY = "kitchen-prefs";

function asPace(value: unknown): RecipePace {
  return value === "equilibre" || value === "gastro" ? value : "express";
}

function asHeat(value: unknown): HeatStyle {
  return value === "doux" || value === "neutre" ? value : "complexe";
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
    preferredHerbs: Array.isArray(rec.preferredHerbs)
      ? rec.preferredHerbs.filter((item): item is string => typeof item === "string")
      : DEFAULT_KITCHEN_PREFS.preferredHerbs,
    preferredSpices: Array.isArray(rec.preferredSpices)
      ? rec.preferredSpices.filter((item): item is string => typeof item === "string")
      : DEFAULT_KITCHEN_PREFS.preferredSpices,
    extraAversions: Array.isArray(rec.extraAversions)
      ? rec.extraAversions.filter((item): item is string => typeof item === "string")
      : [],
    extraTastes: Array.isArray(rec.extraTastes)
      ? rec.extraTastes.filter((item): item is string => typeof item === "string")
      : DEFAULT_KITCHEN_PREFS.extraTastes,
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
  const extra = prefs.extraTastes.length ? ` Foyer : ${prefs.extraTastes.join(", ")}.` : "";
  return `${perProfile}.${extra}`;
}

export function enabledAppliances(prefs: KitchenPrefs) {
  return KITCHEN_APPLIANCES.filter((item) => prefs.appliances[item.id]).map((item) => item.label);
}

export function formatKitchenPrefsForPrompt(
  prefs: KitchenPrefs,
  profiles: Pick<Profile, "name" | "aversions" | "preferences" | "diet">[],
) {
  const aversions = silentAversions(prefs, profiles);
  const pace =
    prefs.recipePace === "express"
      ? `TYPE DE RECETTE : EXPRESS S34. Recettes ultra-détaillées mais conçues pour un assemblage et un temps de préparation ultra-rapide. Airfryer parallèle, féculents eau/cuiseur, sauces Thermomix, découpes KitchenAid, montage tupperware. Plats TRÈS gourmands malgré la vitesse (vinaigrette complexe, herbes, épices).`
      : prefs.recipePace === "gastro"
        ? `TYPE DE RECETTE : GOURMET. Tian, rôtis, sauces travaillées, plus de four / plaques. Toujours actionnable en batch.`
        : `TYPE DE RECETTE : ÉQUILIBRÉ. Mix express et un plat plus travaillé par lot.`;
  const heat =
    prefs.heatStyle === "complexe"
      ? `GOÛT : complexes et très épicées sans piment fort — ${prefs.preferredSpices.join(", ")}. Herbes : ${prefs.preferredHerbs.join(", ")}.`
      : prefs.heatStyle === "doux"
        ? `GOÛT : douces et parfumées — herbes, agrumes, huile d'olive. Épices légères.`
        : `GOÛT : neutres — assaisonnement simple, peu d'épices, herbes discrètes.`;
  const tofu = prefs.tofuWeekdayFresh
    ? "Tofu Lun–Ven : presser, mariner, frais à l'assemblage (cru uniquement en semaine)."
    : "Tofu : cuisson autorisée en semaine.";
  const mock = prefs.mockMeatsWeekendOnly
    ? "Simili-carnés : week-end uniquement (pas de simili-carné en semaine)."
    : "Simili-carnés : selon la recette.";
  const dinner = prefs.dinnersLowCal
    ? "Tous les dîners : low calorie systématiques (huile ≤ 8 g)."
    : "Dîners : pas de contrainte low cal.";
  const gear = enabledAppliances(prefs);
  const gearLine =
    gear.length === KITCHEN_APPLIANCES.length
      ? "MATÉRIEL : Thermomix, Airfryer, Cookeo, cuiseur à riz, KitchenAid — tous dispo."
      : `MATÉRIEL AUTORISÉ : ${gear.join(", ") || "plaque / four uniquement"}. Ne pas utiliser les appareils absents.`;
  const weather = prefs.weatherAdaptive ? "Météo : canicule → bowls / salades / crudités." : "";

  return `PRÉFÉRENCES FOYER (onglet Paramètres — source de vérité) :
${pace}
${heat}
${gearLine}
Goûts : ${householdTastes(prefs, profiles)}
${dinner} ${tofu} ${mock} ${weather}
Aversions à OMETTRE (ne jamais écrire « sans X ») : ${aversions.join(", ") || "aucune"}.`;
}
