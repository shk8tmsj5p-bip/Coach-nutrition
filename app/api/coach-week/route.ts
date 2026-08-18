import { NextResponse } from "next/server";
import { callGeminiFlashText, coachPrompt, parseCoachJson } from "@/lib/gemini/coach";
import { parseGeminiJson } from "@/lib/gemini/meals";
import { friendlyGeminiError } from "@/lib/gemini/models";
import type { Pesee, Profile, SundayJournalFields } from "@/lib/types";

export const maxDuration = 60;

type Body = {
  profile: Profile;
  journals: Array<{ date: string; notes: SundayJournalFields }>;
  stats: { currentKg: number; ma7: number | null; ma14: number | null; plateau: boolean };
  pesees?: Pesee[];
};

export async function POST(request: Request) {
  const body = (await request.json()) as Body;
  if (!body.profile) {
    return NextResponse.json({ error: "Profil manquant" }, { status: 400 });
  }

  try {
    const text = await callGeminiFlashText(
      coachPrompt(body.profile, body.journals ?? [], body.stats),
    );
    const parsed = parseCoachJson(parseGeminiJson(text));
    if (!parsed) {
      return NextResponse.json(
        { error: friendlyGeminiError("Réponse Gemini incomplète"), mock: false },
        { status: 502 },
      );
    }
    const latest = body.journals?.[0]?.notes;
    const stressed =
      (latest?.hunger ?? 3) >= 4 || (latest?.fatigue ?? 3) >= 4 || (latest?.energy ?? 3) <= 2;
    if (stressed && parsed.calorieDelta < 0) {
      parsed.calorieDelta = 0;
      parsed.caution = true;
      parsed.message = `${parsed.message} Baisse calorique annulée : faim/fatigue trop hautes.`;
    }
    return NextResponse.json({ adjustment: parsed, mock: false });
  } catch (error) {
    const raw = error instanceof Error ? error.message : "Coach indisponible";
    console.error("[COACH GEN] no mock fallback —", raw);
    return NextResponse.json({ error: friendlyGeminiError(raw), mock: false }, { status: 502 });
  }
}
