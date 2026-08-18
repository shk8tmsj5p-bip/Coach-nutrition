import type { PrimaryGoal, Profile } from "@/lib/types";

export const GOAL_OPTIONS: { id: PrimaryGoal; label: string }[] = [
  { id: "perte", label: "Perte de poids" },
  { id: "maintien", label: "Maintien" },
  { id: "prise", label: "Prise de masse" },
];

export const RATE_OPTIONS: Record<PrimaryGoal, number[]> = {
  perte: [-0.3, -0.5, -0.75],
  maintien: [0],
  prise: [0.25, 0.5],
};

export function goalLabel(goal: PrimaryGoal) {
  return GOAL_OPTIONS.find((item) => item.id === goal)?.label ?? goal;
}

export function formatWeeklyRate(kg: number) {
  if (kg === 0) return "0 kg / sem";
  const sign = kg > 0 ? "+" : "−";
  return `${sign}${Math.abs(kg).toFixed(1).replace(".", ",")} kg / sem`;
}

export function progressPct(start: number, current: number, target: number, goal: PrimaryGoal) {
  if (goal === "maintien") {
    const delta = Math.abs(current - target);
    if (delta <= 0.5) return 100;
    return Math.min(100, Math.max(0, Math.round((1 - delta / 4) * 100)));
  }
  if (goal === "prise") {
    const total = target - start;
    if (total <= 0) return current >= target ? 100 : 0;
    return Math.min(100, Math.max(0, Math.round(((current - start) / total) * 100)));
  }
  const total = start - target;
  if (total <= 0) return current <= target ? 100 : 0;
  return Math.min(100, Math.max(0, Math.round(((start - current) / total) * 100)));
}

export function weightAtMilestone(start: number, target: number, milestone: number) {
  return Number((start + (target - start) * (milestone / 100)).toFixed(1));
}

export function defaultRateForGoal(goal: PrimaryGoal) {
  return RATE_OPTIONS[goal][goal === "perte" ? 1 : 0];
}

export type GoalPatch = Pick<
  Profile,
  "startWeightKg" | "targetWeightKg" | "primaryGoal" | "weeklyRateKg" | "sportRoutine"
>;
