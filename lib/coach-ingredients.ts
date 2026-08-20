import { isDessertItemLine, isEmptyDessertMarker } from "@/lib/meal-templates";
import type { Macros, MealType, ProfileId } from "@/lib/types";

export type MacroKind = "carbs" | "protein" | "fat";

export type ParsedMealItem = {
  raw: string;
  name: string;
  grams: number | null;
};

export type CoachIngredientAdd = {
  kind: MacroKind;
  name: string;
  addGrams: number;
  newTotalGrams: number | null;
  badge: string;
  /** No-prep option for a meal already cooked / prepared (Today only). */
  quickName?: string;
  quickGrams?: number;
  quickBadge?: string;
};

export type DisplayMealItem = {
  text: string;
  boosted: boolean;
};

export type MealIngredientView = {
  adds: CoachIngredientAdd[];
  items: DisplayMealItem[];
  badges: string[];
};

export const FULL_DAY_SLOTS: MealType[] = [
  "petit-dejeuner",
  "dejeuner",
  "diner",
  "collation",
];

type FoodDef = {
  keys: string[];
  kind: MacroKind;
  /** g de macro / g d’aliment */
  density: number;
  dryDensity?: number;
  dryKeys?: string[];
};

const FOODS: FoodDef[] = [
  { keys: ["flocon", "avoine"], kind: "carbs", density: 0.8 },
  { keys: ["granola"], kind: "carbs", density: 0.64 },
  { keys: ["riz"], kind: "carbs", density: 0.28, dryDensity: 0.77, dryKeys: ["sec"] },
  { keys: ["quinoa"], kind: "carbs", density: 0.22, dryDensity: 0.64, dryKeys: ["sec"] },
  { keys: ["lentille"], kind: "carbs", density: 0.2, dryDensity: 0.6, dryKeys: ["sec"] },
  {
    keys: ["pate", "pates", "penne", "orzo", "vermicelle", "sarrasin"],
    kind: "carbs",
    density: 0.25,
    dryDensity: 0.75,
    dryKeys: ["sec"],
  },
  { keys: ["pain", "toast", "naan", "pita", "wrap"], kind: "carbs", density: 0.5 },
  { keys: ["banane"], kind: "carbs", density: 0.23 },
  { keys: ["myrtill", "framboise", "fraise"], kind: "carbs", density: 0.12 },
  { keys: ["patate", "pomme de terre"], kind: "carbs", density: 0.17 },
  { keys: ["tofu"], kind: "protein", density: 0.15 },
  { keys: ["edamame"], kind: "protein", density: 0.11 },
  { keys: ["skyr"], kind: "protein", density: 0.11 },
  { keys: ["fromage blanc"], kind: "protein", density: 0.08 },
  { keys: ["yaourt", "yogurt"], kind: "protein", density: 0.05 },
  { keys: ["poulet", "dinde"], kind: "protein", density: 0.31 },
  { keys: ["thon", "cabillaud", "saumon"], kind: "protein", density: 0.24 },
  { keys: ["whey", "protein crunch", "crunch"], kind: "protein", density: 0.7 },
  { keys: ["chia"], kind: "fat", density: 0.31 },
  { keys: ["avocat"], kind: "fat", density: 0.15 },
  { keys: ["huile"], kind: "fat", density: 0.9 },
  { keys: ["tahini", "beurre d amande", "beurre d'amande"], kind: "fat", density: 0.55 },
];

const FALLBACK: Record<MealType, Record<MacroKind, { alexis: string; elodie: string }>> = {
  "petit-dejeuner": {
    carbs: { alexis: "Flocons d'avoine", elodie: "Flocons d'avoine" },
    protein: { alexis: "Yaourt soja nature", elodie: "Skyr" },
    fat: { alexis: "Graines de chia", elodie: "Graines de chia" },
  },
  dejeuner: {
    carbs: { alexis: "Riz basmati", elodie: "Riz basmati" },
    protein: { alexis: "Tofu ferme", elodie: "Poulet" },
    fat: { alexis: "Huile d'olive", elodie: "Huile d'olive" },
  },
  diner: {
    carbs: { alexis: "Edamame", elodie: "Edamame" },
    protein: { alexis: "Edamame", elodie: "Poulet" },
    fat: { alexis: "Huile d'olive", elodie: "Huile d'olive" },
  },
  collation: {
    carbs: { alexis: "Banane", elodie: "Banane" },
    protein: { alexis: "Protein crunch", elodie: "Skyr" },
    fat: { alexis: "Graines de chia", elodie: "Graines de chia" },
  },
};

