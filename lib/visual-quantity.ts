function formatGrams(grams: number) {
  if (grams <= 0) return "";
  if (grams >= 1000 && grams % 1000 === 0) return `${grams / 1000}kg`;
  if (grams >= 2000) {
    const kg = grams / 1000;
    const label = Number.isInteger(kg) ? String(kg) : kg.toFixed(1).replace(".", ",");
    return `${label}kg`;
  }
  return `${Math.round(grams)}g`;
}

export function parseVisualQuantity(raw?: string | null) {
  if (!raw?.trim()) return null;
  const text = raw.trim();
  const prefix = /^(env\.?|environ)\s+/i.test(text) ? "env. " : "";
  const rest = text.replace(/^(env\.?|environ)\s+/i, "").trim();
  const frac = rest.match(/^(\d+)\s*\/\s*(\d+)\s*(.*)$/);
  if (frac) {
    return {
      amount: Number(frac[1]) / Number(frac[2]),
      unit: frac[3].trim() || "pièce",
      prefix,
    };
  }
  const num = rest.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (num) {
    return {
      amount: Number(num[1].replace(",", ".")),
      unit: num[2].trim(),
      prefix,
    };
  }
  return { amount: 1, unit: rest, prefix };
}

function formatAmount(value: number, unit: string) {
  if (Math.abs(value - 0.25) < 0.04) return "1/4";
  if (Math.abs(value - 0.5) < 0.04) return "1/2";
  if (Math.abs(value - 0.75) < 0.04) return "3/4";
  if (/pi[eè]ce|barquette|botte|citron|avocat|oignon|courgette|poivron/i.test(unit)) {
    return String(Math.max(1, Math.round(value)));
  }
  if (/^(cc|cs)$/i.test(unit.trim())) {
    if (Math.abs(value - 0.25) < 0.08) return "1/4";
    if (Math.abs(value - 0.5) < 0.12) return "1/2";
    if (Math.abs(value - 1.5) < 0.2) return "1,5";
    if (Math.abs(value - Math.round(value)) < 0.2) return String(Math.round(value));
  }
  if (Math.abs(value - Math.round(value)) < 0.08) return String(Math.round(value));
  return value.toFixed(1).replace(".", ",");
}

export function scaleVisualQuantity(raw: string | undefined, scale: number) {
  if (!raw) return undefined;
  if (!Number.isFinite(scale) || scale <= 0 || Math.abs(scale - 1) < 0.08) {
    return raw.trim();
  }
  const parsed = parseVisualQuantity(raw);
  if (!parsed) return raw.trim();
  const amount = formatAmount(parsed.amount * scale, parsed.unit);
  const prefix = parsed.prefix || (scale > 1.05 ? "env. " : "");
  return `${prefix}${amount}${parsed.unit ? ` ${parsed.unit}` : ""}`.replace(/\s+/g, " ").trim();
}

export function formatVisualAndWeight(
  grams: number,
  visual?: string,
  opts?: { approx?: boolean },
) {
  const weight = formatGrams(grams);
  let label = visual?.trim() ?? "";
  if (opts?.approx && label && !/^(env\.?|environ)\b/i.test(label)) {
    label = `env. ${label}`;
  }
  if (label && weight) return `${label} (${weight})`;
  return weight || label;
}

/** @deprecated Use formatVisualAndWeight — kept for callers that still pass grams-first. */
export function formatWeightAndVisual(
  grams: number,
  visual?: string,
  opts?: { approx?: boolean },
) {
  return formatVisualAndWeight(grams, visual, opts);
}

const PRODUCE_UNITS: { keys: string[]; unit: string; gramsPer: number }[] = [
  { keys: ["tomates cerises", "tomate cerise"], unit: "barquette", gramsPer: 250 },
  { keys: ["courgette"], unit: "pièce", gramsPer: 200 },
  { keys: ["concombre"], unit: "pièce", gramsPer: 300 },
  { keys: ["carotte"], unit: "pièce", gramsPer: 80 },
  { keys: ["poivron"], unit: "pièce", gramsPer: 160 },
  { keys: ["tomate"], unit: "pièce", gramsPer: 120 },
  { keys: ["oignon"], unit: "pièce", gramsPer: 100 },
  { keys: ["avocat"], unit: "pièce", gramsPer: 150 },
  { keys: ["citron vert", "lime"], unit: "pièce", gramsPer: 70 },
  { keys: ["citron"], unit: "pièce", gramsPer: 90 },
  { keys: ["pamplemousse"], unit: "pièce", gramsPer: 280 },
  { keys: ["chou"], unit: "chou", gramsPer: 800 },
  { keys: ["menthe", "basilic", "persil", "ciboulette", "aneth"], unit: "botte", gramsPer: 30 },
  { keys: ["radis"], unit: "botte", gramsPer: 150 },
  { keys: ["ail"], unit: "gousse", gramsPer: 5 },
  { keys: ["gingembre"], unit: "cm", gramsPer: 8 },
  { keys: ["champignon"], unit: "barquette", gramsPer: 250 },
  { keys: ["tofu"], unit: "bloc", gramsPer: 400 },
  { keys: ["citronnelle"], unit: "tige", gramsPer: 20 },
  { keys: ["pak choi", "pakchoi"], unit: "pièce", gramsPer: 150 },
];

