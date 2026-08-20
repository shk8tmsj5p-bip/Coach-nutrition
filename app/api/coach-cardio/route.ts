import { NextResponse } from "next/server";
import { initialCardioPrefs, parseCardio, proposeCardioProgram } from "@/lib/cardio";
import { friendlyGeminiError } from "@/lib/gemini/models";
import type { PrimaryGoal, ProfileId } from "@/lib/types";

export const maxDuration = 90;

function parseGoal(value: unknown): PrimaryGoal {
  return value === "prise" || value === "maintien" ? value : "perte";
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    name?: string;
    profileId?: ProfileId;
    goal?: PrimaryGoal;
    weeklyRateKg?: number;
    prefs?: unknown;
  } | null;
  if (!body) {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  const prefs = parseCardio(body.prefs) ?? initialCardioPrefs({ sessions: [] });
  const profileId = body.profileId === "elodie" ? "elodie" : "alexis";
  try {
    const proposal = await proposeCardioProgram({
      name: body.name?.trim() || "Athlète",
      goal: parseGoal(body.goal),
      weeklyRateKg: Number(body.weeklyRateKg) || 0,
      prefs,
      profileId,
    });
    return NextResponse.json({ proposal });
  } catch (error) {
    const raw = error instanceof Error ? error.message : "Programme indisponible";
    return NextResponse.json({ error: friendlyGeminiError(raw) }, { status: 502 });
  }
}
