import { NextResponse } from "next/server";
import { analyzeFoodText } from "@/lib/food-log";
import { friendlyGeminiError } from "@/lib/gemini/models";
import type { DietType } from "@/lib/types";

export const maxDuration = 60;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { text?: string; diet?: DietType }
    | null;
  const text = body?.text?.trim() ?? "";
  if (!text) {
    return NextResponse.json({ error: "Texte vide" }, { status: 400 });
  }
  const diet: DietType = body?.diet === "omnivore" ? "omnivore" : "vegan";
  try {
    const ingredients = await analyzeFoodText(text, diet);
    return NextResponse.json({ ingredients });
  } catch (error) {
    const raw = error instanceof Error ? error.message : "Analyse indisponible";
    return NextResponse.json({ error: friendlyGeminiError(raw) }, { status: 502 });
  }
}
