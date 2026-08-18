import { parseGeminiJson } from "@/lib/gemini/meals";
import { generateGeminiFlash } from "@/lib/gemini/flash";
import type { Pesee, Profile, SundayJournalFields } from "@/lib/types";
import { formatWeeklyRate, goalLabel } from "@/lib/goals";
import { parseJournalNotes } from "@/lib/pesees";

export type CoachAdjustment = {
  title: string;
  message: string;
  calorieDelta: number;
  stepsDelta: number;
  caution: boolean;
};

function clampDelta(value: number) {
  return Math.max(-200, Math.min(150, Math.round(value / 10) * 10));
}

export function localCoachAdjustment(
  profile: Profile,
  journals: Array<{ date: string; notes: SundayJournalFields }>,
  plateau: boolean,
): CoachAdjustment {
  const latest = journals[0]?.notes;
  const highHunger = (latest?.hunger ?? 3) >= 4;
  const highFatigue = (latest?.fatigue ?? 3) >= 4;
  const lowEnergy = (latest?.energy ?? 3) <= 2;
  const stressed = highHunger || highFatigue || lowEnergy;

  if (stressed) {
    return {
      title: "Protection récupération",
      message: `Notes dimanche : faim ${latest?.hunger ?? "—"}/5, énergie ${latest?.energy ?? "—"}/5, fatigue ${latest?.fatigue ?? "—"}/5. Pas de baisse calorique agressive cette semaine. Objectif ${goalLabel(profile.primaryGoal)} (${formatWeeklyRate(profile.weeklyRateKg)}) : maintenir les kcal, +1000 pas si possible.`,
      calorieDelta: 0,
      stepsDelta: 1000,
      caution: true,
    };
  }

  if (plateau && profile.primaryGoal === "perte") {
    return {
      title: "Plateau 7–14 j",
      message: `Moyennes stables. Ajustement doux : −150 kcal/j ou +1000 pas. Rythme cible ${formatWeeklyRate(profile.weeklyRateKg)}.`,
      calorieDelta: -150,
      stepsDelta: 1000,
      caution: false,
    };
  }

  return {
    title: "Rythme tenu",
    message: `Objectif ${goalLabel(profile.primaryGoal)} · ${formatWeeklyRate(profile.weeklyRateKg)}. Les notes du dimanche ne signalent pas de surcharge. On conserve la cible actuelle.`,
    calorieDelta: 0,
    stepsDelta: 0,
    caution: false,
  };
}

export function journalsFromPesees(rows: Pesee[]) {
  return rows
    .filter((row) => row.journalNotes)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((row) => ({ date: row.date, notes: parseJournalNotes(row.journalNotes) }));
}

export function coachPrompt(
  profile: Profile,
  journals: Array<{ date: string; notes: SundayJournalFields }>,
  stats: { currentKg: number; ma7: number | null; ma14: number | null; plateau: boolean },
) {
  const notes = journals
    .slice(0, 4)
    .map(
      (entry) =>
        `- ${entry.date} : humeur="${entry.notes.mood}" victoires="${entry.notes.wins}" freins="${entry.notes.blockers}" faim=${entry.notes.hunger}/5 énergie=${entry.notes.energy}/5 fatigue=${entry.notes.fatigue}/5`,
    )
    .join("\n");

  return `Tu es le coach nutrition Gemini Flash pour ${profile.name} (${profile.diet}, ${profile.heightCm} cm).
Objectif primaire : ${goalLabel(profile.primaryGoal)}.
Rythme hebdo cible : ${formatWeeklyRate(profile.weeklyRateKg)}.
Poids actuel ${stats.currentKg} kg · départ ${profile.startWeightKg} · cible ${profile.targetWeightKg}.
Moyenne 7 j : ${stats.ma7 ?? "n/a"} · moyenne 14 j : ${stats.ma14 ?? "n/a"} · plateau=${stats.plateau}.

Notes qualitatives du journal dimanche (les plus récentes d'abord) :
${notes || "(aucune note)"}

Règles d'ajustement métabolique hebdo :
- Si faim ≥ 4 OU fatigue ≥ 4 OU énergie ≤ 2 : INTERDIT de baisser les calories. calorie_delta = 0. Proposer +pas ou récupération.
- Plateau perte (moy. 7 j plate) ET notes OK : −150 kcal/j max OU +1000 pas, jamais les deux agressifs.
- Jamais plus de −200 kcal/j.
- Prise de masse : ne pas couper les kcal.
- Maintien : viser 0 kcal de delta.

JSON :
{ "title": "string", "message": "string en français, 2-3 phrases", "calorie_delta": 0, "steps_delta": 0, "caution": false }`;
}

export function parseCoachJson(parsed: unknown): CoachAdjustment | null {
  if (!parsed || typeof parsed !== "object") return null;
  const rec = parsed as Record<string, unknown>;
  const message = typeof rec.message === "string" ? rec.message : "";
  if (!message) return null;
  return {
    title: typeof rec.title === "string" ? rec.title : "Ajustement semaine",
    message,
    calorieDelta: clampDelta(Number(rec.calorie_delta ?? 0) || 0),
    stepsDelta: Math.round(Number(rec.steps_delta ?? 0) || 0),
    caution: Boolean(rec.caution),
  };
}

export async function callGeminiFlashText(prompt: string): Promise<string> {
  return generateGeminiFlash({ parts: [{ text: prompt }], temperature: 0.4 });
}
