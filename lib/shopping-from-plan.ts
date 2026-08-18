import type { PlannedMeal, ShoppingListItem } from "@/lib/types";
import { planTagByMealId } from "@/lib/meal-tags";
import { formatIngredientLine, parseVisualQuantity, visualForIngredient } from "@/lib/visual-quantity";
import { isEmptyMeal } from "@/lib/weekly-plan";

export const AISLE_ORDER = [
  "FRUITS & LÉGUMES",
  "FRAIS / RAYON BIO",
  "VIANDES & POISSONS",
  "BOULANGERIE",
  "ÉPICERIE SALÉE",
  "ÉPICES & CONDIMENTS",
  "SURGELÉS",
  "AUTRE",
] as const;

export type AisleName = (typeof AISLE_ORDER)[number];

function fold(text: string) {
  return text
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Eau de cuisson / d'ajustement : jamais sur la liste, jamais en recette. */
export function isUnlistedShoppingIng(name: string) {
  const n = fold(name).trim();
  return n === "eau" || n === "water" || /^eau\s*(froide|chaude|tiede)?$/.test(n);
}

const AISLE_RULES: { aisle: AisleName; keys: string[] }[] = [
  {
    aisle: "VIANDES & POISSONS",
    keys: [
      "poulet",
      "dinde",
      "boeuf",
      "crevette",
      "thon",
      "jambon",
      "cabillaud",
      "saumon",
      "truite",
      "oeuf",
      "lardon",
      "steak",
    ],
  },
  {
    aisle: "FRAIS / RAYON BIO",
    keys: [
      "tofu",
      "simili",
      "yaourt",
      "skyr",
      "feta",
      "mozza",
      "ricotta",
      "fromage",
      "parmesan",
      "lait soja",
      "houmous",
      "hummus",
      "edamame",
      "chia",
      "falafel",
    ],
  },
  {
    aisle: "BOULANGERIE",
    keys: ["pain", "naan", "galette", "toast", "pita", "wrap", "tortilla", "chapati"],
  },
  {
    aisle: "SURGELÉS",
    keys: ["surgel"],
  },
  {
    aisle: "ÉPICES & CONDIMENTS",
    keys: [
      "tahini",
      "tahin",
      "miso",
      "sauce",
      "vinaigre",
      "vinaigrette",
      "marinade",
      "huile",
      "citron",
      "lime",
      "ail",
      "gingembre",
      "paprika",
      "cumin",
      "curcuma",
      "curry",
      "moutarde",
      "agave",
      "sirop",
      "cacahuete",
      "cacahouete",
      "arachide",
      "herbes",
      "basilic",
      "menthe",
      "persil",
      "aneth",
      "ciboulette",
      "thym",
      "romarin",
      "origan",
      "laurier",
      "sesame",
      "soja",
      "raifort",
      "pesto",
      "pistou",
      "satay",
      "nuoc",
      "pickle",
      "cornichon",
      "sel",
      "poivre",
      "5-epices",
      "cinq epices",
    ],
  },
  {
    aisle: "FRUITS & LÉGUMES",
    keys: [
      "courgette",
      "poivron",
      "concombre",
      "tomate",
      "carotte",
      "oignon",
      "echalote",
      "chou",
      "salade",
      "laitue",
      "roquette",
      "epinard",
      "champignon",
      "pak choi",
      "avocat",
      "patate",
      "pomme de terre",
      "betterave",
      "brocoli",
      "aubergine",
      "poireau",
      "haricot vert",
      "celeri",
      "navet",
      "panais",
      "radis",
      "asperge",
      "petit pois",
      "petits pois",
      "banane",
      "pomme",
      "poire",
      "fenouil",
      "courge",
      "butternut",
      "potiron",
    ],
  },
  {
    aisle: "ÉPICERIE SALÉE",
    keys: [
      "riz",
      "quinoa",
      "lentille",
      "pois chiche",
      "semoule",
      "couscous",
      "boulgour",
      "penne",
      "pates",
      "tagliatelle",
      "spaghetti",
      "lasagne",
      "orzo",
      "sarrasin",
      "vermicelle",
      "nouille",
      "konjac",
      "olive",
      "avoine",
      "flocon",
      "granola",
      "bouillon",
      "conserve",
      "haricot blanc",
      "haricot rouge",
      "pois casse",
      "graine",
    ],
  },
];

export function aisleFor(name: string): AisleName {
  const key = fold(name);
  for (const rule of AISLE_RULES) {
    if (rule.keys.some((token) => key.includes(fold(token)))) return rule.aisle;
  }
  return "AUTRE";
}

export function formatQty(grams: number) {
  if (grams <= 0) return "";
  if (grams >= 1000 && grams % 1000 === 0) return `${grams / 1000}kg`;
  if (grams >= 2000) {
    const kg = grams / 1000;
    const label = Number.isInteger(kg) ? String(kg) : kg.toFixed(1).replace(".", ",");
    return `${label}kg`;
  }
  return `${Math.round(grams)}g`;
}

/** Produit à acheter : sans découpe, marinade, ni nom de plat. */
const SHOP_CANON: Array<{ keys: string[]; name: string }> = [
  { keys: ["tomates cerises", "tomate cerise"], name: "Tomates cerises" },
  { keys: ["tofu soyeux"], name: "Tofu soyeux" },
  { keys: ["tofu fume"], name: "Tofu fumé" },
  { keys: ["tofu ferme", "tofu"], name: "Tofu ferme" },
  { keys: ["huile d olive", "huile olive"], name: "Huile d'olive" },
  { keys: ["huile de sesame", "huile sesame"], name: "Huile de sésame" },
  { keys: ["sauce soja"], name: "Sauce soja" },
  { keys: ["sirop d agave", "agave"], name: "Sirop d'agave" },
  { keys: ["citron vert"], name: "Citron vert" },
  { keys: ["patate douce"], name: "Patate douce" },
  { keys: ["pomme de terre"], name: "Pomme de terre" },
  { keys: ["haricot vert"], name: "Haricots verts" },
  { keys: ["chou rouge"], name: "Chou rouge" },
  { keys: ["oignon rouge"], name: "Oignon rouge" },
  { keys: ["oignon nouveau"], name: "Oignon nouveau" },
  { keys: ["falafel"], name: "Falafels" },
  { keys: ["pois chiche"], name: "Pois chiches" },
  { keys: ["yaourt soja"], name: "Yaourt soja" },
  { keys: ["yaourt grec"], name: "Yaourt grec" },
  { keys: ["feta vegetale"], name: "Feta végétale" },
  { keys: ["mozzarella vegan", "mozza vegan"], name: "Mozzarella vegan" },
  { keys: ["fromage vegan", "parmesan vegan"], name: "Fromage vegan" },
  { keys: ["pain complet"], name: "Pain complet" },
  { keys: ["galette"], name: "Galette" },
  { keys: ["cacahuete", "cacahouete", "arachide"], name: "Cacahuètes" },
  { keys: ["graines de courge", "graine de courge"], name: "Graines de courge" },
  { keys: ["graines de sesame", "graine de sesame"], name: "Graines de sésame" },
  { keys: ["paprika"], name: "Paprika" },
  { keys: ["carotte"], name: "Carotte" },
  { keys: ["courgette"], name: "Courgette" },
  { keys: ["concombre"], name: "Concombre" },
  { keys: ["poivron"], name: "Poivron" },
  { keys: ["tomate"], name: "Tomate" },
  { keys: ["oignon"], name: "Oignon" },
  { keys: ["aubergine"], name: "Aubergine" },
  { keys: ["betterave"], name: "Betterave" },
  { keys: ["brocoli"], name: "Brocoli" },
  { keys: ["champignon"], name: "Champignons" },
  { keys: ["avocat"], name: "Avocat" },
  { keys: ["roquette"], name: "Roquette" },
  { keys: ["epinard"], name: "Épinards" },
  { keys: ["salade", "laitue"], name: "Salade" },
  { keys: ["pak choi", "pakchoi"], name: "Pak choi" },
  { keys: ["poireau"], name: "Poireau" },
  { keys: ["menthe"], name: "Menthe" },
  { keys: ["persil"], name: "Persil" },
  { keys: ["basilic"], name: "Basilic" },
  { keys: ["ciboulette"], name: "Ciboulette" },
  { keys: ["aneth"], name: "Aneth" },
  { keys: ["thym"], name: "Thym" },
  { keys: ["ail"], name: "Ail" },
  { keys: ["gingembre"], name: "Gingembre" },
  { keys: ["citron"], name: "Citron" },
  { keys: ["blanc de poulet", "filet de poulet", "cuisse de poulet", "poulet"], name: "Poulet" },
  { keys: ["dinde"], name: "Dinde" },
  { keys: ["boeuf"], name: "Bœuf" },
  { keys: ["crevette"], name: "Crevettes" },
  { keys: ["thon"], name: "Thon" },
  { keys: ["cabillaud"], name: "Cabillaud" },
  { keys: ["jambon"], name: "Jambon" },
  { keys: ["oeuf"], name: "Œufs" },
  { keys: ["edamame"], name: "Edamame" },
  { keys: ["lentille"], name: "Lentilles" },
  { keys: ["quinoa"], name: "Quinoa" },
  { keys: ["riz"], name: "Riz" },
  { keys: ["semoule"], name: "Semoule" },
  { keys: ["orzo"], name: "Orzo" },
  { keys: ["penne", "pates"], name: "Pâtes" },
  { keys: ["vermicelle", "nouille"], name: "Nouilles" },
  { keys: ["sarrasin"], name: "Sarrasin" },
  { keys: ["konjac"], name: "Konjac" },
  { keys: ["olive"], name: "Olives" },
  { keys: ["naan"], name: "Naan" },
  { keys: ["moutarde"], name: "Moutarde" },
  { keys: ["beurre de sesame", "tahini", "tahin"], name: "Tahini" },
  { keys: ["cumin"], name: "Cumin" },
  { keys: ["feta"], name: "Feta" },
  { keys: ["mozza"], name: "Mozzarella" },
  { keys: ["ricotta"], name: "Ricotta" },
  { keys: ["yaourt"], name: "Yaourt" },
  { keys: ["huile"], name: "Huile" },
];

const PREP_WORDS = [
  "julienne",
  "rape fin",
  "rapee",
  "rapees",
  "rape",
  "lamelles",
  "lamelle",
  "marinee",
  "marines",
  "marine",
  "rotie",
  "rotis",
  "roti",
  "cuite",
  "cuits",
  "cuit",
  "grillee",
  "grille",
  "emincee",
  "emince",
  "ciselee",
  "cisele",
  "quartiers",
  "rondelles",
  "tranches",
  "airfryer",
  "restes",
  "scramble",
  "yassa",
  "marinade",
  "chermoula",
  "lemongrass",
  "decortiques",
  "egouttes",
  "au naturel",
  "hachee",
  "hache",
  "fraiche",
  "frais",
  "toasté",
  "toaste",
];

function titleCaseFr(value: string) {
  return value
    .split(/\s+/)
    .map((word, index) => {
      if (index > 0 && /^(d|de|du|des|l|la|le|les)$/i.test(word)) return word.toLowerCase();
      return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
    })
    .join(" ");
}

function stripPrepWords(raw: string) {
  let stripped = fold(raw).split(",")[0] ?? fold(raw);
  for (const word of [...PREP_WORDS].sort((a, b) => b.length - a.length)) {
    stripped = stripped.replace(new RegExp(`\\b${fold(word)}\\b`, "g"), " ");
  }
  return stripped.replace(/[-–]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenIndex(key: string, needle: string) {
  let from = 0;
  while (from <= key.length) {
    const idx = key.indexOf(needle, from);
    if (idx < 0) return -1;
    const beforeOk = idx === 0 || /[^a-z0-9]/.test(key.charAt(idx - 1));
    const after = idx + needle.length;
    const next = key.charAt(after);
    const afterOk =
      !next ||
      /[^a-z0-9]/.test(next) ||
      (next === "s" && (!key.charAt(after + 1) || /[^a-z0-9]/.test(key.charAt(after + 1))));
    if (beforeOk && afterOk) return idx;
    from = idx + 1;
  }
  return -1;
}

function pickCanonName(raw: string, startOnly: boolean) {
  const key = fold(raw);
  let best: { name: string; index: number; len: number } | null = null;
  for (const row of SHOP_CANON) {
    for (const token of row.keys) {
      const needle = fold(token);
      if (needle.length < 3) continue;
      const index = tokenIndex(key, needle);
      if (index < 0) continue;
      if (startOnly && index !== 0) continue;
      if (
        !best ||
        index < best.index ||
        (index === best.index && needle.length > best.len)
      ) {
        best = { name: row.name, index, len: needle.length };
      }
    }
  }
  return best?.name;
}

export function shoppingDisplayName(raw: string) {
  const fromStart = pickCanonName(raw, true);
  if (fromStart) return fromStart;
  const stripped = stripPrepWords(raw);
  return (
    pickCanonName(stripped, true) ??
    pickCanonName(stripped, false) ??
    pickCanonName(raw, false) ??
    (stripped ? titleCaseFr(stripped) : raw.trim())
  );
}

function visualUnitKey(unit: string) {
  const first = fold(unit)
    .split(/[·,]/)[0]
    ?.trim() ?? "";
  return first
    .replace(/pieces?\b/g, "piece")
    .replace(/gousses?\b/g, "gousse")
    .replace(/bottes?\b/g, "botte")
    .replace(/barquettes?\b/g, "barquette")
    .replace(/blocs?\b/g, "bloc")
    .replace(/s\b/g, "")
    .trim();
}

function formatMergedVisual(amount: number, unitKey: string) {
  const countable = /piece|gousse|botte|barquette|bloc|chou/.test(unitKey);
  const rounded = countable ? Math.max(1, Math.round(amount)) : amount;
  const qty =
    Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace(".", ",");
  if (unitKey === "piece") return rounded > 1 ? `${qty} pièces` : `${qty} pièce`;
  if (unitKey === "gousse") return rounded > 1 ? `${qty} gousses` : `${qty} gousse`;
  if (unitKey === "botte") return `${qty} botte`;
  if (unitKey === "barquette") return `${qty} barquette`;
  if (unitKey === "bloc") return rounded > 1 ? `${qty} blocs` : `${qty} bloc`;
  if (unitKey === "chou") return `${qty} chou`;
  return `${qty} ${unitKey}`;
}

function shoppingVisualOf(ing: { visualQuantity?: string; notes?: string }) {
  if (ing.visualQuantity?.trim()) return ing.visualQuantity.split(/[·,]/)[0]?.trim();
  const notes = ing.notes?.trim() ?? "";
  const hit = notes.match(
    /(\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?)\s*(pièces?|piece|botte|gousse|barquette|bloc|chou)\b/i,
  );
  return hit?.[0];
}

export function shoppingItemsFromPlan(plan: PlannedMeal[]): ShoppingListItem[] {
  const tagsByMeal = planTagByMealId(plan);
  const merged = new Map<
    string,
    {
      name: string;
      aisle: AisleName;
      gramsAlexis: number;
      gramsElodie: number;
      tags: string[];
      visualByUnit: Map<string, { amount: number; unit: string }>;
    }
  >();

  for (const meal of plan) {
    if (isEmptyMeal(meal)) continue;
    const tag = tagsByMeal.get(meal.id);
    for (const ing of meal.ingredients) {
      if (isUnlistedShoppingIng(ing.name)) continue;
      const name = shoppingDisplayName(ing.name);
      const id = fold(name);
      const current = merged.get(id) ?? {
        name,
        aisle: aisleFor(name),
        gramsAlexis: 0,
        gramsElodie: 0,
        tags: [] as string[],
        visualByUnit: new Map(),
      };
      current.gramsAlexis += ing.gramsAlexis;
      current.gramsElodie += ing.gramsElodie;
      if (tag && !current.tags.includes(tag)) current.tags.push(tag);
      const parsed = parseVisualQuantity(shoppingVisualOf(ing));
      if (parsed?.unit) {
        const unitKey = visualUnitKey(parsed.unit);
        const prev = current.visualByUnit.get(unitKey);
        current.visualByUnit.set(unitKey, {
          amount: (prev?.amount ?? 0) + parsed.amount,
          unit: parsed.unit.replace(/s$/i, ""),
        });
      }
      merged.set(id, current);
    }
  }

  return Array.from(merged.entries())
    .map(([id, item]) => {
      const total = item.gramsAlexis + item.gramsElodie;
      const visuals = [...item.visualByUnit.values()];
      const visual =
        visuals.length === 1
          ? formatMergedVisual(visuals[0].amount, visualUnitKey(visuals[0].unit))
          : visualForIngredient(item.name, total);
      const tags = [...item.tags].sort((a, b) => Number(a.replace(/\D/g, "")) - Number(b.replace(/\D/g, "")));
      return {
        id: `shop:${id}`,
        name: item.name,
        aisle: item.aisle,
        quantityLabel: formatIngredientLine({
          name: item.name,
          grams: total,
          visual,
          tags,
          approxVisual: true,
        }),
        gramsAlexis: item.gramsAlexis,
        gramsElodie: item.gramsElodie,
        visualQuantity: visual,
        planTags: tags,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

export function groupShoppingItems(items: ShoppingListItem[]) {
  return AISLE_ORDER.map((aisle) => ({
    aisle,
    items: items.filter((item) => item.aisle === aisle),
  })).filter((group) => group.items.length > 0);
}

export function shoppingListPlainText(items: ShoppingListItem[]) {
  return groupShoppingItems(items)
    .map((group) => {
      const lines = group.items.map((item) =>
        item.custom
          ? [item.name, item.quantityLabel].filter(Boolean).join(" ")
          : item.quantityLabel || item.name,
      );
      return `${group.aisle}\n${lines.join("\n")}`;
    })
    .join("\n\n");
}