export function normalizeFoodName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function parseMealItem(raw: string): ParsedMealItem {
  const trimmed = raw.trim();
  const match = trimmed.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(g|ml|cl)\b/i);
  if (match) {
    const unit = match[3].toLowerCase();
    const qty = Number(match[2].replace(",", "."));
    return {
      raw: trimmed,
      name: match[1].replace(/\s*\([^)]*\)\s*$/, "").trim(),
      grams: unit === "g" && Number.isFinite(qty) ? qty : null,
    };
  }
  return {
    raw: trimmed,
    name: trimmed.replace(/\s*\([^)]*\)\s*$/, "").trim(),
    grams: null,
  };
}

export function matchFood(name: string): { kind: MacroKind; density: number } | null {
  const key = normalizeFoodName(name);
  for (const food of FOODS) {
    if (!food.keys.some((token) => key.includes(token))) continue;
    const dry =
      food.dryDensity &&
      food.dryKeys?.some((token) => key.includes(normalizeFoodName(token)));
    return { kind: food.kind, density: dry ? food.dryDensity! : food.density };
  }
  return null;
}

export function allocateMacroTargets(
  presentTypes: MealType[],
): Partial<Record<MacroKind, MealType>> {
  const has = (type: MealType) => presentTypes.includes(type);
  const first = (order: MealType[]) => order.find(has);
  return {
    carbs: first(["petit-dejeuner", "dejeuner", "collation", "diner"]),
    protein: first(["dejeuner", "diner", "petit-dejeuner", "collation"]),
    fat: first(["petit-dejeuner", "dejeuner", "collation"]),
  };
}

export function roundTo5(value: number) {
  if (value === 0) return 0;
  if (Math.abs(value) < 3) return value > 0 ? 5 : -5;
  return Math.round(value / 5) * 5;
}

export function signedGrams(value: number) {
  const sign = value > 0 ? "+" : "−";
  return `${sign}${Math.abs(Math.round(value))}g`;
}

export function coachNote(grams: number) {
  return `dont ${signedGrams(grams)} coach`;
}

export function stripCoachNote(notes: string | undefined) {
  return (notes ?? "")
    .replace(/\s*[·•,]?\s*\[?dont [+\-−]?\d+\s*g coach\]?/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s*·\s*$/, "")
    .trim();
}

export function mergeCoachNote(notes: string | undefined, grams: number) {
  const cleaned = stripCoachNote(notes);
  const tag = coachNote(grams);
  return cleaned ? `${cleaned} · ${tag}` : tag;
}

function fallbackName(mealType: MealType, kind: MacroKind, profileId: ProfileId) {
  return FALLBACK[mealType][kind][profileId];
}

function densityForName(name: string, kind: MacroKind, mealType: MealType) {
  const matched = matchFood(name);
  if (matched && matched.kind === kind) return matched.density;
  if (kind === "carbs") {
    return mealType === "dejeuner" || /riz/i.test(name) ? 0.77 : 0.8;
  }
  if (kind === "protein") return /poulet|dinde/i.test(name) ? 0.31 : 0.15;
  return 0.31;
}

export function gramsFromMacro(name: string, kind: MacroKind, mealType: MealType, macroG: number) {
  const density = densityForName(name, kind, mealType);
  if (density <= 0) return 0;
  return roundTo5(macroG / density);
}

