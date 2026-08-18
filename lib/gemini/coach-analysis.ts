import type { Macros, Profile, SportActivity, SportEffort } from "@/lib/types";
import type { CoachSessionSnapshot } from "@/lib/coach-week-sessions";
import type { CoachTrendPoint, CoachWeekPayload } from "@/lib/coach-payload";
import { formatWeeklyRate, goalLabel } from "@/lib/goals";
import { activityLabel, effortAllowed, effortLabel } from "@/lib/sport-routine";

export type DayMacroTargets = Macros;

export type CoachSportPatch = {
  activity: SportActivity;
  effort?: SportEffort;
  durationDeltaMin: number;
  nextEffort?: SportEffort;
};

export type CoachAnalysis = {
  analysis: string;
  nutrition: string[];
  sport: string[];
  sportAdjustments: CoachSportPatch[];
  targets: Macros;
  trainingDay: DayMacroTargets;
  restDay: DayMacroTargets;
  calorieDelta: number;
  proteinDelta: number;
  carbsDelta: number;
  caution: boolean;
};

export type CoachAnalysisRequest = {
  profile: Profile;
  weightTrend7d: CoachTrendPoint[];
  latestMa7: number | null;
  latestMa14: number | null;
  plateau: boolean;
  journal: CoachWeekPayload["journal"];
  recentJournals: CoachWeekPayload["recentJournals"];
  sessions: CoachSessionSnapshot[];
  currentTargets: Macros;
};

function roundMacro(value: number) {
  return Math.round(value);
}

function clampDelta(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(min, Math.min(max, Math.round(value / 5) * 5));
}

function asMacros(value: unknown, fallback: Macros): Macros {
  const rec = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const calories = Number(rec.calories ?? rec.kcal ?? fallback.calories);
  const protein = Number(rec.protein ?? rec.proteines ?? rec.protein_g ?? fallback.protein);
  const carbs = Number(rec.carbs ?? rec.glucides ?? rec.carbs_g ?? fallback.carbs);
  const fat = Number(rec.fat ?? rec.lipides ?? rec.fat_g ?? fallback.fat);
  return {
    calories: roundMacro(Number.isFinite(calories) ? calories : fallback.calories),
    protein: roundMacro(Number.isFinite(protein) ? protein : fallback.protein),
    carbs: roundMacro(Number.isFinite(carbs) ? carbs : fallback.carbs),
    fat: roundMacro(Number.isFinite(fat) ? fat : fallback.fat),
  };
}

function asLines(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean)
      .slice(0, 6);
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function applyDeltas(base: Macros, calorieDelta: number, proteinDelta: number, carbsDelta: number): Macros {
  return {
    calories: roundMacro(base.calories + calorieDelta),
    protein: roundMacro(Math.max(80, base.protein + proteinDelta)),
    carbs: roundMacro(Math.max(80, base.carbs + carbsDelta)),
    fat: base.fat,
  };
}

function clampAgainstCurrent(current: Macros, next: Macros, stressed: boolean): Macros {
  const maxCut = stressed ? 0 : 200;
  const calories = Math.max(current.calories - maxCut, Math.min(current.calories + 150, next.calories));
  return {
    calories: roundMacro(calories),
    protein: roundMacro(Math.max(current.protein - 10, Math.min(current.protein + 25, next.protein))),
    carbs: roundMacro(Math.max(current.carbs - 40, Math.min(current.carbs + 50, next.carbs))),
    fat: roundMacro(Math.max(current.fat - 10, Math.min(current.fat + 10, next.fat))),
  };
}

export function coachHeadline(analysis: CoachAnalysis) {
  if (analysis.caution) {
    return { tone: "caution" as const, title: "Récupération — ne pas couper les kcal" };
  }
  if (analysis.calorieDelta <= -50) {
    return {
      tone: "adjust" as const,
      title: `${analysis.calorieDelta} kcal / j en moyenne`,
    };
  }
  if (analysis.carbsDelta >= 10) {
    return {
      tone: "adjust" as const,
      title: `+${analysis.carbsDelta} g glucides les jours de sport`,
    };
  }
  return { tone: "ok" as const, title: "Rythme tenu — cible conservée" };
}

