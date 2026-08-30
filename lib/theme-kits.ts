import type { PlannedMeal } from "@/lib/types";
import { normalizeTitle } from "@/lib/recipe-diversity";
import { sharedProteinThemeLine } from "@/lib/recipe-integrity";

export function stripThemeSticker(title: string, theme: string) {
  const t = theme.trim();
  if (!t || !title) return title;
  const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return title
    .replace(new RegExp(`\\s*[·•,\\-]\\s*${escaped}\\s*$`, "i"), "")
    .replace(new RegExp(`\\s*[·•]\\s*th[eè]me\\s+${escaped}\\s*$`, "i"), "")
    .trim();
}

type ThemeKit = {
  keys: string[];
  markers: string[];
  dishes: string;
};

const KITS: ThemeKit[] = [
  {
    keys: ["coreen", "coreenne", "korean", "korea", "coree", "seoul"],
    markers: [
      "bibimbap",
      "japchae",
      "kimbap",
      "gimbap",
      "kimchi",
      "doenjang",
      "gochujang",
      "bulgogi",
      "namul",
      "banchan",
      "ssam",
      "kongnamul",
      "danmuji",
      "nori",
    ],
    dishes:
      "bibimbap, japchae, kimbap, namul sésame, banchan concombre, marinade bulgogi soja-poire-ail (sans piment)",
  },
  {
    keys: ["afrique", "africain", "north africa", "maghreb", "maroc", "senegal", "senegal"],
    markers: ["chermoula", "ras el hanout", "zaalouk", "yassa", "semoule", "couscous", "zaatar", "mafé", "mafe", "kefta"],
    dishes: "yassa, zaalouk, chermoula, mafé, kefta, couscous",
  },
  {
    keys: ["francais", "français", "france", "provençal", "provence", "lyonnais", "terroir"],
    markers: [
      "ratatouille",
      "tian",
      "pistou",
      "herbes de provence",
      "lentilles du puy",
      "quiche",
      "velouté",
      "veloute",
      "tartine",
      "nicoise",
      "bourguignon",
    ],
    dishes: "niçoise, pistou, lentilles du Puy, ratatouille, velouté",
  },
  {
    keys: ["italien", "italia", "italy"],
    markers: ["pesto", "orzo", "penne", "mozza", "parmesan", "risotto"],
    dishes: "orzo, pesto, risotto, penne",
  },
  {
    keys: ["asiatique", "thai", "thailande", "japon", "vietnam", "bo bun", "vietnamien"],
    markers: ["satay", "miso", "nuoc", "vermicelle", "edamame", "pak choi", "teriyaki", "bo bun", "lemongrass"],
    dishes: "bo bun, satay, nuoc, teriyaki, miso",
  },
];

export function matchKit(theme: string) {
  const needle = normalizeTitle(theme);
  if (!needle) return null;
  return (
    KITS.find((kit) =>
      kit.keys.some((key) => {
        const k = normalizeTitle(key);
        return needle.includes(k) || k.includes(needle);
      }),
    ) ?? null
  );
}

function alreadyThemed(meal: PlannedMeal, kit: ThemeKit) {
  const text = normalizeTitle(`${meal.baseName} ${meal.sharedBase} ${meal.theme}`);
  return kit.markers.some((marker) => text.includes(normalizeTitle(marker)));
}

export function mealMatchesTheme(meal: PlannedMeal, theme: string) {
  const needle = theme.trim().toLowerCase();
  if (!needle) return true;
  const kit = matchKit(needle);
  if (kit) {
    return alreadyThemed(meal, kit) || kit.keys.some((key) => normalizeTitle(meal.theme).includes(normalizeTitle(key)));
  }
  const tokens = normalizeTitle(needle)
    .split(" ")
    .filter((token) => token.length > 2);
  const blob = normalizeTitle(`${meal.theme} ${meal.baseName} ${meal.sharedBase}`);
  return tokens.some((token) => blob.includes(token));
}

export function conflictsWithTheme(meal: PlannedMeal, theme: string) {
  const kit = matchKit(theme);
  if (!kit) return false;
  const text = normalizeTitle(`${meal.baseName} ${meal.sharedBase} ${meal.theme}`);
  return KITS.some(
    (other) => other !== kit && other.markers.some((marker) => text.includes(normalizeTitle(marker))),
  );
}

export function themeMismatchProblems(titles: string[], theme: string) {
  const label = theme.trim();
  if (!label) return [];
  const kit = matchKit(label);
  const themeNorm = normalizeTitle(label);
  const themeTokens = themeNorm.split(" ").filter((token) => token.length > 2);
  const problems: string[] = [];

  for (const title of titles) {
    const text = normalizeTitle(title);
    if (!text) continue;

    for (const other of KITS) {
      if (kit && other === kit) continue;
      const hits = other.markers.filter((marker) => text.includes(normalizeTitle(marker)));
      if (hits.length > 0) {
        problems.push(`« ${title} » n'est pas du thème « ${label} » (${hits.join(", ")})`);
      }
    }

    if (kit) {
      const onTheme =
        kit.markers.some((marker) => text.includes(normalizeTitle(marker))) ||
        kit.keys.some((key) => text.includes(normalizeTitle(key))) ||
        text.includes(themeNorm);
      if (!onTheme) {
        problems.push(`« ${title} » n'incarne pas le thème « ${label} » (titre générique)`);
      }
    } else if (themeTokens.length > 0 && !themeTokens.some((token) => text.includes(token))) {
      problems.push(`« ${title} » n'incarne pas le thème « ${label} »`);
    }
  }
  return problems;
}

/** Consigne Gemini : le thème s'applique à TOUS les plats du lot. */
export function themeConstraintLine(theme: string, count: number) {
  const label = theme.trim();
  if (!label) return "Pas de thème imposé — varie les bases.";
  const kit = matchKit(label);
  const examples = kit?.dishes ?? label;
  const forbidden = KITS.filter((other) => other !== kit)
    .flatMap((other) => other.markers)
    .slice(0, 22)
    .join(", ");
  const star = sharedProteinThemeLine(label);
  return `THÈME IMPOSÉ SUR LES ${count} REPAS : « ${label} ».
Le thème est la STAR de chaque recette : titre + base partagée + ingrédient majeur + une étape dédiée.
Plats attendus (cuisine « ${label} ») : ${examples}.
INTERDIT d'autres cuisines / mots : ${forbidden || "aucune"}.
INTERDIT de coller « · ${label} » sur un bowl générique, un satay, un zaalouk, une kefta ou l'exemple JSON courgette/edamame.
Les ${count} recettes, sans exception — 0 plat hors thème.${star ? `\n${star}` : ""}`;
}

/** Ne greffe plus le thème en suffixe. Le catalogue / Gemini doit fournir le vrai plat. */
export function adaptMealToTheme(meal: PlannedMeal, theme: string): PlannedMeal {
  const next = theme.trim();
  const baseName = stripThemeSticker(meal.baseName, next || meal.theme);
  if (!next) return { ...meal, baseName, theme: meal.theme || "Base" };
  return { ...meal, baseName, theme: next };
}
