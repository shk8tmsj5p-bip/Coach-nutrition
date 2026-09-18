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

/** Thème = un plat précis (pas une cuisine). Le mot-star doit rester dans chaque titre. */
const DISH_STARS: Array<{ keys: string[]; must: RegExp; forbid: RegExp; avoid: string }> = [
  {
    keys: ["quiche"],
    must: /quiche/i,
    forbid: /tortilla|wrap|burrito|taco|bowl\b|quinoa|bo bun|salade\b|taboul/i,
    avoid: "wrap, tortillas, bowl, quinoa",
  },
  {
    keys: ["clafoutis", "clafouti"],
    must: /clafoutis|clafouti/i,
    forbid: /bowl\b|wrap|tortilla/i,
    avoid: "bowl, wrap, tortillas",
  },
  {
    keys: ["tarte"],
    must: /tarte/i,
    forbid: /bowl\b|wrap|tortilla|pizza/i,
    avoid: "bowl, wrap, pizza",
  },
  { keys: ["flan"], must: /flan/i, forbid: /bowl\b|wrap|tortilla/i, avoid: "bowl, wrap, tortillas" },
  { keys: ["pizza"], must: /pizza/i, forbid: /bowl\b|wrap|quinoa/i, avoid: "bowl, wrap, quinoa" },
  { keys: ["risotto"], must: /risotto/i, forbid: /bowl\b|wrap|tortilla/i, avoid: "bowl, wrap, tortillas" },
  {
    keys: ["wrap", "tortilla", "burrito"],
    must: /wrap|tortilla|burrito/i,
    forbid: /bowl\b|risotto|quiche|bo bun|taboul/i,
    avoid: "bowl, risotto, quiche",
  },
];

export function dishStarOf(theme: string) {
  const needle = normalizeTitle(theme);
  if (!needle) return null;
  return (
    DISH_STARS.find((dish) => dish.keys.some((key) => needle.includes(normalizeTitle(key)))) ?? null
  );
}

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
  const blob = normalizeTitle(`${meal.theme} ${meal.baseName} ${meal.sharedBase}`);
  const tokens = normalizeTitle(needle)
    .split(" ")
    .filter((token) => token.length > 2);
  if (kit) {
    if (kit.keys.some((key) => blob.includes(normalizeTitle(key)))) return true;
    if (alreadyThemed(meal, kit)) return true;
  }
  return tokens.some((token) => blob.includes(token));
}

export function conflictsWithTheme(meal: PlannedMeal, theme: string) {
  const kit = matchKit(theme);
  if (!kit) return false;
  const text = normalizeTitle(`${meal.baseName} ${meal.theme}`);
  if (kit.keys.some((key) => text.includes(normalizeTitle(key)))) return false;
  return KITS.some(
    (other) =>
      other !== kit && other.keys.some((key) => text.includes(normalizeTitle(key))),
  );
}

export function themeMismatchProblems(titles: string[], theme: string) {
  const label = theme.trim();
  if (!label) return [];
  const kit = matchKit(label);
  const dish = dishStarOf(label);
  const themeNorm = normalizeTitle(label);
  const themeTokens = themeNorm.split(" ").filter((token) => token.length > 2);
  const problems: string[] = [];

  for (const title of titles) {
    const text = normalizeTitle(title);
    if (!text) continue;

    if (dish) {
      if (!dish.must.test(title)) {
        problems.push(`« ${title} » n'est pas une « ${dish.keys[0]} » (thème « ${label} »)`);
      }
      const banned = title.match(dish.forbid);
      if (banned) {
        problems.push(`« ${title} » remplace le thème « ${label} » par ${banned[0]}`);
      }
      continue;
    }

    const onTheme =
      text.includes(themeNorm) ||
      (themeTokens.length > 0 && themeTokens.some((token) => text.includes(token))) ||
      (kit
        ? kit.keys.some((key) => text.includes(normalizeTitle(key)))
        : false);
    if (!onTheme) {
      problems.push(`« ${title} » n'incarne pas le thème « ${label} »`);
    }
  }
  return problems;
}

/** Consigne Gemini : le thème s'applique à TOUS les plats du lot. */
export function themeConstraintLine(theme: string, count: number) {
  const label = theme.trim();
  if (!label) return "Pas de thème imposé — identités distinctes dans le lot.";
  const star = sharedProteinThemeLine(label);
  const dish = dishStarOf(label);
  if (dish) {
    return `THÈME = LE PLAT : « ${label} ».
Les ${count} recettes SONT des « ${dish.keys[0]} ». Titre : le mot « ${dish.keys[0]} » sur chaque recette.
Diversité = garniture / légumes / herbes. INTERDIT de changer de TYPE de plat.
INTERDIT ${dish.avoid} à la place de la ${dish.keys[0]}.
Le schéma JSON est un format de clés, pas un plat à recopier.
EXCEPTION TOFU : cuisson four autorisée (quiche / tarte / flan / clafoutis / dessert), y compris Lun–Ven.${star ? `\n${star}` : ""}`;
  }
  return `THÈME IMPOSÉ SUR LES ${count} REPAS : « ${label} ».
Chaque recette EST de cette cuisine ou de cet ingrédient-star : titre + base + étape dédiée.
Invente des plats de cette cuisine. INTERDIT un plat générique avec « · ${label} » collé.
Les ${count} recettes, sans exception.${star ? `\n${star}` : ""}`;
}

/** Ne greffe plus le thème en suffixe. Le catalogue / Gemini doit fournir le vrai plat. */
export function adaptMealToTheme(meal: PlannedMeal, theme: string): PlannedMeal {
  const next = theme.trim();
  const baseName = stripThemeSticker(meal.baseName, next || meal.theme);
  if (!next) return { ...meal, baseName, theme: meal.theme || "Base" };
  return { ...meal, baseName, theme: next };
}