export function isStressedWeek(notes: { hunger: number; energy: number; fatigue: number }) {
  return notes.hunger >= 4 || notes.fatigue >= 4 || notes.energy <= 2;
}

const ACTIVITIES: SportActivity[] = ["course", "velo", "muscu"];
const EFFORTS: SportEffort[] = [
  "fractionne",
  "sortie-longue",
  "endurance",
  "zone-2",
  "circuit-hiit",
  "force",
];

function asActivity(value: unknown): SportActivity | null {
  return typeof value === "string" && ACTIVITIES.includes(value as SportActivity)
    ? (value as SportActivity)
    : null;
}

function asEffort(value: unknown): SportEffort | null {
  return typeof value === "string" && EFFORTS.includes(value as SportEffort)
    ? (value as SportEffort)
    : null;
}

export function parseSportPatches(value: unknown): CoachSportPatch[] {
  if (!Array.isArray(value)) return [];
  const patches: CoachSportPatch[] = [];
  for (const item of value) {
    const rec = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const activity = asActivity(rec.activity);
    if (!activity) continue;
    const effort = asEffort(rec.effort) ?? undefined;
    const nextEffort = asEffort(rec.next_effort ?? rec.nextEffort) ?? undefined;
    const durationDeltaMin = clampDelta(Number(rec.duration_delta_min ?? rec.durationDeltaMin ?? 0) || 0, -20, 10);
    if (durationDeltaMin === 0 && (!nextEffort || nextEffort === effort)) continue;
    patches.push({
      activity,
      effort,
      durationDeltaMin,
      nextEffort: nextEffort && effortAllowed(activity, nextEffort) ? nextEffort : undefined,
    });
  }
  return patches.slice(0, 8);
}

export function localSportPatches(body: CoachAnalysisRequest, stressed: boolean): CoachSportPatch[] {
  const sessions = body.profile.sportRoutine?.sessions ?? [];
  if (sessions.length === 0 || !stressed) return [];

  const patches: CoachSportPatch[] = [];
  const hasFractionne = sessions.some((session) => session.effort === "fractionne");
  const hasHiit = sessions.some((session) => session.effort === "circuit-hiit");

  if (hasFractionne) {
    if (sessions.some((session) => session.activity === "course" && session.effort === "fractionne")) {
      patches.push({ activity: "course", effort: "fractionne", durationDeltaMin: -10, nextEffort: "zone-2" });
    }
    if (sessions.some((session) => session.activity === "velo" && session.effort === "fractionne")) {
      patches.push({ activity: "velo", effort: "fractionne", durationDeltaMin: -10, nextEffort: "zone-2" });
    }
  }
  if (hasHiit) {
    patches.push({ activity: "muscu", effort: "circuit-hiit", durationDeltaMin: -10, nextEffort: "force" });
  }
  if (patches.length === 0) {
    const seen = new Set<SportActivity>();
    for (const session of sessions) {
      if (seen.has(session.activity)) continue;
      seen.add(session.activity);
      patches.push({ activity: session.activity, durationDeltaMin: -10 });
    }
  }
  return patches;
}

export function formatSportPatch(patch: CoachSportPatch) {
  const activity = activityLabel(patch.activity);
  const from = patch.effort ? effortLabel(patch.effort) : "toutes séances";
  const duration =
    patch.durationDeltaMin === 0
      ? "durée inchangée"
      : `${patch.durationDeltaMin > 0 ? "+" : "−"}${Math.abs(patch.durationDeltaMin)} min`;
  const intensity = patch.nextEffort ? ` → ${effortLabel(patch.nextEffort)}` : "";
  return `${activity} · ${from} · ${duration}${intensity}`;
}

