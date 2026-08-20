import { NextResponse } from "next/server";
import { DEFAULT_HYPERTROPHY, parseHypertrophy, proposeHypertrophyProgram } from "@/lib/hypertrophy";
import { friendlyGeminiError } from "@/lib/gemini/models";
import type { DietType, ProfileId } from "@/lib/types";

export const maxDuration = 90;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    name?: string;
    diet?: DietType;
    profileId?: ProfileId;
    prefs?: unknown;
    currentMuscuDays?: number;
  } | null;
  if (!body) {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  const prefs = parseHypertrophy(body.prefs) ?? DEFAULT_HYPERTROPHY;
  const profileId = body.profileId === "elodie" ? "elodie" : "alexis";
  try {
    const proposal = await proposeHypertrophyProgram({
      name: body.name?.trim() || "Athlète",
      diet: body.diet === "omnivore" ? "omnivore" : "vegan",
      prefs,
      currentMuscuDays: Number(body.currentMuscuDays) || 0,
      profileId,
    });
    return NextResponse.json({ proposal });
  } catch (error) {
    const raw = error instanceof Error ? error.message : "Programme indisponible";
    return NextResponse.json({ error: friendlyGeminiError(raw) }, { status: 502 });
  }
}
