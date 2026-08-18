import { NextResponse } from "next/server";
import { callGeminiFlashText } from "@/lib/gemini/coach";
import {
  coachAnalysisPrompt,
  parseCoachAnalysisJson,
  type CoachAnalysisRequest,
} from "@/lib/gemini/coach-analysis";
import { friendlyGeminiError } from "@/lib/gemini/models";
import { parseGeminiJson } from "@/lib/gemini/meals";

export const maxDuration = 60;

export async function POST(request: Request) {
  const body = (await request.json()) as CoachAnalysisRequest;
  if (!body?.profile) {
    return NextResponse.json({ error: "Profil manquant" }, { status: 400 });
  }

  const requestBody: CoachAnalysisRequest = {
    ...body,
    currentTargets: body.currentTargets ?? body.profile.targets,
    weightTrend7d: body.weightTrend7d ?? [],
    sessions: body.sessions ?? [],
    recentJournals: body.recentJournals ?? [],
    journal: body.journal ?? { date: "", notes: { mood: "", wins: "", blockers: "", hunger: 3, energy: 3, fatigue: 3 } },
  };

  try {
    const text = await callGeminiFlashText(coachAnalysisPrompt(requestBody));
    const parsed = parseCoachAnalysisJson(parseGeminiJson(text), requestBody);
    if (!parsed) {
      return NextResponse.json(
        { error: friendlyGeminiError("Réponse Gemini incomplète"), mock: false },
        { status: 502 },
      );
    }
    return NextResponse.json({ analysis: parsed, mock: false });
  } catch (error) {
    const raw = error instanceof Error ? error.message : "Coach indisponible";
    console.error("[COACH GEN] no mock fallback —", raw);
    return NextResponse.json({ error: friendlyGeminiError(raw), mock: false }, { status: 502 });
  }
}
