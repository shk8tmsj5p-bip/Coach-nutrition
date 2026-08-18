export const STEP_SECTION_PREFIX = "§ ";

export function isStepSection(line: string) {
  return line.startsWith(STEP_SECTION_PREFIX);
}

export function stepSectionLabel(line: string) {
  return line.startsWith(STEP_SECTION_PREFIX) ? line.slice(STEP_SECTION_PREFIX.length) : line;
}

const AVERSION_RE =
  /beurre de cacahu[eè]te|peanut butter|coriandre|piment fort|piment de cayenne|jalape[nñ]o|pâte de piment|chou-fleur|past[eè]que|fenouil|seitan|tempeh|aversions?\s*:|sans piment|sans beurre|pas de piment|pas de coriandre|pas de fenouil|jamais piment|coriandre exclu|chou-fleur interdit|graines,\s*pas de/i;

export function isAversionMention(line: string) {
  return AVERSION_RE.test(line);
}

export function isFluffLine(line: string) {
  const text = line.trim();
  if (!text) return true;
  if (/tofu/i.test(text) && /jamais|ne pas cuire|non cuit|pas cuit|interdit de cuire/i.test(text)) {
    return true;
  }
  if (isAversionMention(text)) return true;
  if (/\b(sans|pas de)\s+(beurre|piment|coriandre|cacahuète|mangue|fenouil|chou-fleur|seitan|tempeh)\b/i.test(text)) {
    return true;
  }
  return /thème demandé|quantités?\s*=\s*1 repas|quantité pour 1 repas|cuire\s*[×x]2|ne contient pas|exclu(ant|s)|ne pas congeler|wraps?\s+crus?|double déclinaison|rappelle[- ]toi le thème|laver les légumes/i.test(
    text,
  );
}

/** Thermomix : vrai travail (mixer, émulsionner, hacher) — pas « ajouter le cumin ». */
export function isRealTmWork(line: string) {
  return /\d+\s*sec\s*\/\s*v\d|thermomix|\bmixer\b|émuls|emuls|\bhacher\b|gazpacho/i.test(line);
}

/** TM utile : houmous / pesto / vraie émulsion. Pas la moutarde seule. */
export function isWorthTmMix(text: string, ingredientNames: string[] = []) {
  const blob = `${text} ${ingredientNames.join(" ")}`.toLowerCase();
  if (/houmous|hummus|pesto|pistou|gazpacho|velouté|veloute|tahini|tahin|satay|chermoula/.test(blob)) {
    return true;
  }
  const mixable = [
    ...ingredientNames,
    ...(blob.match(/huile|citron|vinaigre|soja|tahini|tahin|ail|gingembre|basilic|menthe|pois chiche|moutarde/gi) ?? []),
  ];
  const unique = [...new Set(mixable.map((name) => name.toLowerCase().split(/\s+/)[0] ?? name))];
  return unique.length >= 3;
}

export function rewriteTmAsHandMix(line: string) {
  return line
    .replace(/\d+\s*sec\s*\/\s*v\d+/gi, "fouetter dans un pot")
    .replace(/\bthermomix\b/gi, "bol")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function isKitchenAidCut(line: string) {
  return /kitchenaid|râpé fin|rape fin|lamelles|spaghettis/i.test(line);
}

/** Tips batch : conservation / pots / frigo uniquement. */
export function isLogisticsTip(line: string | null | undefined) {
  if (!line?.trim() || isFluffLine(line) || isAversionMention(line)) return false;
  return /conserv|pot|frigo|boîte|boite|tupperware|hermétique|hermetique|sauce à part|3 jours|4 jours|réchauff|rechauff|ne mélange|sépar/i.test(
    line,
  );
}

export function stripAversionPhrases(text: string) {
  return text
    .replace(
      /\s*\(([^)]*)\)/g,
      (full, inner: string) => (isAversionMention(inner) || isAversionMention(full) ? "" : full),
    )
    .replace(
      /,?\s*(?:pas de |sans |jamais |interdit[e]? )(?:beurre de cacahu[eè]te|piment(?: fort)?|coriandre|chou-fleur|fenouil|past[eè]que|seitan|tempeh|peanut butter)[^.,;]*/gi,
      "",
    )
    .replace(/\s*[—–-]\s*(?:pas de |sans )[^.]+/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;])/g, "$1")
    .replace(/[·,;:\s]+$/g, "")
    .trim();
}

export function sanitizeCopy(line?: string | null): string | undefined {
  if (!line?.trim()) return undefined;
  const cleaned = stripAversionPhrases(line);
  if (!cleaned || isFluffLine(cleaned) || isAversionMention(cleaned)) return undefined;
  return cleaned;
}
