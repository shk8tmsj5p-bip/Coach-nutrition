import { parseGeminiJson } from "@/lib/gemini/meals";
import { generateGeminiFlash } from "@/lib/gemini/flash";
import type { ProfileId } from "@/lib/types";

export type RenphoOcrResult = {
  profileGuess: ProfileId | null;
  date: string | null;
  poids: number | null;
  masseGrasse: number | null;
  masseMusculaire: number | null;
  tourTaille: number | null;
};

const OCR_PROMPT = `Tu lis une capture d'écran de l'app Renpho (balance connectée).
Extrais UNIQUEMENT les métriques visibles. Nombres avec point décimal.
Si une valeur est absente, mets null. Ne devine pas.

JSON :
{
  "profile_guess": "alexis" | "elodie" | null,
  "date": "YYYY-MM-DD" | null,
  "poids": 0,
  "masse_grasse": 0,
  "masse_musculaire": 0,
  "tour_taille": 0
}

Règles :
- poids = kg
- masse_grasse = % (Body fat)
- masse_musculaire = kg (Muscle mass / Skeletal muscle si c'est en kg)
- tour_taille = cm si présent, sinon null
- profile_guess = alexis si prénom / homme / ~80 kg ; elodie si femme / ~67 kg ; sinon null
Réponds UNIQUEMENT en JSON valide.`;

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function parseRenphoJson(parsed: unknown): RenphoOcrResult {
  const rec = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  const guess = rec.profile_guess;
  return {
    profileGuess: guess === "alexis" || guess === "elodie" ? guess : null,
    date: typeof rec.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rec.date) ? rec.date : null,
    poids: num(rec.poids ?? rec.weight_kg ?? rec.weight),
    masseGrasse: num(rec.masse_grasse ?? rec.fat_pct ?? rec.body_fat),
    masseMusculaire: num(rec.masse_musculaire ?? rec.muscle_kg ?? rec.muscle),
    tourTaille: num(rec.tour_taille ?? rec.waist),
  };
}

export function mockRenphoOcr(profileId: ProfileId): RenphoOcrResult {
  if (profileId === "elodie") {
    return {
      profileGuess: "elodie",
      date: null,
      poids: 67.5,
      masseGrasse: 27.2,
      masseMusculaire: 45.0,
      tourTaille: null,
    };
  }
  return {
    profileGuess: "alexis",
    date: null,
    poids: 82.0,
    masseGrasse: 21.3,
    masseMusculaire: 62.4,
    tourTaille: null,
  };
}

export async function callGeminiFlashVision(
  imageBase64: string,
  mimeType: string,
): Promise<{ text: string }> {
  const text = await generateGeminiFlash({
    temperature: 0.1,
    parts: [
      { text: OCR_PROMPT },
      { inlineData: { mimeType, data: imageBase64 } },
    ],
  });
  return { text };
}

export function extractRenphoFromText(text: string): RenphoOcrResult {
  return parseRenphoJson(parseGeminiJson(text));
}
