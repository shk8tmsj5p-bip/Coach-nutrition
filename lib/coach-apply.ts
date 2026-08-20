import type { Macros, ProfileId, SportRoutine, SportSession } from "@/lib/types";
import type { CoachAnalysis, CoachSportPatch } from "@/lib/gemini/coach-analysis";
import { effortAllowed, withSessions } from "@/lib/sport-routine";
import { storage } from "@/lib/storage";
import { todayISO } from "@/lib/dates";

export const COACH_ANALYSIS_KEY = "coach-analysis-last";
export const COACH_APPLIED_KEY = "coach-applied-targets";

export type StoredCoachAnalysis = {
  profileId: ProfileId;
  generatedAt: string;
  mock: boolean;
  warning?: string;
  analysis: CoachAnalysis;
  appliedAt?: string;
  appliedNutrition?: boolean;
  appliedSport?: boolean;
};

export type AppliedCoachPlan = {
  profileId: ProfileId;
  appliedAt: string;
  analysis: string;
  nutrition: string[];
  sport: string[];
  targets: Macros;
  trainingDay: Macros;
  restDay: Macros;
  calorieDelta: number;
};

export type HouseholdCoachBias = Partial<Record<ProfileId, AppliedCoachPlan>>;

export function persistCoachAnalysis(profileId: ProfileId, entry: StoredCoachAnalysis) {
  const all = storage.getJSON<Partial<Record<ProfileId, StoredCoachAnalysis>>>(COACH_ANALYSIS_KEY, {});
  storage.setJSON(COACH_ANALYSIS_KEY, { ...all, [profileId]: entry });
}

export function loadCoachAnalysis(profileId: ProfileId): StoredCoachAnalysis | null {
  const all = storage.getJSON<Partial<Record<ProfileId, StoredCoachAnalysis>>>(COACH_ANALYSIS_KEY, {});
  return all[profileId] ?? null;
}

export function persistAppliedCoachPlan(plan: AppliedCoachPlan) {
  const all = storage.getJSON<HouseholdCoachBias>(COACH_APPLIED_KEY, {});
  storage.setJSON(COACH_APPLIED_KEY, { ...all, [plan.profileId]: plan });
}

export function loadAppliedCoachPlan(profileId: ProfileId): AppliedCoachPlan | null {
  const all = storage.getJSON<HouseholdCoachBias>(COACH_APPLIED_KEY, {});
  return all[profileId] ?? null;
}

export function loadHouseholdCoachBias(): HouseholdCoachBias {
  return storage.getJSON<HouseholdCoachBias>(COACH_APPLIED_KEY, {});
}

export function analysisToAppliedPlan(profileId: ProfileId, analysis: CoachAnalysis): AppliedCoachPlan {
  return {
    profileId,
    appliedAt: todayISO(),
    analysis: analysis.analysis,
    nutrition: analysis.nutrition,
    sport: analysis.sport,
    targets: analysis.targets,
    trainingDay: analysis.trainingDay,
    restDay: analysis.restDay,
    calorieDelta: analysis.calorieDelta,
  };
}

export function formatCoachBiasForPrompt(bias?: HouseholdCoachBias | null): string {
  if (!bias?.alexis && !bias?.elodie) return "";
  const lines: string[] = [];
  for (const id of ["alexis", "elodie"] as const) {
    const plan = bias[id];
    if (!plan) continue;
    const name = id === "alexis" ? "Alexis" : "Élodie";
    lines.push(
      `${name} : moyenne ${plan.targets.calories} kcal · P ${plan.targets.protein}g · G ${plan.targets.carbs}g · L ${plan.targets.fat}g. Jour entraînement ${plan.trainingDay.calories} kcal / ${plan.trainingDay.carbs}g glucides. Jour repos ${plan.restDay.calories} kcal / ${plan.restDay.carbs}g glucides. ${plan.nutrition.slice(0, 3).join(" · ")}`,
    );
  }
  if (!lines.length) return "";
  return `Cibles coach appliquées (respecter portions et packing glucides) :\n${lines.join("\n")}`;
}

function matchesSportPatch(session: SportSession, patch: CoachSportPatch) {
  if (patch.activity !== session.activity) return false;
  if (patch.effort && patch.effort !== session.effort) return false;
  return true;
}

function clampSessionDuration(minutes: number) {
  return Math.max(15, Math.min(240, Math.round(minutes / 5) * 5));
}

export function applyCoachSportPatches(
  routine: SportRoutine,
  patches: CoachSportPatch[] | undefined,
): { routine: SportRoutine; changedSessionIds: string[] } {
  if (!patches?.length) {
    return { routine, changedSessionIds: [] };
  }
  const changedSessionIds: string[] = [];
  const sessions = routine.sessions.map((session) => {
    const patch = patches.find((item) => matchesSportPatch(session, item));
    if (!patch) return session;
    const durationMin = clampSessionDuration(session.durationMin + patch.durationDeltaMin);
    const effort =
      patch.nextEffort && effortAllowed(session.activity, patch.nextEffort)
        ? patch.nextEffort
        : session.effort;
    if (durationMin === session.durationMin && effort === session.effort) return session;
    changedSessionIds.push(session.id);
    return { ...session, durationMin, effort };
  });
  return { routine: withSessions(routine, sessions), changedSessionIds };
}

export function syncSharedSportSessions(
  other: SportRoutine,
  source: SportRoutine,
  changedSessionIds: string[],
): SportRoutine {
  const shared = new Map(
    source.sessions
      .filter((session) => session.shared && changedSessionIds.includes(session.id))
      .map((session) => [session.id, session]),
  );
  if (shared.size === 0) return other;
  const sessions = other.sessions.map((session) => {
    const match = shared.get(session.id);
    if (!match || !session.shared) return session;
    return { ...session, durationMin: match.durationMin, effort: match.effort };
  });
  return withSessions(other, sessions);
}

export function applyToastMessage(opts: {
  nutrition: boolean;
  sport: boolean;
  sportChanged: number;
  nutritionError: string | null;
  sportError: string | null;
}) {
  if (!opts.nutrition && !opts.sport) return "Sélectionne au moins Nutrition ou Sport";
  if (opts.nutrition && !opts.sport) {
    return opts.nutritionError
      ? `Ajustements Nutrition enregistrés en local · ${opts.nutritionError}`
      : "Ajustements Nutrition appliqués avec succès";
  }
  if (!opts.nutrition && opts.sport) {
    if (opts.sportError) return `Ajustements Sport enregistrés en local · ${opts.sportError}`;
    return opts.sportChanged > 0
      ? "Ajustements Sport appliqués avec succès"
      : "Ajustements Sport : routine inchangée (volume conservé)";
  }
  const nutritionOk = !opts.nutritionError;
  const sportOk = !opts.sportError;
  if (nutritionOk && sportOk) {
    return opts.sportChanged > 0
      ? "Ajustements Nutrition et Sport appliqués avec succès"
      : "Ajustements Nutrition appliqués · routine sport inchangée";
  }
  const parts: string[] = [];
  parts.push(
    nutritionOk
      ? "Nutrition appliquée"
      : `Nutrition en local (${opts.nutritionError})`,
  );
  parts.push(
    sportOk
      ? opts.sportChanged > 0
        ? "Sport appliqué"
        : "Sport inchangé"
      : `Sport en local (${opts.sportError})`,
  );
  return parts.join(" · ");
}