export function localCoachAnalysis(body: CoachAnalysisRequest): CoachAnalysis {
  const current = body.currentTargets;
  const notes = body.journal.notes;
  const stressed = isStressedWeek(notes);
  const hasRun = body.sessions.some((session) => session.activity === "course");
  const hasIntervals = body.sessions.some(
    (session) => session.effort === "fractionne" || session.effort === "circuit-hiit",
  );
  const completed = body.sessions.filter((session) => session.completed).length;
  const planned = body.sessions.length;
  const first = body.weightTrend7d[0]?.value;
  const last = body.weightTrend7d[body.weightTrend7d.length - 1]?.value;
  const deltaKg =
    first != null && last != null ? Number((last - first).toFixed(2)) : null;
  const weightLine =
    deltaKg == null
      ? "Pesées insuffisantes sur 7 j."
      : `${deltaKg >= 0 ? "+" : ""}${String(deltaKg).replace(".", ",")} kg sur 7 j.`;

  const sportAdjustments = localSportPatches(body, stressed);

  if (stressed) {
    const training = clampAgainstCurrent(
      current,
      { ...current, calories: current.calories + 80, carbs: current.carbs + 20 },
      true,
    );
    return {
      analysis: `Sur 7 jours : faim ${notes.hunger}/5, énergie ${notes.energy}/5, fatigue ${notes.fatigue}/5. ${weightLine} Séances ${completed}/${planned || 0} validées. La récupération prime : pas de coupe calorique cette semaine.`,
      nutrition: [
        "Maintenir les calories actuelles (pas de déficit supplémentaire)",
        hasRun ? "+20g glucides les jours de course" : "+15g glucides les jours d’entraînement",
        "Protéines stables pour protéger la masse musculaire",
      ],
      sport: [
        hasIntervals
          ? "Conserver la séance Zone 2, alléger le fractionné"
          : "Garder l’endurance, ne pas ajouter d’intensité",
        "Si fatigue ≥ 4 : raccourcir de 10–15 min plutôt que d’annuler",
      ],
      sportAdjustments,
      targets: current,
      trainingDay: training,
      restDay: current,
      calorieDelta: 0,
      proteinDelta: 0,
      carbsDelta: hasRun ? 20 : 15,
      caution: true,
    };
  }

  if (body.plateau && body.profile.primaryGoal === "perte") {
    const rest = clampAgainstCurrent(
      current,
      { ...current, calories: current.calories - 150, carbs: current.carbs - 20 },
      false,
    );
    const training = clampAgainstCurrent(
      current,
      { ...current, calories: current.calories + 80, carbs: current.carbs + 20 },
      false,
    );
    const average = clampAgainstCurrent(
      current,
      {
        calories: Math.round((training.calories + rest.calories) / 2),
        protein: current.protein,
        carbs: Math.round((training.carbs + rest.carbs) / 2),
        fat: current.fat,
      },
      false,
    );
    return {
      analysis: `Moyenne 7 j quasi plate (${body.latestMa7 ?? "n/a"} kg). Journal dimanche OK. Objectif ${goalLabel(body.profile.primaryGoal)} (${formatWeeklyRate(body.profile.weeklyRateKg)}) : micro-ajustement sur les jours de repos, glucides protégés à l’entraînement. ${weightLine}`,
      nutrition: [
        "−150 kcal les jours de repos (féculents du dîner)",
        hasRun ? "+20g glucides les jours de course" : "Jours d’entraînement : conserver les glucides",
        "Protéines inchangées",
      ],
      sport: [
        "Conserver le volume actuel",
        "Ajouter ~1000 pas hors sport si la fatigue reste ≤ 3",
      ],
      sportAdjustments,
      targets: average,
      trainingDay: training,
      restDay: rest,
      calorieDelta: average.calories - current.calories,
      proteinDelta: 0,
      carbsDelta: 0,
      caution: false,
    };
  }

  const training = clampAgainstCurrent(
    current,
    {
      ...current,
      calories: current.calories + (hasRun ? 80 : 40),
      carbs: current.carbs + (hasRun ? 20 : 10),
    },
    false,
  );
  return {
    analysis: `Objectif ${goalLabel(body.profile.primaryGoal)} · ${formatWeeklyRate(body.profile.weeklyRateKg)}. Notes dimanche sans alerte. ${weightLine} Séances ${completed}/${planned || 0} sur 7 j. On conserve la cible et on module seulement les glucides selon le sport.`,
    nutrition: [
      "Cible calorique inchangée en moyenne",
      hasRun ? "+20g glucides les jours de course" : "+10g glucides les jours d’entraînement",
      "Jours de repos : dîner low calorie inchangé",
    ],
    sport: [
      hasIntervals ? "Conserver la séance Zone 2 ; fractionné seulement si fraîcheur ≥ 3/5" : "Tenir le plan d’endurance",
      planned === 0 ? "Rien de prévu : une sortie Zone 2 légère si l’énergie le permet" : "Ne pas empiler d’intensité supplémentaire cette semaine",
    ],
    sportAdjustments,
    targets: current,
    trainingDay: training,
    restDay: current,
    calorieDelta: 0,
    proteinDelta: 0,
    carbsDelta: hasRun ? 20 : 10,
    caution: false,
  };
}

