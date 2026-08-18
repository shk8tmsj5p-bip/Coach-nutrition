import { weightHistory } from "@/lib/mock-data";
import { addDaysISO, todayISO } from "@/lib/dates";
import type { Pesee, ProfileId, SundayJournalFields } from "@/lib/types";
import { movingAverage } from "@/lib/utils";

export const MILESTONES = [25, 50, 75, 100] as const;

export function seedPesees(profileId: ProfileId): Pesee[] {
  const rows = weightHistory.map((row) => ({
    id: `seed-${profileId}-${row.date}`,
    profileId,
    date: row.date,
    poids: profileId === "alexis" ? row.alexisKg : row.elodieKg,
    masseGrasse: (profileId === "alexis" ? row.alexisFatPct : row.elodieFatPct) ?? null,
    masseMusculaire: (profileId === "alexis" ? row.alexisMuscleKg : row.elodieMuscleKg) ?? null,
    tourTaille: null,
    bmi: null,
    journalNotes: null as string | null,
  }));

  const samples =
    profileId === "alexis"
      ? [
          {
            date: "2026-07-20",
            notes: {
              mood: "Semaine chargée, un peu de faim le soir",
              wins: "3 sorties vélo",
              blockers: "Coucher tard",
              hunger: 4,
              energy: 3,
              fatigue: 4,
            },
          },
          {
            date: "2026-08-03",
            notes: {
              mood: "Stable",
              wins: "Protéines tenues 5/7",
              blockers: "Resto mercredi",
              hunger: 3,
              energy: 4,
              fatigue: 2,
            },
          },
          {
            date: "2026-08-10",
            notes: {
              mood: "Bonne énergie",
              wins: "4 sorties vélo",
              blockers: "Léger plateau balance",
              hunger: 3,
              energy: 4,
              fatigue: 3,
            },
          },
        ]
      : [
          {
            date: "2026-07-20",
            notes: {
              mood: "Fatigue accumulée",
              wins: "2 runs",
              blockers: "Sommeil court",
              hunger: 3,
              energy: 2,
              fatigue: 4,
            },
          },
          {
            date: "2026-08-03",
            notes: {
              mood: "Mieux",
              wins: "Hydratation",
              blockers: "En-cas tardif 1 soir",
              hunger: 2,
              energy: 4,
              fatigue: 2,
            },
          },
          {
            date: "2026-08-10",
            notes: {
              mood: "Bonne énergie, sommeil OK",
              wins: "3 runs, 0 snacking tardif",
              blockers: "Plateau 4 jours — patience",
              hunger: 2,
              energy: 4,
              fatigue: 2,
            },
          },
        ];

  for (const sample of samples) {
    const hit = rows.find((row) => row.date === sample.date);
    if (hit) hit.journalNotes = JSON.stringify(sample.notes);
  }
  return rows;
}

export function sortPesees(rows: Pesee[]) {
  return [...rows].sort((a, b) => a.date.localeCompare(b.date));
}

export function latestPesee(rows: Pesee[]) {
  const withWeight = sortPesees(rows).filter((row) => row.poids != null);
  return withWeight[withWeight.length - 1] ?? null;
}

export function seriesOf(
  rows: Pesee[],
  key: "poids" | "masseGrasse" | "masseMusculaire" | "bmi",
) {
  return sortPesees(rows)
    .filter((row) => row[key] != null)
    .map((row) => ({ date: row.date, value: row[key] as number }));
}

export function withMovingAverages(points: { date: string; value: number }[]) {
  const values = points.map((point) => point.value);
  const ma7 = movingAverage(values, 7);
  const ma14 = movingAverage(values, 14);
  return points.map((point, index) => ({
    date: point.date,
    value: point.value,
    ma7: Number(ma7[index].toFixed(2)),
    ma14: Number(ma14[index].toFixed(2)),
  }));
}

export type TrendRange = "14d" | "1m" | "3m" | "all";

export const TREND_RANGES: { id: TrendRange; label: string; days: number | null }[] = [
  { id: "14d", label: "14 jours", days: 14 },
  { id: "1m", label: "1 mois", days: 30 },
  { id: "3m", label: "3 mois", days: 90 },
  { id: "all", label: "Tout", days: null },
];

/** Slice after MA are computed on the full series, so 7j/14j stay meaningful at the window start. */
export function sliceLastNDays<T extends { date: string }>(
  points: T[],
  days: number,
  today = todayISO(),
) {
  if (days <= 0 || points.length === 0) return points;
  const from = addDaysISO(today, -(days - 1));
  const sliced = points.filter((point) => point.date >= from);
  return sliced.length >= 2 ? sliced : points.slice(-Math.min(points.length, days));
}

export function sliceTrendRange<T extends { date: string }>(
  points: T[],
  range: TrendRange,
  today = todayISO(),
) {
  const spec = TREND_RANGES.find((item) => item.id === range);
  if (!spec?.days) return points;
  return sliceLastNDays(points, spec.days, today);
}

export function emptyJournal(): SundayJournalFields {
  return { mood: "", wins: "", blockers: "", hunger: 3, energy: 3, fatigue: 3 };
}

export function parseJournalNotes(raw: string | null | undefined): SundayJournalFields {
  if (!raw?.trim()) return emptyJournal();
  try {
    const parsed = JSON.parse(raw) as Partial<SundayJournalFields>;
    if (parsed && typeof parsed === "object") {
      return {
        mood: String(parsed.mood ?? ""),
        wins: String(parsed.wins ?? ""),
        blockers: String(parsed.blockers ?? ""),
        hunger: clampScore(parsed.hunger),
        energy: clampScore(parsed.energy),
        fatigue: clampScore(parsed.fatigue),
      };
    }
  } catch {
    return { ...emptyJournal(), mood: raw };
  }
  return { ...emptyJournal(), mood: raw };
}

function clampScore(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 3;
  return Math.min(5, Math.max(1, Math.round(n)));
}

export function serializeJournalNotes(fields: SundayJournalFields) {
  if (
    !fields.mood.trim() &&
    !fields.wins.trim() &&
    !fields.blockers.trim() &&
    fields.hunger === 3 &&
    fields.energy === 3 &&
    fields.fatigue === 3
  ) {
    return null;
  }
  return JSON.stringify(fields);
}

export function overlayPesees(base: Pesee[], overlay: Pesee[]) {
  const map = new Map(base.map((row) => [row.date, row]));
  for (const row of overlay) {
    map.set(row.date, mergePesee(map.get(row.date), row, row.id));
  }
  return sortPesees([...map.values()]);
}

export function mergePesee(current: Pesee | undefined, patch: Partial<Pesee>, fallbackId: string): Pesee {
  return {
    id: current?.id ?? patch.id ?? fallbackId,
    profileId: (patch.profileId ?? current?.profileId) as ProfileId,
    date: patch.date ?? current?.date ?? "",
    poids: patch.poids !== undefined ? patch.poids : (current?.poids ?? null),
    masseGrasse: patch.masseGrasse !== undefined ? patch.masseGrasse : (current?.masseGrasse ?? null),
    masseMusculaire:
      patch.masseMusculaire !== undefined ? patch.masseMusculaire : (current?.masseMusculaire ?? null),
    tourTaille: patch.tourTaille !== undefined ? patch.tourTaille : (current?.tourTaille ?? null),
    bmi: patch.bmi !== undefined ? patch.bmi : (current?.bmi ?? null),
    journalNotes: patch.journalNotes !== undefined ? patch.journalNotes : (current?.journalNotes ?? null),
  };
}
