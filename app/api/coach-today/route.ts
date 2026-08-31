import { NextResponse } from "next/server";
import { parseFeelMoodRequired } from "@/lib/cat-feel";
import { proposeCoachToday } from "@/lib/gemini/coach-today";
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
    hunger: parseFeelMoodRequired(rec.hunger, "hunger"),
    energy: parseFeelMoodRequired(rec.energy, "energy"),
    fatigue: parseFeelMoodRequired(rec.fatigue, "fatigue"),
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
  let snapshot: CoachTodaySnapshot | null = null;
  try {
    snapshot = asSnapshot(body?.snapshot);
  } catch {
    snapshot = null;
  }
  if (!snapshot) {
    return NextResponse.json({ error: "Contexte du jour manquant" }, { status: 400 });
  }
  try {
    const advice = await proposeCoachToday(snapshot);
    return NextResponse.json({ advice });
  } catch {
    return NextResponse.json({
      advice: {
        title: "3 actions",
        actions: localCoachTodayActions(snapshot),
      },
    });
  }
}
