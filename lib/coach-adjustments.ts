import type { Macros, ProfileId, SportActivity, SportEffort, SportSession } from "@/lib/types";
import type { CoachSportPatch } from "@/lib/gemini/coach-analysis";
import { mondayOf, todayISO } from "@/lib/dates";
import { effortLabel } from "@/lib/sport-routine";

export type NutritionDeltas = Macros;

export type AppliedNutrition = {
  dismissed: boolean;
  previous: Macros;
  next: Macros;
  deltas: NutritionDeltas;
  tags: string[];
};

export type SportSessionDiff = {
  sessionId: string;
  activity: SportActivity;
  previousDurationMin: number;
  durationDeltaMin: number;
  previousEffort: SportEffort;
  nextEffort?: SportEffort;
  dismissed?: boolean;
};

export type AppliedSport = {
  dismissed: boolean;
  sessions: SportSessionDiff[];
};

export type AppliedAdjustments = {
  weekStart: string;
  appliedAt: string;
  nutrition: AppliedNutrition | null;
  sport: AppliedSport | null;
};

function asNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asMacros(value: unknown, fallback: Macros): Macros {
  const rec = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    calories: Math.round(asNumber(rec.calories, fallback.calories)),
    protein: Math.round(asNumber(rec.protein, fallback.protein)),
    carbs: Math.round(asNumber(rec.carbs, fallback.carbs)),
    fat: Math.round(asNumber(rec.fat, fallback.fat)),
  };
}

const EMPTY_MACROS: Macros = { calories: 0, protein: 0, carbs: 0, fat: 0 };

function allZero(deltas: NutritionDeltas) {
  return deltas.calories === 0 && deltas.protein === 0 && deltas.carbs === 0 && deltas.fat === 0;
}

export function macroDeltas(previous: Macros, next: Macros): NutritionDeltas {
  return {
    calories: next.calories - previous.calories,
    protein: next.protein - previous.protein,
    carbs: next.carbs - previous.carbs,
    fat: next.fat - previous.fat,
  };
}

export function buildNutritionBlock(
  previous: Macros,
  next: Macros,
  trainingDay?: Macros | null,
  advice: string[] = [],
): AppliedNutrition {
  const targetDeltas = macroDeltas(previous, next);
  const trainingDeltas = trainingDay ? macroDeltas(previous, trainingDay) : EMPTY_MACROS;
  const deltas = allZero(targetDeltas) ? trainingDeltas : targetDeltas;
  const tags = uniqueTags([
    ...nutritionDiffTags(deltas),
    ...advice.filter((line) => /^[+\-−]/.test(line.trim())),
    ...(allZero(deltas) ? advice.slice(0, 2) : []),
  ]);
  return { dismissed: false, previous, next, deltas, tags };
}

function uniqueTags(tags: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of tags) {
    const key = tag.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out.slice(0, 6);
}

export function buildSportSessionDiffs(
  sessions: SportSession[],
  patches: CoachSportPatch[],
  changedIds: string[],
): SportSessionDiff[] {
  return sessions
    .filter((session) => changedIds.includes(session.id))
    .map((session) => {
      const patch = patches.find(
        (item) =>
          item.activity === session.activity && (!item.effort || item.effort === session.effort),
      );
      const nextEffort =
        patch?.nextEffort && patch.nextEffort !== session.effort ? patch.nextEffort : undefined;
      return {
        sessionId: session.id,
        activity: session.activity,
        previousDurationMin: session.durationMin,
        durationDeltaMin: patch?.durationDeltaMin ?? 0,
        previousEffort: session.effort,
        nextEffort,
        dismissed: false,
      };
    })
    .filter((diff) => diff.durationDeltaMin !== 0 || Boolean(diff.nextEffort));
}

export function mergeAppliedAdjustments(
  current: AppliedAdjustments | null | undefined,
  weekStart: string,
  patch: { nutrition?: AppliedNutrition | null; sport?: AppliedSport | null },
): AppliedAdjustments {
  const sameWeek = current?.weekStart === weekStart;
  return {
    weekStart,
    appliedAt: todayISO(),
    nutrition:
      patch.nutrition !== undefined
        ? patch.nutrition
        : sameWeek
          ? (current?.nutrition ?? null)
          : null,
    sport:
      patch.sport !== undefined
        ? patch.sport
        : sameWeek
          ? (current?.sport ?? null)
          : null,
  };
}

export function isCurrentWeek(adj: AppliedAdjustments | null | undefined, today = todayISO()) {
  return Boolean(adj && adj.weekStart === mondayOf(today));
}

export function visibleNutrition(adj: AppliedAdjustments | null | undefined) {
  if (!isCurrentWeek(adj) || !adj?.nutrition || adj.nutrition.dismissed) return null;
  return adj.nutrition;
}

/** Cibles de la semaine encore actives, même si le badge Tab 1 a été masqué. */
export function currentNutritionDeltas(adj: AppliedAdjustments | null | undefined) {
  if (!isCurrentWeek(adj) || !adj?.nutrition) return null;
  return adj.nutrition.deltas;
}

export function hasSportHighlights(adj: AppliedAdjustments | null | undefined) {
  if (!isCurrentWeek(adj) || !adj?.sport || adj.sport.dismissed) return false;
  return true;
}