export function prettyIngredientBadge(name: string, grams: number) {
  const short = name.replace(/\s+/g, " ").trim();
  if (/banane/i.test(short)) {
    if (Math.abs(grams) <= 60) return grams > 0 ? "+1/2 banane" : "−1/2 banane";
    if (Math.abs(grams) <= 130) return grams > 0 ? "+1 banane" : "−1 banane";
  }
  return `${signedGrams(grams)} ${short}`;
}

export function needsPrepToAdd(name: string) {
  const key = normalizeFoodName(name);
  return /flocon|avoine|riz|quinoa|lentille|pate|pates|penne|orzo|vermicelle|sarrasin|patate|pomme de terre|chia/.test(
    key,
  );
}

function quickCompanionName(kind: MacroKind, mealType: MealType, profileId: ProfileId) {
  if (kind === "carbs") {
    return mealType === "dejeuner" || mealType === "diner" ? "Pain complet" : "Banane";
  }
  if (kind === "protein") {
    if (mealType === "dejeuner" || mealType === "diner") {
      return profileId === "elodie" ? "Skyr" : "Yaourt soja nature";
    }
    return profileId === "elodie" ? "Skyr" : "Protein crunch";
  }
  if (mealType === "petit-dejeuner" || mealType === "collation") return "Beurre d'amande";
  return "Huile d'olive";
}

function withQuickOption(
  add: CoachIngredientAdd,
  mealType: MealType,
  profileId: ProfileId,
  macroG: number,
): CoachIngredientAdd {
  if (add.addGrams <= 0 || !needsPrepToAdd(add.name)) return add;
  const quickName = quickCompanionName(add.kind, mealType, profileId);
  if (namesOverlap(quickName, add.name)) return add;
  const quickGrams = gramsFromMacro(quickName, add.kind, mealType, macroG);
  if (quickGrams <= 0) return add;
  return {
    ...add,
    badge: `Idéal · ${add.badge}`,
    quickName,
    quickGrams,
    quickBadge: `Rapide · ${prettyIngredientBadge(quickName, quickGrams)}`,
  };
}

function stapleScore(name: string, kind: MacroKind) {
  const key = normalizeFoodName(name);
  if (kind === "carbs") {
    if (/flocon|avoine|riz|quinoa|pate|granola|pain/.test(key)) return 3;
    if (/banane/.test(key)) return 2;
    return 1;
  }
  if (kind === "protein") {
    if (/tofu|poulet|dinde|skyr|edamame|crunch/.test(key)) return 3;
    return 1;
  }
  if (/chia|huile|avocat/.test(key)) return 3;
  return 1;
}

function pickParsedItem(items: ParsedMealItem[], kind: MacroKind): ParsedMealItem | undefined {
  const scored = items
    .map((item) => ({ item, food: matchFood(`${item.name} ${item.raw}`) }))
    .filter((row) => row.food?.kind === kind);
  if (scored.length === 0) return undefined;
  return scored.sort(
    (a, b) =>
      stapleScore(b.item.name, kind) - stapleScore(a.item.name, kind) ||
      (b.item.grams ?? 0) - (a.item.grams ?? 0),
  )[0]?.item;
}

function namesOverlap(a: string, b: string) {
  const left = normalizeFoodName(a);
  const right = normalizeFoodName(b);
  return left.includes(right) || right.includes(left);
}

