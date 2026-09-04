"use client";

import { useEffect, useState } from "react";
import { Bike, Bot, Check, Salad, Sparkles } from "lucide-react";
import { Card, SectionTitle } from "@/components/ui/Card";
import { ScoreGauge } from "@/components/metabolique/ScoreGauge";
import { useProfile } from "@/context/ProfileContext";
import {
  analysisToAppliedPlan,
  applyCoachSportPatches,
  loadCoachAnalysis,
  nutritionApplyRecap,
  persistAppliedCoachPlan,
  persistCoachAnalysis,
  sportApplyRecap,
  syncSharedSportSessions,
  type StoredCoachAnalysis,
} from "@/lib/coach-apply";
import {
  buildCoachContextFromRows,
  coachWeightTrend,
  type CoachWeekPayload,
} from "@/lib/coach-payload";
import { sessionsLast7Days, activityWeekSummary, type CoachActivityDay, type CoachSessionSnapshot } from "@/lib/coach-week-sessions";
import { formatSportPatch, coachHeadline } from "@/lib/gemini/coach-analysis";
import { friendlyLlmWarning } from "@/lib/gemini/flash";
import { requestCoachAnalysis } from "@/lib/gemini/client";
import {
  buildNutritionBlock,
  buildSportSessionDiffs,
  mergeAppliedAdjustments,
  currentNutritionDeltas,
} from "@/lib/coach-adjustments";
import { applyCoachBoostsToLoadedPlan } from "@/lib/coach-plan-sync";
import { mondayOf, todayISO, formatLongDate } from "@/lib/dates";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { fetchDailyFeels, last7DaysRange } from "@/lib/supabase/daily-feel";
import { fetchActivityRange } from "@/lib/supabase/health-logs";
import { hasFeelScore, type DailyFeelEntry } from "@/lib/daily-feel";
import { loadPesees } from "@/lib/supabase/pesees";
import { loadWeekPlan, saveWeekPlan } from "@/lib/supabase/week-plans";
import type { Profile, ProfileId } from "@/lib/types";
import { formatKcal, cn } from "@/lib/utils";
import { isEmptyMeal } from "@/lib/weekly-plan";