export function visibleSportDiff(
  adj: AppliedAdjustments | null | undefined,
  sessionId: string,
  activity?: SportActivity,
) {
  if (!isCurrentWeek(adj) || !adj?.sport || adj.sport.dismissed) return null;
  const diff =
    adj.sport.sessions.find((item) => item.sessionId === sessionId && !item.dismissed) ??
    adj.sport.sessions.find((item) => activity && item.activity === activity && !item.dismissed);
  if (!diff) return null;
  if (diff.durationDeltaMin === 0 && !diff.nextEffort && sportDiffTags(diff).length === 0) {
    return diff;
  }
  return diff;
}

export function nutritionDiffTags(deltas: NutritionDeltas): string[] {
  const tags: string[] = [];
  if (deltas.calories) tags.push(`${signed(deltas.calories)} kcal`);
  if (deltas.protein) tags.push(`${signed(deltas.protein)}g protéines`);
  if (deltas.carbs) tags.push(`${signed(deltas.carbs)}g glucides`);
  if (deltas.fat) tags.push(`${signed(deltas.fat)}g lipides`);
  return tags;
}

export function sportDiffTags(diff: SportSessionDiff): string[] {
  const tags: string[] = [];
  if (diff.durationDeltaMin) tags.push(`${signed(diff.durationDeltaMin)} min durée`);
  if (diff.nextEffort && diff.nextEffort !== diff.previousEffort) {
    const label = effortLabel(diff.nextEffort);
    const lighter =
      diff.nextEffort === "zone-2" ||
      diff.previousEffort === "fractionne" ||
      (diff.previousEffort === "circuit-hiit" && diff.nextEffort === "force");
    tags.push(lighter ? `Intensité allégée ${label}` : `Intensité ${label}`);
  }
  return tags;
}

function signed(value: number) {
  const sign = value > 0 ? "+" : "−";
  return `${sign}${Math.abs(Math.round(value))}`;
}

export function dismissNutrition(adj: AppliedAdjustments): AppliedAdjustments {
  if (!adj.nutrition) return adj;
  return { ...adj, nutrition: { ...adj.nutrition, dismissed: true } };
}

export function dismissSport(adj: AppliedAdjustments): AppliedAdjustments {
  if (!adj.sport) return adj;
  return { ...adj, sport: { ...adj.sport, dismissed: true } };
}

export function dismissSportSession(adj: AppliedAdjustments, sessionId: string): AppliedAdjustments {
  if (!adj.sport) return adj;
  const sessions = adj.sport.sessions.map((item) =>
    item.sessionId === sessionId ? { ...item, dismissed: true } : item,
  );
  const allGone = sessions.every((item) => item.dismissed);
  return {
    ...adj,
    sport: { sessions, dismissed: allGone || adj.sport.dismissed },
  };
}

export function parseAppliedAdjustments(value: unknown): AppliedAdjustments | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  const weekStart = typeof rec.weekStart === "string" ? rec.weekStart : "";
  if (!weekStart) return null;

  let nutrition: AppliedNutrition | null = null;
  if (rec.nutrition && typeof rec.nutrition === "object") {
    const n = rec.nutrition as Record<string, unknown>;
    const previous = asMacros(n.previous, EMPTY_MACROS);
    const next = asMacros(n.next, EMPTY_MACROS);
    nutrition = {
      dismissed: Boolean(n.dismissed),
      previous,
      next,
      deltas: asMacros(n.deltas, macroDeltas(previous, next)),
      tags: Array.isArray(n.tags)
        ? n.tags.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        : [],
    };
    if (nutrition.tags.length === 0) {
      nutrition.tags = nutritionDiffTags(nutrition.deltas);
    }
  }

  let sport: AppliedSport | null = null;
  if (rec.sport && typeof rec.sport === "object") {
    const s = rec.sport as Record<string, unknown>;
    const sessions = Array.isArray(s.sessions)
      ? s.sessions
          .map(parseSportDiff)
          .filter((item): item is SportSessionDiff => item != null)
      : [];
    sport = { dismissed: Boolean(s.dismissed), sessions };
  }

  return {
    weekStart,
    appliedAt: typeof rec.appliedAt === "string" ? rec.appliedAt : weekStart,
    nutrition,
    sport,
  };
}

function parseSportDiff(value: unknown): SportSessionDiff | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  if (typeof rec.sessionId !== "string") return null;
  const activity = rec.activity;
  if (activity !== "course" && activity !== "velo" && activity !== "muscu") return null;
  const previousEffort = rec.previousEffort;
  const nextEffort = rec.nextEffort;
  const efforts: SportEffort[] = [
    "fractionne",
    "sortie-longue",
    "endurance",
    "zone-2",
    "circuit-hiit",
    "force",
  ];
  if (typeof previousEffort !== "string" || !efforts.includes(previousEffort as SportEffort)) {
    return null;
  }
  return {
    sessionId: rec.sessionId,
    activity,
    previousDurationMin: asNumber(rec.previousDurationMin),
    durationDeltaMin: asNumber(rec.durationDeltaMin),
    previousEffort: previousEffort as SportEffort,
    nextEffort:
      typeof nextEffort === "string" && efforts.includes(nextEffort as SportEffort)
        ? (nextEffort as SportEffort)
        : undefined,
    dismissed: Boolean(rec.dismissed),
  };
}

export function adjustmentsToJson(value: AppliedAdjustments | null) {
  return value;
}

export type HouseholdAppliedAdjustments = Partial<Record<ProfileId, AppliedAdjustments>>;
