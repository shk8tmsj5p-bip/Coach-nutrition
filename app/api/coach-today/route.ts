import { NextResponse } from "next/server";
import { proposeCoachToday } from "@/lib/gemini/coach-today";
import { friendlyGeminiError } from "@/lib/gemini/models";
import { localCoachTodayActions, type CoachTodaySnapshot } from "@/lib/today-coach";

export const maxDuration = 90;

function asSnapshot(value: unknown): CoachTodaySnapshot | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as Record<string, unknown>;
  const goal = rec.goal === "prise" || rec.goal === "maintien" ? rec.goal : "perte";
  const period = rec.period === "matin" || rec.period === "midi" || rec.period === "soir" ? rec.period : "midi";
  const diet = rec.diet === "omnivore" ? "omnivore" : "vegan";
  const n = (key: string) => {
    const num = Number(rec[key]);
    return Number.isFinite(num) ? num : 0;
  };
  return {
    name: typeof rec.name === "string" && rec.name.trim() ? rec.name.trim() : "Alexis",
    diet,
    goal,
    hour: n("hour"),
    period,
    hunger: n("hunger") || 3,
    energy: n("energy") || 3,
    fatigue: n("fatigue") || 3,
    eaten: n("eaten"),
    remaining: n("remaining"),
    target: n("target"),
    burned: n("burned"),
    live: Boolean(rec.live),
    steps: n("steps"),
    activeKcal: n("activeKcal"),
    sportKcal: n("sportKcal"),
    doneMin: n("doneMin"),
    plannedMin: n("plannedMin"),
    pendingMin: n("pendingMin"),
    pendingLabel: typeof rec.pendingLabel === "string" ? rec.pendingLabel : "",
    extraSport: Boolean(rec.extraSport),
    nextSlot:
      rec.nextSlot === "petit-dejeuner" ||
      rec.nextSlot === "dejeuner" ||
      rec.nextSlot === "diner" ||
      rec.nextSlot === "collation"
        ? rec.nextSlot
        : null,
    meals: Array.isArray(rec.meals)
      ? rec.meals.map((item) => {
          const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
          const type =
            row.type === "petit-dejeuner" ||
            row.type === "dejeuner" ||
            row.type === "diner" ||
            row.type === "collation"
              ? row.type
              : "dejeuner";
          return {
            type,
            name: typeof row.name === "string" ? row.name : type,
            skipped: Boolean(row.skipped),
            kcal: Number(row.kcal) || 0,
          };
        })
      : [],
    workouts: Array.isArray(rec.workouts)
      ? rec.workouts.map((item) => {
          const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
          return {
            name: typeof row.name === "string" ? row.name : "Séance",
            durationMin: Number(row.durationMin) || 0,
            kcal: Number(row.kcal) || 0,
          };
        })
      : [],
  };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { snapshot?: unknown } | null;
  const snapshot = asSnapshot(body?.snapshot);
  if (!snapshot) {
    return NextResponse.json({ error: "Contexte du jour manquant" }, { status: 400 });
  }
  try {
    const advice = await proposeCoachToday(snapshot);
    return NextResponse.json({ advice });
  } catch (error) {
    const raw = error instanceof Error ? error.message : "Coach indisponible";
    return NextResponse.json(
      {
        error: friendlyGeminiError(raw),
        advice: {
          title: "3 actions (hors ligne)",
          actions: localCoachTodayActions(snapshot),
        },
      },
      { status: 200 },
    );
  }
}
