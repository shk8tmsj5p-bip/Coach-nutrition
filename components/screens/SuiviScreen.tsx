"use client";

import { useEffect, useMemo, useState } from "react";
import { useProfile } from "@/context/ProfileContext";
import { Card } from "@/components/ui/Card";
import { RangeToggle } from "@/components/suivi/RangeToggle";
import { TrendChart } from "@/components/suivi/TrendChart";
import { SundayJournalCard } from "@/components/suivi/SundayJournalCard";
import { EditGoalsSheet } from "@/components/suivi/EditGoalsSheet";
import { JournalHistorySheet } from "@/components/suivi/JournalHistorySheet";
import { CoachReadySheet } from "@/components/suivi/CoachReadySheet";
import { DayEnergyCard } from "@/components/suivi/DayEnergyCard";
import { DayLogSheet } from "@/components/suivi/DayLogSheet";
import { SuiviHubBar, type SuiviHubId } from "@/components/suivi/SuiviHubBar";
import { addDaysISO, formatWeekRange, mondayOf, todayISO } from "@/lib/dates";
import { formatWeeklyRate, goalLabel } from "@/lib/goals";
import type { GoalPatch } from "@/lib/goals";
import { PlanActionSheet } from "@/components/repas/PlanActionSheet";
import { SportHubBar, type SportHubId } from "@/components/sport/SportHubBar";
import { SportRoutineCard } from "@/components/sport/SportRoutineCard";
import { WeightJourneyChart } from "@/components/suivi/WeightJourneyChart";
import { buildCoachWeekPayload, persistCoachWeekPayload, type CoachWeekPayload } from "@/lib/coach-payload";
import {
  latestPesee,
  parseJournalNotes,
  serializeJournalNotes,
  seriesOf,
  sliceTrendRange,
  withMovingAverages,
  type TrendRange,
} from "@/lib/pesees";
import { HealthMetricTile } from "@/components/today/HealthMetricTile";
import { sanitizeRestingKcal } from "@/lib/health-energy";
import { loadHealthHistory, movementSeries } from "@/lib/supabase/health-logs";
import { loadJournalHistory, loadPesees, savePesee } from "@/lib/supabase/pesees";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { fetchMealsRange } from "@/lib/supabase/today-data";
import { fetchDailyFeels } from "@/lib/supabase/daily-feel";
import { buildDailyEnergy } from "@/lib/energy-history";
import { activityLabel } from "@/lib/sport-routine";
import type { DailyFeelEntry } from "@/lib/daily-feel";
import type { DatedMeal } from "@/lib/recent-foods";
import type { DailyMovement, Pesee, Profile, ProfileId, SundayJournalFields } from "@/lib/types";
import { formatKg, formatKcal, formatKm, formatMin, formatSteps } from "@/lib/utils";

