import { goalLabel } from "@/lib/goals";
import { parseGeminiJson } from "@/lib/gemini/meals";
import { callGeminiFlashText } from "@/lib/gemini/coach";
import { mealTypeLabel } from "@/lib/utils";
import {
  localCoachTodayActions,
  type CoachTodayAction,
  type CoachTodaySnapshot,
} from "@/lib/today-coach";

export type CoachTodayAdvice = {
  title: string;
  actions: CoachTodayAction[];
};

function asActions(value: unknown): CoachTodayAction[] {
  if (!Array.isArray(value)) return [];
  const actions: CoachTodayAction[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const label = typeof rec.label === "string" ? rec.label.trim() : "";
    const detail = typeof rec.detail === "string" ? rec.detail.trim() : "";
    if (!label || !detail) continue;
    actions.push({ label, detail });
    if (actions.length >= 3) break;
  }
  return actions;
}

export function parseCoachTodayAdvice(
  parsed: unknown,
  snapshot: CoachTodaySnapshot,
): CoachTodayAdvice {
  const rec = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  const title = typeof rec.title === "string" && rec.title.trim() ? rec.title.trim() : "3 actions pour maintenant";
  const actions = asActions(rec.actions);
  return {
    title,
    actions: actions.length ? actions : localCoachTodayActions(snapshot),
  };
}

export function coachTodayPrompt(snapshot: CoachTodaySnapshot) {
  const meals = snapshot.meals
    .map((meal) => {
      if (meal.skipped) return `- ${mealTypeLabel(meal.type)} : SAUTÉ (ne rien proposer d’y ajouter)`;
      if (meal.kcal > 0) return `- ${mealTypeLabel(meal.type)} : ${meal.name} · ${Math.round(meal.kcal)} kcal`;
      return `- ${mealTypeLabel(meal.type)} : pas encore loggé`;
    })
    .join("\n");
  const workouts =
    snapshot.workouts
      .map((workout) => `- ${workout.name} · ${workout.durationMin} min · ${Math.round(workout.kcal)} kcal`)
      .join("\n") || "(aucune séance Santé / Watch)";
  const next = snapshot.nextSlot ? mealTypeLabel(snapshot.nextSlot) : "aucun (créneaux ouverts épuisés)";

  return `Tu es le coach du foyer, Gemini Flash, pour ${snapshot.name} (${snapshot.diet}).
Moment : ${snapshot.period} (il est ${snapshot.hour} h à Paris).
Objectif : ${goalLabel(snapshot.goal)}.

RESSENTI DU JOUR (obligatoire de t’en servir — 3 conseils DIFFÉRENTS si les notes changent) :
faim=${snapshot.hunger}/5  énergie=${snapshot.energy}/5  fatigue=${snapshot.fatigue}/5
- faim ≥ 4 : INTERDIT de couper les kcal. Volume / protéines, repas plus tôt.
- énergie ≤ 2 ou fatigue ≥ 4 : INTERDIT de pousser le fractionné / HIIT. Zone 2 ou −10 min. Pas de coupe.
- énergie ≥ 4 et fatigue ≤ 2 et faim ≤ 3 : tu peux valider une séance exigeante encore prévue.

Assiette : ${Math.round(snapshot.eaten)} mangées · encore ~${Math.round(snapshot.remaining)} sur les créneaux ENCORE OUVERTS · cible ${Math.round(snapshot.target)} kcal.
Dépense : ${snapshot.live ? `~${Math.round(snapshot.burned)} kcal (repos + actif Apple Santé)` : "Santé pas encore sync, viser la cible"}.
Pas : ${snapshot.steps}. Actif Santé : ${Math.round(snapshot.activeKcal)} kcal.
Prochain levier (jamais un repas sauté) : ${next}.

Repas :
${meals}

Séances prévues encore à faire : ${snapshot.pendingMin > 0 ? `${snapshot.pendingMin} min · ${snapshot.pendingLabel}` : "rien en attente"}.
Séances déjà loggées :
${workouts}

Mission : exactement 2 ou 3 actions CONCRÈTES pour les prochaines heures (un aliment, un créneau, une séance). Français, tutoiement. Pas de jargon BMR/TDEE. Pas d’inventer de FC / D+ / fractionné mesuré.

JSON uniquement :
{ "title": "string court", "actions": [{ "label": "verbe + objet", "detail": "1 phrase pourquoi, liée aux notes faim/énergie/fatigue" }] }`;
}

export async function proposeCoachToday(snapshot: CoachTodaySnapshot): Promise<CoachTodayAdvice> {
  const text = await callGeminiFlashText(coachTodayPrompt(snapshot));
  return parseCoachTodayAdvice(parseGeminiJson(text), snapshot);
}
