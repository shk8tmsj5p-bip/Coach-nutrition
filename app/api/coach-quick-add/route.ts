import { NextResponse } from "next/server";
import { proposeCoachQuickAdds, type CoachQuickSlot } from "@/lib/gemini/coach-quick-add";
import { friendlyGeminiError } from "@/lib/gemini/models";
import type { DietType, MealType } from "@/lib/types";
import type { MacroKind } from "@/lib/coach-ingredients";

export const maxDuration = 60;

function asKind(value: unknown): MacroKind | null {
  return value === "carbs" || value === "protein" || value === "fat" ? value : null;
}

function asMealType(value: unknown): MealType | null {
  return value === "petit-dejeuner" || value === "dejeuner" || value === "diner" || value === "collation"
    ? value
    : null;
}

function parseSlot(value: unknown): CoachQuickSlot | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  const mealType = asMealType(rec.mealType);
  const kind = asKind(rec.kind);
  const mealId = typeof rec.mealId === "string" ? rec.mealId.trim() : "";
  if (!mealType || !kind || !mealId) return null;
  const items = Array.isArray(rec.items) ? rec.items.map(String).filter(Boolean) : [];
  return {
    mealId,
    mealName: typeof rec.mealName === "string" ? rec.mealName : "",
    mealType,
    items,
    kind,
    macroG: Math.abs(Math.round(Number(rec.macroG) || 0)),
    idealName: typeof rec.idealName === "string" ? rec.idealName : "",
    avoid: Array.isArray(rec.avoid) ? rec.avoid.map(String).filter(Boolean) : [],
  };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    name?: string;
    diet?: DietType;
    aversions?: string[];
    slots?: unknown[];
  } | null;
  const slots = (body?.slots ?? []).map(parseSlot).filter((item): item is CoachQuickSlot => Boolean(item));
  if (slots.length === 0) {
    return NextResponse.json({ error: "Aucun repas à compléter" }, { status: 400 });
  }
  try {
    const result = await proposeCoachQuickAdds({
      name: body?.name?.trim() || "Alexis",
      diet: body?.diet === "omnivore" ? "omnivore" : "vegan",
      aversions: Array.isArray(body?.aversions) ? body.aversions.map(String) : [],
      slots,
    });
    return NextResponse.json(result);
  } catch (error) {
    const raw = error instanceof Error ? error.message : "Suggestion indisponible";
    return NextResponse.json({ error: friendlyGeminiError(raw) }, { status: 502 });
  }
}
