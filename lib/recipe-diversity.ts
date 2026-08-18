const STOP = new Set([
  "les",
  "des",
  "une",
  "aux",
  "avec",
  "pour",
  "dans",
  "plus",
  "bowl",
  "salade",
  "sauce",
  "maison",
  "frais",
  "legumes",
  "légumes",
]);

export const MOTIFS = [
  "chermoula",
  "yassa",
  "zaalouk",
  "mafé",
  "mafe",
  "ras el hanout",
  "couscous",
  "semoule",
  "gazpacho",
  "satay",
  "miso",
  "pesto",
  "houmous",
  "nuoc",
  "bo bun",
  "wrap",
  "orzo",
  "quinoa",
  "teriyaki",
  "tahini",
  "zaatar",
  "attieke",
  "kefta",
  "bibimbap",
  "japchae",
  "namul",
  "kimbap",
];

export function normalizeTitle(title: string) {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function fingerprint(title: string) {
  return normalizeTitle(title)
    .split(" ")
    .filter((token) => token.length > 2 && !STOP.has(token))
    .slice(0, 8)
    .join(" ");
}

export function titlesTooClose(a: string, b: string) {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const fa = new Set(fingerprint(a).split(" ").filter(Boolean));
  const fb = fingerprint(b).split(" ").filter(Boolean);
  if (fa.size === 0 || fb.length === 0) return false;
  const overlap = fb.filter((token) => fa.has(token)).length;
  const ratio = overlap / Math.min(fa.size, fb.length);
  return overlap >= 3 || ratio >= 0.6;
}

export function motifsIn(title: string) {
  const n = normalizeTitle(title);
  return MOTIFS.filter((motif) => n.includes(normalizeTitle(motif)));
}

export function diversityProblems(titles: string[], past: string[] = []) {
  const problems: string[] = [];
  const clean = titles.map((title) => title.trim()).filter(Boolean);
  for (let i = 0; i < clean.length; i += 1) {
    for (let j = i + 1; j < clean.length; j += 1) {
      if (titlesTooClose(clean[i], clean[j])) {
        problems.push(`doublon interne « ${clean[i]} » / « ${clean[j]} »`);
      }
    }
    const hit = past.find((item) => titlesTooClose(clean[i], item));
    if (hit) problems.push(`déjà servi « ${clean[i]} » (proche de « ${hit} »)`);
  }
  const motifCount = new Map<string, number>();
  for (const title of clean) {
    for (const motif of motifsIn(title)) {
      motifCount.set(motif, (motifCount.get(motif) ?? 0) + 1);
    }
  }
  for (const [motif, count] of motifCount) {
    if (count >= 2) problems.push(`famille « ${motif} » répétée ×${count}`);
  }
  return [...new Set(problems)];
}

export function pickUnused<T extends { baseName: string }>(
  pool: T[],
  used: string[],
  nonce: number,
  index: number,
): T | undefined {
  const fresh = pool.filter((item) => !used.some((title) => titlesTooClose(item.baseName, title)));
  if (fresh.length === 0) return undefined;
  return fresh[Math.abs(nonce + index * 5) % fresh.length];
}
