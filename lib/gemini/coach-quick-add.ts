import { gramsFromMacro, type MacroKind } from "@/lib/coach-ingredients";
import { generateGeminiJson } from "@/lib/gemini/models";
import { parseGeminiJson } from "@/lib/gemini/meals";
import type { DietType, MealType } from "@/lib/types";
import { mealTypeLabel } from "@/lib/utils";

export type CoachQuickSlot = {
  mealId: string;
  mealName: string;
  mealType: MealType;
  items: string[];
  kind: MacroKind;
  macroG: number;
  idealName: string;
  avoid: string[];
};

export type CoachQuickSuggestion = {
  mealId: string;
  kind: MacroKind;
  name: string;
  grams: number;
};

const KIND_FR: Record<MacroKind, string> = {
  carbs: "glucides",
  protein: "protéines",
  fat: "lipides",
};

function slotBlock(slot: CoachQuickSlot, index: number) {
  const lines = slot.items.slice(0, 14).join(" · ") || "(aucun ingrédient)";
  const avoid = slot.avoid.length ? slot.avoid.join(", ") : "—";
  return `${index + 1}. mealId=${slot.mealId}
Type : ${mealTypeLabel(slot.mealType)}
Plat : ${slot.mealName || mealTypeLabel(slot.mealType)}
Ingrédients : ${lines}
À compenser : +${Math.abs(slot.macroG)} g de ${KIND_FR[slot.kind]}
Idéal (prochaine préparation, NE PAS le reproposer) : ${slot.idealName}
Déjà proposés / indisponibles : ${avoid}`;
}

export function coachQuickAddPrompt(opts: {
  name: string;
  diet: DietType;
  aversions: string[];
  slots: CoachQuickSlot[];
}) {
  const diet = opts.diet === "omnivore" ? "omnivore" : "vegan (aucun produit animal)";
  const aversions = opts.aversions.filter(Boolean).join(", ") || "aucune";
  return `Tu es le coach nutrition du foyer. ${opts.name} est ${diet}.
Aversions à OMETTRE silencieusement (jamais « sans X ») : ${aversions}. Interdit aussi : coriandre, chou-fleur, piment, pastèque, fenouil, seitan, tempeh, beurre de cacahuète, mangue.

Pour CHAQUE créneau, propose 1 SEUL aliment à ajouter MAINTENANT sur le plat déjà préparé / déjà en boîte.
Contraintes :
- Doit S'INTÉGRER à CE plat (goût, texture, température). Pas un 2e repas à côté.
- Quasi aucune préparation : frigo / placard, pas de cuisson, pas de batch, pas de remix overnight oats.
- Quantité en grammes calée sur le macro demandé.
- INTERDIT de proposer l'idéal (prochaine préparation) ni un aliment de la liste « déjà proposés ».
- Pas de dessert.

JSON uniquement :
{ "suggestions": [{ "mealId": "...", "kind": "carbs"|"protein"|"fat", "name": "...", "grams": 80 }] }

Créneaux :
${opts.slots.map((slot, index) => slotBlock(slot, index)).join("\n\n")}`;
}

function asKind(value: unknown): MacroKind | null {
  return value === "carbs" || value === "protein" || value === "fat" ? value : null;
}

export function parseCoachQuickSuggestions(
  parsed: unknown,
  slots: CoachQuickSlot[],
): CoachQuickSuggestion[] {
  if (!parsed || typeof parsed !== "object") return [];
  const rec = parsed as Record<string, unknown>;
  const rawList = Array.isArray(rec.suggestions)
    ? rec.suggestions
    : rec.name
      ? [parsed]
      : [];
  const out: CoachQuickSuggestion[] = [];
  for (const item of rawList) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const mealId = typeof row.mealId === "string" ? row.mealId : slots[0]?.mealId;
    const slot =
      slots.find((entry) => entry.mealId === mealId && (!row.kind || asKind(row.kind) === entry.kind)) ??
      slots.find((entry) => entry.mealId === mealId) ??
      slots[0];
    if (!slot) continue;
    const name = String(row.name ?? row.ingredient ?? "").replace(/\s+/g, " ").trim();
    if (!name || name.length > 48) continue;
    const gramsRaw = Number(row.grams ?? row.weight_g ?? row.qty);
    const grams = Number.isFinite(gramsRaw) && gramsRaw > 0
      ? Math.round(gramsRaw)
      : gramsFromMacro(name, slot.kind, slot.mealType, slot.macroG);
    if (grams <= 0) continue;
    out.push({ mealId: slot.mealId, kind: slot.kind, name, grams: Math.max(5, Math.round(grams / 5) * 5) });
  }
  return out;
}

export async function proposeCoachQuickAdds(opts: {
  name: string;
  diet: DietType;
  aversions: string[];
  slots: CoachQuickSlot[];
}): Promise<{ suggestions: CoachQuickSuggestion[]; warning?: string }> {
  if (opts.slots.length === 0) return { suggestions: [] };
  const result = await generateGeminiJson({
    preferredTier: "flash",
    parts: [{ text: coachQuickAddPrompt(opts) }],
    temperature: 0.75,
    logLabel: "COACH QUICK",
  });
  const suggestions = parseCoachQuickSuggestions(parseGeminiJson(result.text), opts.slots);
  if (suggestions.length === 0) {
    throw new Error("Réponse Gemini incomplète");
  }
  return { suggestions, warning: result.warning };
}