function formatVisualLabel(amount: number, unit: string) {
  const qty = formatAmount(amount, unit);
  if (unit === "chou") return `${qty} chou`;
  if (unit === "cm") return `${qty} cm`;
  if (unit === "pièce" && qty !== "1") return `${qty} pièces`;
  if (unit === "gousse" && qty !== "1") return `${qty} gousses`;
  if (unit === "tige" && qty !== "1") return `${qty} tiges`;
  if (unit === "botte") return `${qty} botte`;
  if (unit === "barquette") return `${qty} barquette`;
  if (unit === "bloc") return `${qty} bloc`;
  return `${qty} ${unit}`.trim();
}

/** Unité courses pour un légume / herbe / protéine en pièces, si Gemini l'a oubliée. */
export function inferVisualUnit(name: string, grams: number) {
  if (!name?.trim() || !Number.isFinite(grams) || grams <= 0) return undefined;
  const n = name.toLowerCase();
  if (/huile|vinaigre|eau|sel|poivre|cumin|paprika|épice|epice|moutarde|tahini|soja|agave|miso/.test(n)) {
    return undefined;
  }
  const hit = PRODUCE_UNITS.find((row) => row.keys.some((key) => n.includes(key)));
  if (!hit) return undefined;
  const amount = Math.max(hit.unit === "chou" ? 0.25 : hit.unit === "cm" ? 1 : 0.25, grams / hit.gramsPer);
  return formatVisualLabel(amount, hit.unit);
}

const SPOON_KINDS: { keys: string[]; gPerCc: number; maxG: number }[] = [
  {
    keys: [
      "cumin",
      "paprika",
      "curcuma",
      "cannelle",
      "ras el hanout",
      "5-épices",
      "cinq-épices",
      "poivre",
      "sel",
      "sumac",
      "zaatar",
      "za'atar",
    ],
    gPerCc: 2,
    maxG: 18,
  },
  {
    keys: ["tahini", "tahin", "moutarde", "miso", "pesto", "beurre de sésame", "beurre de sesame"],
    gPerCc: 6,
    maxG: 40,
  },
  {
    keys: [
      "huile",
      "vinaigre",
      "sauce soja",
      "soja",
      "agave",
      "sirop",
      "eau",
      "nuoc",
    ],
    gPerCc: 5,
    maxG: 30,
  },
];

function formatSpoon(cc: number) {
  if (cc < 2.4) {
    let label = "1 cc";
    if (cc <= 0.35) label = "1/4 cc";
    else if (cc <= 0.7) label = "1/2 cc";
    else if (cc < 1.3) label = "1 cc";
    else if (cc < 1.8) label = "1,5 cc";
    else label = "2 cc";
    return label;
  }
  const cs = cc / 3;
  if (cs < 1.3) return "1 cs";
  if (cs < 1.8) return "1,5 cs";
  return `${Math.max(2, Math.round(cs))} cs`;
}

/** Petits dosages sauces / épices : cc (café) ou cs (soupe), en plus des grammes. */
export function inferSpoonUnit(name: string, grams: number) {
  if (!name?.trim() || !Number.isFinite(grams) || grams <= 0) return undefined;
  const n = name.toLowerCase();
  if (/gousse|botte|pièce|piece|cm\b|bloc|barquette/.test(n)) return undefined;
  const hit = SPOON_KINDS.find((row) => row.keys.some((key) => n.includes(key)));
  if (!hit || grams > hit.maxG) return undefined;
  return formatSpoon(grams / hit.gPerCc);
}

export function visualForIngredient(name: string, grams: number, visual?: string) {
  const given = visual?.trim();
  if (given && /cc|cs|cuill[eè]re|gousse|pièce|piece|botte|cm\b/i.test(given)) return given;
  return inferSpoonUnit(name, grams) || given || inferVisualUnit(name, grams);
}

export function formatIngredientLine(opts: {
  name: string;
  grams: number;
  visual?: string;
  tags?: string[];
  who?: string;
  approxVisual?: boolean;
}) {
  const qty = formatVisualAndWeight(opts.grams, opts.visual, { approx: opts.approxVisual });
  const who = opts.who ? ` · ${opts.who}` : "";
  const tags =
    opts.tags && opts.tags.length > 0 ? ` - [${[...new Set(opts.tags)].join(", ")}]` : "";
  return `${opts.name} : ${qty || "—"}${who}${tags}`;
}
