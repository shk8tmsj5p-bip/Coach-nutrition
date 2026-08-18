"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import Link from "next/link";
import { Camera } from "lucide-react";
import { useProfile } from "@/context/ProfileContext";
import { Card, SectionTitle } from "@/components/ui/Card";
import { RangeToggle } from "@/components/suivi/RangeToggle";
import { TrendChart } from "@/components/suivi/TrendChart";
import {
  draftFromOcr,
  parsedDraft,
  RenphoReviewSheet,
  type RenphoDraft,
} from "@/components/suivi/RenphoReviewSheet";
import { SundayJournalCard } from "@/components/suivi/SundayJournalCard";
import { EditGoalsSheet } from "@/components/suivi/EditGoalsSheet";
import { JournalHistorySheet } from "@/components/suivi/JournalHistorySheet";
import { CoachReadySheet } from "@/components/suivi/CoachReadySheet";
import { addDaysISO, formatWeekRange, mondayOf, todayISO } from "@/lib/dates";
import { formatWeeklyRate, goalLabel } from "@/lib/goals";
import type { GoalPatch } from "@/lib/goals";
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
import { loadJournalHistory, loadPesees, savePesee } from "@/lib/supabase/pesees";
import type { Pesee, Profile, ProfileId, SundayJournalFields } from "@/lib/types";
import { formatKg } from "@/lib/utils";
import type { RenphoOcrResult } from "@/lib/gemini/renpho";