function rewriteItems(items: string[], adds: CoachIngredientAdd[]): DisplayMealItem[] {
  const parsed = items.map(parseMealItem);
  const assigned = new Map<number, CoachIngredientAdd>();
  const extras: DisplayMealItem[] = [];

  for (const add of adds) {
    if (add.quickName && add.quickGrams != null && add.quickGrams > 0) {
      extras.push({
        text: `${add.quickName} ${Math.round(add.quickGrams)}g [sur le moment]`,
        boosted: true,
      });
      continue;
    }
    const named = parsed.findIndex(
      (item, index) =>
        !assigned.has(index) &&
        !isDessertItemLine(item.raw) &&
        !isEmptyDessertMarker(item.raw) &&
        namesOverlap(item.name, add.name),
    );
    if (named >= 0) {
      assigned.set(named, add);
      continue;
    }
    const kindHits = parsed
      .map((item, index) => ({ item, index }))
      .filter(
        ({ item, index }) =>
          !assigned.has(index) &&
          !isDessertItemLine(item.raw) &&
          !isEmptyDessertMarker(item.raw) &&
          matchFood(`${item.name} ${item.raw}`)?.kind === add.kind,
      )
      .sort((a, b) => (b.item.grams ?? 0) - (a.item.grams ?? 0));
    if (kindHits[0]) assigned.set(kindHits[0].index, add);
  }

  const lines: DisplayMealItem[] = parsed.map((item, index) => {
    const add = assigned.get(index);
    if (!add) return { text: item.raw, boosted: false };
    const total =
      add.newTotalGrams ??
      (item.grams != null ? Math.max(0, item.grams + add.addGrams) : null);
    const label = total != null ? `${item.name} ${Math.round(total)}g` : item.name;
    return { text: `${label} [${coachNote(add.addGrams)}]`, boosted: true };
  });

  for (const add of adds) {
    if (add.quickName) continue;
    if ([...assigned.values()].includes(add)) continue;
    const total = add.newTotalGrams ?? add.addGrams;
    lines.push({
      text: `${add.name} ${Math.round(Math.max(0, total))}g [${coachNote(add.addGrams)}]`,
      boosted: true,
    });
  }
  return [...lines, ...extras];
}

export function translateMealAdjustments(opts: {
  mealType: MealType;
  items: string[];
  deltas: Macros;
  profileId: ProfileId;
  presentTypes: MealType[];
  skipped?: boolean;
  quickOverrides?: Partial<Record<MacroKind, { name: string; grams: number }>>;
}): MealIngredientView {
  if (opts.skipped) {
    return {
      adds: [],
      items: (opts.items ?? []).map((text) => ({ text, boosted: false })),
      badges: [],
    };
  }

  const targets = allocateMacroTargets(opts.presentTypes);
  const parsed = (opts.items ?? [])
    .filter((line) => !isDessertItemLine(line) && !isEmptyDessertMarker(line))
    .map(parseMealItem);
  const adds: CoachIngredientAdd[] = [];

  (["carbs", "protein", "fat"] as MacroKind[]).forEach((kind) => {
    if (targets[kind] !== opts.mealType) return;
    const macroG = Math.round(opts.deltas[kind]);
    if (Math.abs(macroG) < 3) return;

    const matched = pickParsedItem(parsed, kind);
    const name = matched?.name ?? fallbackName(opts.mealType, kind, opts.profileId);
    let addGrams = gramsFromMacro(
      matched ? `${matched.name} ${matched.raw}` : name,
      kind,
      opts.mealType,
      macroG,
    );
    if (addGrams === 0) return;
    if (matched?.grams != null && matched.grams + addGrams < 0) {
      addGrams = -matched.grams;
    }
    if (addGrams === 0) return;

    const newTotalGrams = matched?.grams != null ? Math.max(0, matched.grams + addGrams) : addGrams;
    const base: CoachIngredientAdd = {
      kind,
      name,
      addGrams,
      newTotalGrams,
      badge: prettyIngredientBadge(name, addGrams),
    };
    const override = opts.quickOverrides?.[kind];
    if (override && addGrams > 0 && needsPrepToAdd(name)) {
      adds.push({
        ...base,
        badge: `Idéal · ${base.badge}`,
        quickName: override.name,
        quickGrams: override.grams,
        quickBadge: `Rapide · ${prettyIngredientBadge(override.name, override.grams)}`,
      });
    } else {
      adds.push(withQuickOption(base, opts.mealType, opts.profileId, macroG));
    }
  });

  const items = rewriteItems(opts.items ?? [], adds);
  return {
    adds,
    items,
    badges: adds.flatMap((add) => [add.badge, add.quickBadge].filter((tag): tag is string => Boolean(tag))),
  };
}

export function collectDayBadges(views: MealIngredientView[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const view of views) {
    for (const badge of view.badges) {
      if (seen.has(badge)) continue;
      seen.add(badge);
      out.push(badge);
    }
  }
  return out;
}