export function coachAnalysisPrompt(body: CoachAnalysisRequest) {
  const notes = body.journal.notes;
  const trend = body.weightTrend7d
    .map((point) => `${point.date}: ${point.value} kg (MA7 ${point.ma7})`)
    .join("\n");
  const sessions =
    body.sessions
      .map(
        (session) =>
          `- ${session.date} · ${session.label} · ${session.completed ? "validée (Strava)" : "prévue / non validée"}`,
      )
      .join("\n") || "(aucune séance planifiée sur 7 j)";
  const recent = body.recentJournals
    .slice(0, 3)
    .map(
      (entry) =>
        `- ${entry.date} faim=${entry.notes.hunger} énergie=${entry.notes.energy} fatigue=${entry.notes.fatigue}`,
    )
    .join("\n");
  const routine =
    (body.profile.sportRoutine?.sessions ?? [])
      .map(
        (session) =>
          `- ${session.activity} · ${session.effort} · ${session.durationMin} min${session.shared ? " · duo" : ""}`,
      )
      .join("\n") || "(aucune séance en routine)";

  return `Tu es le coach nutrition / sport Gemini Flash pour ${body.profile.name} (${body.profile.diet}, ${body.profile.heightCm} cm).
Fenêtre d'analyse : 7 derniers jours uniquement (pas 14).

Objectif : ${goalLabel(body.profile.primaryGoal)} · rythme ${formatWeeklyRate(body.profile.weeklyRateKg)}.
Poids actuel ${body.profile.currentWeightKg} kg · départ ${body.profile.startWeightKg} · cible ${body.profile.targetWeightKg}.
Moyenne 7 j : ${body.latestMa7 ?? "n/a"} · moyenne 14 j (contexte) : ${body.latestMa14 ?? "n/a"} · plateau_7j=${body.plateau}.
Cibles actuelles : ${body.currentTargets.calories} kcal · P ${body.currentTargets.protein}g · G ${body.currentTargets.carbs}g · L ${body.currentTargets.fat}g.

Pesées 7 j :
${trend || "(aucune)"}

Journal dimanche le plus récent (${body.journal.date}) :
humeur="${notes.mood}" victoires="${notes.wins}" freins="${notes.blockers}"
faim=${notes.hunger}/5 énergie=${notes.energy}/5 fatigue=${notes.fatigue}/5
${recent ? `Autres notes :\n${recent}` : ""}

Séances 7 j (prévues + validées Strava) :
${sessions}

Routine persistée (source Tab 2 / séance du jour) :
${routine}

Mission :
1. Analyser fatigue vs performance vs évolution du poids sur 7 j (3–5 phrases, français).
2. Proposer des micro-ajustements EXACTS (kcal, glucides, protéines) distincts jour d'entraînement vs jour de repos. Exemple : "+20g glucides les jours de course".
3. Ajuster l'intensité / la durée sport si faim/fatigue hautes (alléger fractionné → Zone 2, raccourcir 10 min). Ne pas inventer de nouvelles séances.

Règles :
- Si faim ≥ 4 OU fatigue ≥ 4 OU énergie ≤ 2 : INTERDIT de baisser les calories. calorie_delta = 0. Préférer glucides d'entraînement + récupération. sport_adjustments : duration_delta_min négatif (−10) et next_effort plus facile si fractionné / HIIT.
- Plateau perte ET notes OK : −150 kcal/j max, plutôt les jours de repos. Jamais plus de −200 kcal/j. sport_adjustments = [] (volume conservé).
- Prise de masse : ne pas couper les kcal.
- Maintien : viser ~0 de delta moyen.
- targets = cible journalière moyenne à appliquer aux anneaux / Gem Chef.
- training_day / rest_day = cibles absolues (pas des deltas).
- sport_adjustments.activity ∈ course|velo|muscu. effort / next_effort optionnels ∈ fractionne|sortie-longue|endurance|zone-2|circuit-hiit|force. duration_delta_min entre −20 et +10.

JSON uniquement :
{
  "analysis": "string FR",
  "nutrition": ["string", "string"],
  "sport": ["string", "string"],
  "sport_adjustments": [{ "activity": "course", "effort": "fractionne", "duration_delta_min": -10, "next_effort": "zone-2" }],
  "targets": { "calories": 0, "protein": 0, "carbs": 0, "fat": 0 },
  "training_day": { "calories": 0, "protein": 0, "carbs": 0, "fat": 0 },
  "rest_day": { "calories": 0, "protein": 0, "carbs": 0, "fat": 0 },
  "calorie_delta": 0,
  "protein_delta": 0,
  "carbs_delta": 0,
  "caution": false
}`;
}