export default function SuiviScreen() {
  const { activeProfiles, catalog, updateGoals } = useProfile();
  const [byProfile, setByProfile] = useState<Record<ProfileId, Pesee[]>>({
    alexis: [],
    elodie: [],
  });
  const [healthByProfile, setHealthByProfile] = useState<Record<ProfileId, DailyMovement[]>>({
    alexis: [],
    elodie: [],
  });
  const [mealsByProfile, setMealsByProfile] = useState<Record<ProfileId, DatedMeal[]>>({
    alexis: [],
    elodie: [],
  });
  const [feelsByProfile, setFeelsByProfile] = useState<Record<ProfileId, DailyFeelEntry[]>>({
    alexis: [],
    elodie: [],
  });
  const [dayLog, setDayLog] = useState<{ profileId: ProfileId; date: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [goalsSaving, setGoalsSaving] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [historyFor, setHistoryFor] = useState<Profile | null>(null);
  const [historyEntries, setHistoryEntries] = useState<
    Array<{ date: string; notes: SundayJournalFields }>
  >([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [coachReady, setCoachReady] = useState<{
    payload: CoachWeekPayload;
    saveError: string | null;
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createBrowserSupabaseClient();
    const from = addDaysISO(todayISO(), -365);
    const to = todayISO();
    Promise.all([
      loadPesees("alexis"),
      loadPesees("elodie"),
      loadHealthHistory("alexis"),
      loadHealthHistory("elodie"),
      supabase ? fetchMealsRange(supabase, ["alexis"], from, to) : Promise.resolve({ meals: [] as DatedMeal[] }),
      supabase ? fetchMealsRange(supabase, ["elodie"], from, to) : Promise.resolve({ meals: [] as DatedMeal[] }),
      fetchDailyFeels(supabase, ["alexis", "elodie"], from, to),
    ]).then(([alexis, elodie, alexisHealth, elodieHealth, alexisMeals, elodieMeals, feels]) => {
      if (cancelled) return;
      setByProfile({ alexis: alexis.rows, elodie: elodie.rows });
      setHealthByProfile({ alexis: alexisHealth, elodie: elodieHealth });
      setMealsByProfile({ alexis: alexisMeals.meals, elodie: elodieMeals.meals });
      setFeelsByProfile({
        alexis: feels.filter((row) => row.profileId === "alexis"),
        elodie: feels.filter((row) => row.profileId === "elodie"),
      });
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function reloadMeals(profileId: ProfileId) {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) return;
    const from = addDaysISO(todayISO(), -365);
    const { meals } = await fetchMealsRange(supabase, [profileId], from, todayISO());
    setMealsByProfile((current) => ({ ...current, [profileId]: meals }));
  }

  useEffect(() => {
    if (!historyFor) return;
    let cancelled = false;
    setHistoryLoading(true);
    loadJournalHistory(historyFor.id, byProfile[historyFor.id]).then((entries) => {
      if (cancelled) return;
      setHistoryEntries(entries);
      setHistoryLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [historyFor, byProfile]);

  async function saveGoals(profile: Profile, patch: GoalPatch) {
    setGoalsSaving(true);
    try {
      const error = await updateGoals(profile.id, patch);
      setEditing(null);
      setNotice(error ? `Objectifs en local · ${error}` : "Objectifs enregistrés");
    } finally {
      setGoalsSaving(false);
    }
  }

  return (
    <div>
      <h1 className="text-[28px] font-bold tracking-tight">Suivi</h1>
      <p className="mt-1 text-[13px] text-health-muted">
        Journal, journées, poids, corps, Santé et sport
      </p>
      {notice ? <p className="mt-2 text-[13px] font-medium">{notice}</p> : null}
      {loading ? <p className="mt-3 text-[13px] text-health-muted">Chargement…</p> : null}

      {activeProfiles.map((profile) => (
        <ProfileSuivi
          key={profile.id}
          profile={profile}
          rows={byProfile[profile.id]}
          healthDays={healthByProfile[profile.id]}
          meals={mealsByProfile[profile.id]}
          onEditGoals={() => setEditing(profile)}
          onOpenHistory={() => setHistoryFor(profile)}
          onOpenDay={(date) => setDayLog({ profileId: profile.id, date })}
          onSaved={(row) =>
            setByProfile((current) => ({
              ...current,
              [row.profileId]: upsertLocal(current[row.profileId], row),
            }))
          }
          onCoachReady={(payload, saveError) => {
            setCoachReady({ payload, saveError });
          }}
        />
      ))}

      {editing && (
        <EditGoalsSheet
          profile={editing}
          saving={goalsSaving}
          onClose={() => setEditing(null)}
          onSave={(patch) => void saveGoals(editing, patch)}
        />
      )}

      {historyFor && (
        <JournalHistorySheet
          profileName={historyFor.name}
          entries={historyEntries}
          loading={historyLoading}
          onClose={() => setHistoryFor(null)}
        />
      )}

      {dayLog && catalog[dayLog.profileId] && (
        <DayLogSheet
          date={dayLog.date}
          profile={catalog[dayLog.profileId]}
          meals={mealsByProfile[dayLog.profileId]}
          healthDays={healthByProfile[dayLog.profileId]}
          feels={feelsByProfile[dayLog.profileId]}
          onClose={() => setDayLog(null)}
          onChangeDate={(date) => setDayLog({ ...dayLog, date })}
          onMealsSaved={(meals) =>
            setMealsByProfile((current) => ({ ...current, [dayLog.profileId]: meals }))
          }
          onReload={() => reloadMeals(dayLog.profileId)}
        />
      )}

      {coachReady && (
        <CoachReadySheet
          payload={coachReady.payload}
          saveError={coachReady.saveError}
          onClose={() => setCoachReady(null)}
        />
      )}
    </div>
  );
}

function upsertLocal(rows: Pesee[], row: Pesee) {
  return [...rows.filter((item) => item.date !== row.date), row].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
}

function ProfileSuivi({
  profile,
  rows,
  healthDays,
  meals,
  onEditGoals,
  onOpenHistory,
  onOpenDay,
  onSaved,
  onCoachReady,
}: {
  profile: Profile;
  rows: Pesee[];
  healthDays: DailyMovement[];
  meals: DatedMeal[];
  onEditGoals: () => void;
  onOpenHistory: () => void;
  onOpenDay: (date: string) => void;
  onSaved: (row: Pesee) => void;
  onCoachReady: (payload: CoachWeekPayload, saveError: string | null) => void;
}) {
  const color = profile.accent === "coral" ? "#FF6B4A" : "#6B7CFF";
  const last = latestPesee(rows);
  const current = last?.poids ?? profile.currentWeightKg;
  const weightSeries = useMemo(() => withMovingAverages(seriesOf(rows, "poids")), [rows]);
  const fatSeries = useMemo(() => withMovingAverages(seriesOf(rows, "masseGrasse")), [rows]);
  const muscleSeries = useMemo(() => withMovingAverages(seriesOf(rows, "masseMusculaire")), [rows]);
  const bmiSeries = useMemo(() => withMovingAverages(seriesOf(rows, "bmi")), [rows]);
  const ma7 = weightSeries[weightSeries.length - 1]?.ma7 ?? null;
  const ma14 = weightSeries[weightSeries.length - 1]?.ma14 ?? null;
  const [sheet, setSheet] = useState<SuiviHubId | null>(null);
  const [sportPane, setSportPane] = useState<SportHubId | null>(null);
  const [weightRange, setWeightRange] = useState<TrendRange>("1m");
  const [compRange, setCompRange] = useState<TrendRange>("1m");
  const [healthRange, setHealthRange] = useState<TrendRange>("1m");
  const lastHealth = healthDays[healthDays.length - 1];
  const lastBmi = [...rows].reverse().find((row) => row.bmi != null)?.bmi ?? last?.bmi ?? null;
  const visibleWeight = useMemo(
    () => sliceTrendRange(weightSeries, weightRange),
    [weightSeries, weightRange],
  );
  const visibleFat = useMemo(
    () => sliceTrendRange(fatSeries, compRange),
    [fatSeries, compRange],
  );
  const visibleMuscle = useMemo(
    () => sliceTrendRange(muscleSeries, compRange),
    [muscleSeries, compRange],
  );
  const visibleBmi = useMemo(() => sliceTrendRange(bmiSeries, compRange), [bmiSeries, compRange]);
  const stepsSeries = useMemo(
    () => sliceTrendRange(withMovingAverages(movementSeries(healthDays, "steps")), healthRange),
    [healthDays, healthRange],
  );
  const distanceSeries = useMemo(
    () =>
      sliceTrendRange(withMovingAverages(movementSeries(healthDays, "distanceKm")), healthRange),
    [healthDays, healthRange],
  );
  const cyclingSeries = useMemo(
    () =>
      sliceTrendRange(withMovingAverages(movementSeries(healthDays, "cyclingDistanceKm")), healthRange),
    [healthDays, healthRange],
  );
  const minutesSeries = useMemo(
    () =>
      sliceTrendRange(withMovingAverages(movementSeries(healthDays, "workoutMinutes")), healthRange),
    [healthDays, healthRange],
  );
  const activeSeries = useMemo(
    () =>
      sliceTrendRange(
        withMovingAverages(movementSeries(healthDays, "activeEnergyKcal")),
        healthRange,
      ),
    [healthDays, healthRange],
  );
  const restingSeries = useMemo(
    () => {
      const days = healthDays.map((day) => ({
        ...day,
        restingEnergyKcal: sanitizeRestingKcal(day.restingEnergyKcal, {
          bmr: profile.bmr,
          tdee: profile.tdee,
        }).value,
      }));
      return sliceTrendRange(
        withMovingAverages(movementSeries(days, "restingEnergyKcal")),
        healthRange,
      );
    },
    [healthDays, healthRange, profile.bmr, profile.tdee],
  );

  function closeSheet() {
    setSheet(null);
    setSportPane(null);
  }

  return (
    <section className="mt-1">
      <SuiviHubBar
        onOpen={(id) => {
          setSheet(id);
          setSportPane(null);
        }}
      />

      {sheet === "journal" ? (
        <PlanActionSheet title="Journal" onClose={closeSheet}>
          <ProfileJournal
            profile={profile}
            rows={rows}
            hideTitle
            onOpenHistory={onOpenHistory}
            onSaved={onSaved}
            onCoachReady={onCoachReady}
          />
        </PlanActionSheet>
      ) : null}

      {sheet === "journees" ? (
        <PlanActionSheet title="Journées" onClose={closeSheet}>
          <DayEnergyCard
            rows={buildDailyEnergy(meals, healthDays, profile)}
            goal={profile.primaryGoal}
            color={color}
            hideTitle
            onOpenDay={onOpenDay}
          />
        </PlanActionSheet>
      ) : null}

      {sheet === "poids" ? (
        <PlanActionSheet title="Poids" onClose={closeSheet}>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[12px] text-health-muted">
              {goalLabel(profile.primaryGoal)} · {formatWeeklyRate(profile.weeklyRateKg)}
            </p>
            <button type="button" onClick={onEditGoals} className="text-[12px] font-semibold text-health-ink">
              Éditer mes objectifs
            </button>
          </div>
          <Card compact>
            <WeightJourneyChart
              start={profile.startWeightKg}
              current={current}
              target={profile.targetWeightKg}
              goal={profile.primaryGoal}
              color={color}
              date={last?.date}
              gradientId={profile.id}
            />
            {ma7 != null && ma14 != null && (
              <div className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
                <div className="rounded-xl bg-health-bg px-2.5 py-2">
                  Moy. 7 j <span className="font-semibold tabular-nums">{formatKg(ma7)}</span>
                </div>
                <div className="rounded-xl bg-health-bg px-2.5 py-2">
                  Moy. 14 j <span className="font-semibold tabular-nums">{formatKg(ma14)}</span>
                </div>
              </div>
            )}
          </Card>
          <p className="mb-1 mt-4 text-[12px] text-health-muted">
            Quotidien · moyenne 7 j · moyenne 14 j
          </p>
          <RangeToggle value={weightRange} onChange={setWeightRange} />
          <div className="mt-3">
            <TrendChart data={visibleWeight} color={color} unit="kg" range={weightRange} />
          </div>
        </PlanActionSheet>
      ) : null}

      {sheet === "corps" ? (
        <PlanActionSheet title="Corps" onClose={closeSheet}>
          <div className="mb-3 grid grid-cols-3 gap-2">
            <div>
              <p className="text-[12px] text-health-muted">Masse grasse</p>
              <p className="text-[20px] font-semibold tabular-nums">
                {last?.masseGrasse != null ? `${String(last.masseGrasse).replace(".", ",")} %` : "—"}
              </p>
            </div>
            <div>
              <p className="text-[12px] text-health-muted">Masse musculaire</p>
              <p className="text-[20px] font-semibold tabular-nums">
                {last?.masseMusculaire != null ? formatKg(last.masseMusculaire) : "—"}
              </p>
            </div>
            <div>
              <p className="text-[12px] text-health-muted">IMC</p>
              <p className="text-[20px] font-semibold tabular-nums">
                {lastBmi != null ? String(lastBmi).replace(".", ",") : "—"}
              </p>
            </div>
          </div>
          {last?.tourTaille != null && (
            <p className="mb-3 text-[13px] text-health-muted">
              Tour de taille {String(last.tourTaille).replace(".", ",")} cm
            </p>
          )}
          <RangeToggle value={compRange} onChange={setCompRange} />
          <p className="mb-1 mt-3 text-[12px] font-medium">Masse grasse · moy. 7 / 14 j</p>
          <TrendChart data={visibleFat} color={color} unit="%" range={compRange} />
          <p className="mb-1 mt-4 text-[12px] font-medium">Masse musculaire · moy. 7 / 14 j</p>
          <TrendChart data={visibleMuscle} color={color} unit="kg" range={compRange} />
          <p className="mb-1 mt-4 text-[12px] font-medium">IMC · moy. 7 / 14 j</p>
          <TrendChart data={visibleBmi} color={color} unit="" range={compRange} />
        </PlanActionSheet>
      ) : null}

      {sheet === "sante" ? (
        <PlanActionSheet title="Santé" onClose={closeSheet}>
          {lastHealth ? (
            <div className="mb-3 grid grid-cols-2 gap-2">
              <HealthMetricTile label="Pas" value={formatSteps(lastHealth.steps)} />
              <HealthMetricTile label="Marche" value={formatKm(lastHealth.distanceKm)} />
              <HealthMetricTile label="Vélo" value={formatKm(lastHealth.cyclingDistanceKm)} />
              <HealthMetricTile
                label="Minutes d'exercice"
                value={formatMin(lastHealth.workoutMinutes)}
              />
              <HealthMetricTile
                label="Énergie active"
                value={formatKcal(lastHealth.activeEnergyKcal)}
              />
              <HealthMetricTile
                label="Énergie au repos"
                value={formatKcal(
                  sanitizeRestingKcal(lastHealth.restingEnergyKcal, {
                    bmr: profile.bmr,
                    tdee: profile.tdee,
                  }).value,
                )}
              />
            </div>
          ) : (
            <p className="mb-3 text-[13px] text-health-muted">
              Aucune donnée webhook pour l&apos;instant. Lance le raccourci iOS Santé.
            </p>
          )}
          <RangeToggle value={healthRange} onChange={setHealthRange} />
          <p className="mb-1 mt-3 text-[12px] font-medium">Pas</p>
          <TrendChart data={stepsSeries} color={color} unit="pas" range={healthRange} />
          <p className="mb-1 mt-4 text-[12px] font-medium">Marche</p>
          <TrendChart data={distanceSeries} color={color} unit="km" range={healthRange} />
          <p className="mb-1 mt-4 text-[12px] font-medium">Vélo</p>
          <TrendChart data={cyclingSeries} color={color} unit="km" range={healthRange} />
          <p className="mb-1 mt-4 text-[12px] font-medium">Minutes d&apos;exercice</p>
          <TrendChart data={minutesSeries} color={color} unit="min" range={healthRange} />
          <p className="mb-1 mt-4 text-[12px] font-medium">Énergie active</p>
          <TrendChart data={activeSeries} color={color} unit="kcal" range={healthRange} />
          <p className="mb-1 mt-4 text-[12px] font-medium">Énergie au repos</p>
          <TrendChart data={restingSeries} color={color} unit="kcal" range={healthRange} />
        </PlanActionSheet>
      ) : null}

      {sheet === "sport" ? (
        <PlanActionSheet title="Sport" onClose={closeSheet}>
          <p className="mb-3 text-[12px] leading-snug text-health-muted">
            Ici tu construis la semaine. Aujourd’hui et Métabolisme lisent cette même routine.
          </p>
          <SportHubBar onOpen={setSportPane} />
        </PlanActionSheet>
      ) : null}

      {sportPane ? (
        <PlanActionSheet
          title={sportPane === "coach" ? "Coach" : activityLabel(sportPane)}
          zClass="z-[95]"
          onClose={() => setSportPane(null)}
        >
          <SportRoutineCard profile={profile} pane={sportPane} />
        </PlanActionSheet>
      ) : null}
    </section>
  );
}

function ProfileJournal({
  profile,
  rows,
  hideTitle,
  onSaved,
  onOpenHistory,
  onCoachReady,
}: {
  profile: Profile;
  rows: Pesee[];
  hideTitle?: boolean;
  onSaved: (row: Pesee) => void;
  onOpenHistory: () => void;
  onCoachReady: (payload: CoachWeekPayload, saveError: string | null) => void;
}) {
  const sunday = addDaysISO(mondayOf(todayISO()), 6);
  const existing = rows.find((row) => row.date === sunday);
  const [fields, setFields] = useState<SundayJournalFields>(() =>
    parseJournalNotes(existing?.journalNotes),
  );
  const [saving, setSaving] = useState(false);
  const [emptyHint, setEmptyHint] = useState<string | null>(null);

  useEffect(() => {
    setFields(parseJournalNotes(existing?.journalNotes));
  }, [existing?.journalNotes]);

  async function save() {
    const serialized = serializeJournalNotes(fields);
    if (!serialized) {
      setEmptyHint("Ajoute un ressenti, une victoire, un frein, ou un sticker autre que bof.");
      return;
    }
    setEmptyHint(null);
    setSaving(true);
    try {
      const { row, error } = await savePesee({
        id: existing?.id ?? crypto.randomUUID(),
        profileId: profile.id,
        date: sunday,
        poids: existing?.poids ?? latestPesee(rows)?.poids ?? profile.currentWeightKg,
        masseGrasse: existing?.masseGrasse ?? null,
        masseMusculaire: existing?.masseMusculaire ?? null,
        tourTaille: existing?.tourTaille ?? null,
        bmi: existing?.bmi ?? null,
        journalNotes: serialized,
      });
      onSaved(row);
      const notes = parseJournalNotes(row.journalNotes);
      const payload = buildCoachWeekPayload(profile, upsertLocal(rows, row), sunday, notes);
      persistCoachWeekPayload(payload);
      onCoachReady(payload, error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <SundayJournalCard
        weekLabel={formatWeekRange(mondayOf(todayISO()))}
        profileName={profile.name}
        fields={fields}
        saving={saving}
        hideTitle={hideTitle}
        onChange={setFields}
        onSave={() => void save()}
        onOpenHistory={onOpenHistory}
      />
      {emptyHint && <p className="mt-2 text-[12px] text-coral">{emptyHint}</p>}
    </>
  );
}