export function CoachAnalysisCard({ profile }: { profile: Profile }) {
  const { catalog, updateTargets, updateSportRoutines, updateAppliedAdjustments } = useProfile();
  const [payload, setPayload] = useState<CoachWeekPayload | null>(null);
  const [sessions, setSessions] = useState<CoachSessionSnapshot[]>([]);
  const [activity7d, setActivity7d] = useState<CoachActivityDay[]>([]);
  const [dailyFeels, setDailyFeels] = useState<DailyFeelEntry[]>([]);
  const [stored, setStored] = useState<StoredCoachAnalysis | null>(null);
  const [applyNutrition, setApplyNutrition] = useState(true);
  const [applySport, setApplySport] = useState(true);
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [applyRecap, setApplyRecap] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { rows } = await loadPesees(profile.id);
      if (cancelled) return;
      setPayload(buildCoachContextFromRows(profile, rows));
      const range = last7DaysRange();
      const supabase = createBrowserSupabaseClient();
      const activity = await fetchActivityRange(supabase, profile.id, range.from, range.to);
      if (cancelled) return;
      const weekSessions = sessionsLast7Days(
        profile.id,
        profile.sportRoutine.sessions,
        todayISO(),
        activity.workouts,
      );
      setSessions(weekSessions);
      setActivity7d(activityWeekSummary(activity.days, weekSessions));
      const feels = await fetchDailyFeels(supabase, [profile.id], range.from, range.to);
      if (cancelled) return;
      setDailyFeels(feels.filter((row) => row.profileId === profile.id));
      const loaded = loadCoachAnalysis(profile.id);
      if (loaded?.mock) {
        setStored(null);
      } else if (loaded) {
        loaded.warning = friendlyLlmWarning(loaded.warning);
        setStored(loaded);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile]);

  function flash(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
  }

  async function requestAnalysis() {
    if (!payload) return;
    setBusy(true);
    try {
      const range = last7DaysRange();
      const supabase = createBrowserSupabaseClient();
      const [feels, activity] = await Promise.all([
        fetchDailyFeels(supabase, [profile.id], range.from, range.to),
        fetchActivityRange(supabase, profile.id, range.from, range.to),
      ]);
      setDailyFeels(feels);
      const weekSessions = sessionsLast7Days(
        profile.id,
        profile.sportRoutine.sessions,
        todayISO(),
        activity.workouts,
      );
      setSessions(weekSessions);
      const weekActivity = activityWeekSummary(activity.days, weekSessions);
      setActivity7d(weekActivity);
      const result = await requestCoachAnalysis({
        profile,
        weightTrend7d: coachWeightTrend(payload),
        latestMa7: payload.latestMa7,
        latestMa14: payload.latestMa14,
        plateau: payload.plateau,
        journal: payload.journal,
        recentJournals: payload.recentJournals,
        dailyFeels: feels,
        sessions: weekSessions,
        activity7d: weekActivity,
        currentTargets: profile.targets,
      });
      if (result.mock || !result.analysis) {
        flash(result.error ?? "Le coach n’a pas pu analyser. Réessaie.");
        return;
      }
      const next: StoredCoachAnalysis = {
        profileId: profile.id,
        generatedAt: new Date().toISOString(),
        mock: false,
        warning: friendlyLlmWarning(result.warning),
        analysis: result.analysis,
      };
      persistCoachAnalysis(profile.id, next);
      setStored(next);
      setApplyNutrition(true);
      setApplySport(true);
      setApplyRecap(null);
      flash("Bilan 7 j prêt");
    } catch (error) {
      flash(error instanceof Error ? error.message : "Le coach n’a pas pu analyser. Réessaie.");
    } finally {
      setBusy(false);
    }
  }

  async function applyAdjustments() {
    if (!stored) return;
    if (!applyNutrition && !applySport) {
      flash("Sélectionne au moins Nutrition ou Sport");
      return;
    }
    setApplying(true);
    try {
      let nutritionError: string | null = null;
      let sportError: string | null = null;
      let sportChanged = 0;
      const patches = stored.analysis.sportAdjustments ?? [];
      let changedSessionIds: string[] = [];
      let syncedOther = false;
      let shoppingSkipped = false;
      let planEmpty = false;
      let planChanged = false;
      const otherId: ProfileId = profile.id === "alexis" ? "elodie" : "alexis";

      if (applyNutrition) {
        nutritionError = await updateTargets(profile.id, stored.analysis.targets);
        persistAppliedCoachPlan(analysisToAppliedPlan(profile.id, stored.analysis));
      }

      if (applySport) {
        const { routine, changedSessionIds: ids } = applyCoachSportPatches(
          profile.sportRoutine,
          patches,
        );
        changedSessionIds = ids;
        sportChanged = ids.length;
        if (ids.length > 0) {
          const routines: Partial<Record<ProfileId, typeof routine>> = {
            [profile.id]: routine,
          };
          const otherSynced = syncSharedSportSessions(
            catalog[otherId].sportRoutine,
            routine,
            ids,
          );
          if (otherSynced !== catalog[otherId].sportRoutine) {
            routines[otherId] = otherSynced;
            syncedOther = true;
          }
          sportError = await updateSportRoutines(routines);
        }
      }

      const weekStart = mondayOf(todayISO());
      const nutritionBlock = applyNutrition
        ? buildNutritionBlock(
            profile.targets,
            stored.analysis.targets,
            stored.analysis.trainingDay,
            stored.analysis.nutrition,
          )
        : undefined;
      const sportDiffs =
        applySport && changedSessionIds.length > 0
          ? buildSportSessionDiffs(profile.sportRoutine.sessions, patches, changedSessionIds)
          : applySport
            ? buildSportSessionDiffs(
                profile.sportRoutine.sessions,
                patches,
                profile.sportRoutine.sessions.map((session) => session.id),
              )
            : [];
      const sportBlock = applySport ? { dismissed: false, sessions: sportDiffs } : undefined;

      if (nutritionBlock !== undefined || sportBlock) {
        const nextAdj = mergeAppliedAdjustments(profile.appliedAdjustments, weekStart, {
          ...(nutritionBlock !== undefined ? { nutrition: nutritionBlock } : {}),
          ...(sportBlock ? { sport: sportBlock } : {}),
        });
        await updateAppliedAdjustments(profile.id, nextAdj);
        if (nutritionBlock) {
          const week = await loadWeekPlan(weekStart);
          planEmpty = week.plan.every(isEmptyMeal);
          const synced = applyCoachBoostsToLoadedPlan({
            weekStart,
            plan: week.plan,
            profiles: [
              {
                id: profile.id,
                deltas: nutritionBlock.deltas,
              },
              {
                id: otherId,
                deltas: currentNutritionDeltas(catalog[otherId].appliedAdjustments),
              },
            ],
            force: true,
          });
          if (synced.changed) {
            await saveWeekPlan(weekStart, synced.plan, week.theme);
          }
          shoppingSkipped = synced.skippedShopping;
          planChanged = synced.changed;
        }
      }

      if (syncedOther && sportDiffs.length > 0) {
        const sharedIds = new Set(
          profile.sportRoutine.sessions
            .filter((session) => session.shared && changedSessionIds.includes(session.id))
            .map((session) => session.id),
        );
        const sharedDiffs = sportDiffs.filter((diff) => sharedIds.has(diff.sessionId));
        if (sharedDiffs.length > 0) {
          const otherAdj = mergeAppliedAdjustments(catalog[otherId].appliedAdjustments, weekStart, {
            sport: { dismissed: false, sessions: sharedDiffs },
          });
          await updateAppliedAdjustments(otherId, otherAdj);
        }
      }

      const next: StoredCoachAnalysis = {
        ...stored,
        appliedAt: new Date().toISOString(),
        appliedNutrition: applyNutrition || Boolean(stored.appliedNutrition),
        appliedSport: applySport || Boolean(stored.appliedSport),
      };
      persistCoachAnalysis(profile.id, next);
      setStored(next);
      const recap: string[] = [];
      if (applyNutrition) {
        recap.push(
          ...nutritionApplyRecap({
            shoppingSkipped,
            planEmpty,
            planChanged,
            nutritionError,
          }),
        );
      }
      if (applySport) {
        recap.push(sportApplyRecap({ sportChanged, sportError }));
      }
      setApplyRecap(recap);
      setToast(null);
    } finally {
      setApplying(false);
    }
  }

  const notes = payload?.journal.notes;
  const analysis = stored?.analysis;
  const sportPatches = analysis?.sportAdjustments ?? [];
  const canApply = applyNutrition || applySport;
  const headline = analysis ? coachHeadline(analysis) : null;
  const localLabel = stored?.mock ? friendlyLlmWarning(stored.warning) ?? "Bilan local" : null;

  return (
    <>
      <SectionTitle>Coach IA · 7 jours</SectionTitle>
      <Card>
        {notes && (
          <div className="mb-3 flex justify-around">
            <ScoreGauge label="Faim" mood={notes.hunger} />
            <ScoreGauge label="Motivation" mood={notes.energy} />
            <ScoreGauge label="Fatigue" mood={notes.fatigue} />
          </div>
        )}
        {payload?.plateau && (
          <p className="mb-2 rounded-xl bg-amber-50 px-3 py-2 text-center text-[12px] font-semibold text-amber-800">
            Plateau 7 j détecté
          </p>
        )}
        <p className="text-center text-[12px] text-health-muted">
          {payload?.journal.date
            ? `Journal ${formatLongDate(payload.journal.date)} · Suivi pour le poids et la routine`
            : "Chargement du contexte 7 j…"}
        </p>
        <p className="mt-1 text-center text-[11px] text-health-muted">
          {dailyFeels.filter(hasFeelScore).length > 0
            ? `Check-in Aujourd’hui : ${dailyFeels.filter(hasFeelScore).length} j notés sur 7 · jours sans note ignorés`
            : "Pas encore de check-in quotidien · le coach ignore les jours sans note"}
        </p>
        {activity7d.length > 0 ? (
          <p className="mt-1 text-center text-[11px] text-health-muted">
            Santé 7 j : {activity7d.reduce((sum, day) => sum + day.workoutMinutes, 0)} min exercice · plan{" "}
            {activity7d.reduce((sum, day) => sum + day.plannedMinutes, 0)} min
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => void requestAnalysis()}
          disabled={busy || !payload}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-card bg-health-ink py-3 text-[15px] font-semibold text-white disabled:opacity-50"
        >
          <Bot size={18} />
          {busy ? "Analyse en cours…" : "Demander l'analyse du Coach"}
        </button>
      </Card>

      {analysis && stored && headline && (
        <>
          <SectionTitle>À faire cette semaine</SectionTitle>
          <Card className={cn(headline.tone === "caution" && "border border-amber-200")}>
            {localLabel && (
              <p className="mb-3 text-[11px] font-medium text-health-muted">{localLabel}</p>
            )}
            <p
              className={cn(
                "text-[18px] font-bold leading-snug",
                headline.tone === "caution" && "text-amber-800",
                headline.tone === "ok" && "text-emerald-700",
              )}
            >
              {headline.title}
            </p>
            <p className="mt-2 text-[14px] leading-relaxed text-health-ink">{analysis.analysis}</p>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <DeltaChip
                label="kcal"
                delta={analysis.calorieDelta}
                unit=""
              />
              <DeltaChip label="Prot." delta={analysis.proteinDelta} unit="g" />
              <DeltaChip label="Gluc." delta={analysis.carbsDelta} unit="g" />
            </div>

            <div className="mt-4 space-y-2">
              {analysis.nutrition.slice(0, 3).map((line) => (
                <ActionRow key={line} icon={Salad} tone="coral" text={line} />
              ))}
              {analysis.sport.slice(0, 2).map((line) => (
                <ActionRow key={line} icon={Bike} tone="violet" text={line} />
              ))}
              {sportPatches.map((patch) => (
                <ActionRow
                  key={formatSportPatch(patch)}
                  icon={Bike}
                  tone="violet"
                  text={formatSportPatch(patch)}
                />
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-center">
              <MacroChip
                label="Entraînement"
                calories={analysis.trainingDay.calories}
                protein={analysis.trainingDay.protein}
                carbs={analysis.trainingDay.carbs}
              />
              <MacroChip
                label="Repos"
                calories={analysis.restDay.calories}
                protein={analysis.restDay.protein}
                carbs={analysis.restDay.carbs}
              />
            </div>

            <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-health-muted">
              Appliquer
            </p>
            <div className="mt-2 space-y-2">
              <DomainCheck
                checked={applyNutrition}
                title="Nutrition"
                subtitle="Nouvelles cibles du jour · suggestions sur les repas"
                onChange={setApplyNutrition}
              />
              <DomainCheck
                checked={applySport}
                title="Sport"
                subtitle="Ajuste durée / intensité des séances existantes. Ne crée pas de nouvelles séances."
                onChange={setApplySport}
              />
            </div>

            <button
              type="button"
              onClick={() => void applyAdjustments()}
              disabled={applying || !canApply}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-card bg-health-ink py-3 text-[15px] font-semibold text-white disabled:opacity-50"
            >
              {applying ? <Sparkles size={18} /> : <Check size={18} />}
              {applying ? "Application…" : "Appliquer les ajustements"}
            </button>
            {applyRecap && applyRecap.length > 0 ? (
              <ul className="mt-3 space-y-1">
                {applyRecap.map((line) => (
                  <li key={line} className="text-center text-[12px] leading-snug text-health-muted">
                    {line}
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        </>
      )}

      {toast && (
        <p className="mt-2 text-center text-[12px] font-medium text-health-muted">{toast}</p>
      )}
    </>
  );
}

function ActionRow({
  icon: Icon,
  tone,
  text,
}: {
  icon: typeof Salad;
  tone: "coral" | "violet";
  text: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-2xl px-3 py-2.5",
        tone === "coral" ? "bg-coral-soft" : "bg-violet-soft",
      )}
    >
      <Icon
        size={16}
        className={cn("mt-0.5 shrink-0", tone === "coral" ? "text-coral-dark" : "text-violet-dark")}
      />
      <p className="text-[14px] font-medium leading-snug">{text}</p>
    </div>
  );
}

function DeltaChip({ label, delta, unit }: { label: string; delta: number; unit: string }) {
  const up = delta > 0;
  const flat = delta === 0;
  return (
    <div className="rounded-2xl bg-health-bg px-2 py-2 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-health-muted">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-[16px] font-bold tabular-nums",
          flat && "text-health-ink",
          up && "text-violet-dark",
          !flat && !up && "text-coral-dark",
        )}
      >
        {flat ? "0" : `${up ? "+" : "−"}${Math.abs(delta)}${unit}`}
      </p>
    </div>
  );
}

function DomainCheck({
  checked,
  title,
  subtitle,
  onChange,
}: {
  checked: boolean;
  title: string;
  subtitle: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-3 rounded-2xl bg-health-bg px-3 py-3 text-left"
    >
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] border",
          checked ? "border-health-ink bg-health-ink text-white" : "border-health-line bg-white",
        )}
      >
        {checked ? <Check size={14} strokeWidth={3} /> : null}
      </span>
      <span>
        <span className="block text-[14px] font-semibold">{title}</span>
        <span className="mt-0.5 block text-[12px] leading-relaxed text-health-muted">{subtitle}</span>
      </span>
    </button>
  );
}

function MacroChip({
  label,
  calories,
  protein,
  carbs,
}: {
  label: string;
  calories: number;
  protein: number;
  carbs: number;
}) {
  return (
    <div className="rounded-xl bg-health-bg px-2 py-2">
      <p className="text-[11px] text-health-muted">{label}</p>
      <p className="text-[16px] font-bold tabular-nums">{formatKcal(calories)}</p>
      <p className="text-[11px] text-health-muted">
        P {protein}g · G {carbs}g
      </p>
    </div>
  );
}