export function parseCoachAnalysisJson(parsed: unknown, body: CoachAnalysisRequest): CoachAnalysis | null {
  if (!parsed || typeof parsed !== "object") return null;
  const rec = parsed as Record<string, unknown>;
  const analysis = typeof rec.analysis === "string" ? rec.analysis.trim() : "";
  if (!analysis) return null;

  const current = body.currentTargets;
  const stressed = isStressedWeek(body.journal.notes);
  const calorieDelta = clampDelta(Number(rec.calorie_delta ?? 0) || 0, stressed ? 0 : -200, 150);
  const proteinDelta = clampDelta(Number(rec.protein_delta ?? 0) || 0, -10, 25);
  const carbsDelta = clampDelta(Number(rec.carbs_delta ?? 0) || 0, -40, 50);

  const fromDeltas = applyDeltas(current, calorieDelta, proteinDelta, carbsDelta);
  const targets = clampAgainstCurrent(current, asMacros(rec.targets, fromDeltas), stressed);
  const trainingDay = clampAgainstCurrent(
    current,
    asMacros(rec.training_day ?? rec.trainingDay, {
      ...targets,
      calories: targets.calories + Math.max(0, carbsDelta * 4),
      carbs: targets.carbs + Math.max(0, carbsDelta),
    }),
    stressed,
  );
  const restDay = clampAgainstCurrent(
    current,
    asMacros(rec.rest_day ?? rec.restDay, {
      ...targets,
      calories: Math.min(targets.calories, current.calories + calorieDelta),
    }),
    stressed,
  );

  const nutrition = asLines(rec.nutrition);
  const sport = asLines(rec.sport);
  const parsedPatches = parseSportPatches(rec.sport_adjustments ?? rec.sportAdjustments);
  const fallback = localCoachAnalysis(body);

  return {
    analysis,
    nutrition: nutrition.length ? nutrition : fallback.nutrition,
    sport: sport.length ? sport : fallback.sport,
    sportAdjustments: parsedPatches.length ? parsedPatches : fallback.sportAdjustments,
    targets,
    trainingDay,
    restDay,
    calorieDelta: targets.calories - current.calories,
    proteinDelta: targets.protein - current.protein,
    carbsDelta: targets.carbs - current.carbs,
    caution: stressed || Boolean(rec.caution),
  };
}