export default function SuiviScreen() {
  const { activeProfiles, view, updateGoals } = useProfile();
  const fileRef = useRef<HTMLInputElement>(null);
  const [byProfile, setByProfile] = useState<Record<ProfileId, Pesee[]>>({
    alexis: [],
    elodie: [],
  });
  const [loading, setLoading] = useState(true);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [saving, setSaving] = useState(false);
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
  const [review, setReview] = useState<{
    draft: RenphoDraft;
    extracted: RenphoOcrResult;
    mock?: boolean;
    warning?: string;
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const allRows = useMemo(
    () => [...byProfile.alexis, ...byProfile.elodie],
    [byProfile],
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadPesees("alexis"), loadPesees("elodie")]).then(([alexis, elodie]) => {
      if (cancelled) return;
      setByProfile({ alexis: alexis.rows, elodie: elodie.rows });
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

  async function onPickFile(file: File) {
    setOcrBusy(true);
    setNotice(null);
    try {
      const fallback = view === "elodie" ? "elodie" : "alexis";
      const form = new FormData();
      form.append("image", file);
      form.append("profileId", fallback);
      const response = await fetch("/api/ocr-renpho", { method: "POST", body: form });
      const payload = (await response.json()) as {
        extracted?: RenphoOcrResult;
        mock?: boolean;
        warning?: string;
        error?: string;
      };
      if (!payload.extracted) throw new Error(payload.error ?? "OCR impossible");
      setReview({
        draft: draftFromOcr(payload.extracted, fallback, allRows, view !== "couple"),
        extracted: payload.extracted,
        mock: payload.mock,
        warning: payload.warning,
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "OCR impossible");
    } finally {
      setOcrBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function confirmReview() {
    if (!review) return;
    const parsed = parsedDraft(review.draft);
    if (parsed.poids == null) return;
    setSaving(true);
    try {
      const existing = byProfile[parsed.profileId].find((item) => item.date === parsed.date);
      const { row, error } = await savePesee({
        id: existing?.id ?? crypto.randomUUID(),
        profileId: parsed.profileId,
        date: parsed.date,
        poids: parsed.poids,
        masseGrasse: parsed.masseGrasse,
        masseMusculaire: parsed.masseMusculaire,
        tourTaille: parsed.tourTaille,
        bmi: existing?.bmi ?? null,
        journalNotes: existing?.journalNotes ?? null,
      });
      setByProfile((current) => ({
        ...current,
        [row.profileId]: upsertLocal(current[row.profileId], row),
      }));
      setReview(null);
      setNotice(error ? `Enregistré en local · ${error}` : `Pesée ${row.date} enregistrée`);
    } finally {
      setSaving(false);
    }
  }

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
      <p className="mt-1 text-[13px] text-health-muted">Poids, composition, journal du dimanche</p>

      {loading ? (
        <p className="mt-6 text-[13px] text-health-muted">Chargement des pesées…</p>
      ) : (
        activeProfiles.map((profile, index) => (
          <ProfileSuivi
            key={profile.id}
            profile={profile}
            rows={byProfile[profile.id]}
            showRenpho={index === 0}
            ocrBusy={ocrBusy}
            notice={notice}
            fileRef={fileRef}
            onPickFile={(file) => void onPickFile(file)}
            onEditGoals={() => setEditing(profile)}
            onOpenHistory={() => setHistoryFor(profile)}
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
        ))
      )}

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

      {coachReady && (
        <CoachReadySheet
          payload={coachReady.payload}
          saveError={coachReady.saveError}
          onClose={() => setCoachReady(null)}
        />
      )}

      {review && (
        <RenphoReviewSheet
          draft={review.draft}
          extracted={review.extracted}
          rows={allRows}
          lockProfile={view !== "couple"}
          mock={review.mock}
          warning={review.warning}
          saving={saving}
          onChange={(draft) => setReview({ ...review, draft })}
          onClose={() => setReview(null)}
          onConfirm={() => void confirmReview()}
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
  showRenpho,
  ocrBusy,
  notice,
  fileRef,
  onPickFile,
  onEditGoals,
  onOpenHistory,
  onSaved,
  onCoachReady,
}: {
  profile: Profile;
  rows: Pesee[];
  showRenpho: boolean;
  ocrBusy: boolean;
  notice: string | null;
  fileRef: RefObject<HTMLInputElement | null>;
  onPickFile: (file: File) => void;
  onEditGoals: () => void;
  onOpenHistory: () => void;
  onSaved: (row: Pesee) => void;
  onCoachReady: (payload: CoachWeekPayload, saveError: string | null) => void;
}) {
  const color = profile.accent === "coral" ? "#FF6B4A" : "#6B7CFF";
  const last = latestPesee(rows);
  const current = last?.poids ?? profile.currentWeightKg;
  const weightSeries = useMemo(() => withMovingAverages(seriesOf(rows, "poids")), [rows]);
  const fatSeries = useMemo(() => withMovingAverages(seriesOf(rows, "masseGrasse")), [rows]);
  const muscleSeries = useMemo(() => withMovingAverages(seriesOf(rows, "masseMusculaire")), [rows]);
  const ma7 = weightSeries[weightSeries.length - 1]?.ma7 ?? null;
  const ma14 = weightSeries[weightSeries.length - 1]?.ma14 ?? null;
  const [weightRange, setWeightRange] = useState<TrendRange>("1m");
  const [compRange, setCompRange] = useState<TrendRange>("1m");
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

  return (
    <section className="mt-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[17px] font-semibold">{profile.name}</h2>
        <button type="button" onClick={onEditGoals} className="text-[12px] font-semibold text-health-ink">
          Éditer mes objectifs
        </button>
      </div>
      <Card>
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold">Poids</p>
          <p className="text-[12px] text-health-muted">
            {goalLabel(profile.primaryGoal)} · {formatWeeklyRate(profile.weeklyRateKg)}
          </p>
        </div>
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
          <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
            <div className="rounded-xl bg-health-bg p-2.5">
              Moy. 7 j <span className="font-semibold tabular-nums">{formatKg(ma7)}</span>
            </div>
            <div className="rounded-xl bg-health-bg p-2.5">
              Moy. 14 j <span className="font-semibold tabular-nums">{formatKg(ma14)}</span>
            </div>
          </div>
        )}
      </Card>

      {showRenpho && (
        <>
          <SectionTitle>Import Renpho</SectionTitle>
          <Card>
            <p className="text-[14px] leading-relaxed text-health-muted">
              Capture → Gemini Flash préremplit la fiche du profil et de la date, puis tu valides avant
              écriture dans pesees.
            </p>
            <button
              type="button"
              disabled={ocrBusy}
              onClick={() => fileRef.current?.click()}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-card bg-health-bg py-3 text-[14px] font-semibold disabled:opacity-50"
            >
              <Camera size={18} />
              {ocrBusy ? "Lecture de la capture…" : "Importer capture Renpho"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onPickFile(file);
              }}
            />
            {notice && <p className="mt-3 text-[13px] font-medium">{notice}</p>}
          </Card>
        </>
      )}

      <ProfileJournal
        profile={profile}
        rows={rows}
        onOpenHistory={onOpenHistory}
        onSaved={onSaved}
        onCoachReady={onCoachReady}
      />

      <SectionTitle>Tendance poids</SectionTitle>
      <Card>
        <RangeToggle value={weightRange} onChange={setWeightRange} />
        <p className="mb-1 mt-3 text-[12px] text-health-muted">
          Quotidien · moyenne 7 j · moyenne 14 j
        </p>
        <TrendChart data={visibleWeight} color={color} unit="kg" range={weightRange} />
      </Card>

      <SectionTitle>Composition corporelle</SectionTitle>
      <Card>
        <div className="mb-3 grid grid-cols-2 gap-3">
          <div>
            <p className="text-[12px] text-health-muted">Masse grasse</p>
            <p className="text-[22px] font-semibold tabular-nums">
              {last?.masseGrasse != null ? `${String(last.masseGrasse).replace(".", ",")} %` : "—"}
            </p>
          </div>
          <div>
            <p className="text-[12px] text-health-muted">Masse musculaire</p>
            <p className="text-[22px] font-semibold tabular-nums">
              {last?.masseMusculaire != null ? formatKg(last.masseMusculaire) : "—"}
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
      </Card>

      <Link
        href="/metabolique"
        className="mt-3 flex w-full items-center justify-center rounded-card bg-health-bg py-3 text-[13px] font-semibold"
      >
        Bilan Coach → onglet Métabo
      </Link>

      <SportRoutineCard profile={profile} />
    </section>
  );
}

function ProfileJournal({
  profile,
  rows,
  onSaved,
  onOpenHistory,
  onCoachReady,
}: {
  profile: Profile;
  rows: Pesee[];
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
      setEmptyHint("Ajoute un ressenti, une victoire, un frein, ou un score différent de 3.");
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
        onChange={setFields}
        onSave={() => void save()}
        onOpenHistory={onOpenHistory}
      />
      {emptyHint && <p className="mt-2 text-[12px] text-coral">{emptyHint}</p>}
    </>
  );
}
