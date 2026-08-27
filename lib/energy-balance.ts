import { TONE_COLOR } from "@/lib/macro-status";
import type { PrimaryGoal } from "@/lib/types";

export function formatSignedKcal(delta: number) {
  const n = Math.round(Math.abs(delta)).toLocaleString("fr-FR");
  if (delta > 0) return `+${n}`;
  if (delta < 0) return `−${n}`;
  return "0";
}

/** Déficit / surplus = mangées − brûlées Santé. Couleur vs l’objectif. */
export function energyBalanceLook(eaten: number, burned: number, goal: PrimaryGoal) {
  const net = Math.round(eaten - burned);
  const near = Math.abs(net) <= Math.max(80, burned * 0.05);
  if (near) {
    return { net: 0, label: "Équilibre", color: TONE_COLOR.good };
  }
  const surplus = net > 0;
  if (goal === "prise") {
    return {
      net,
      label: surplus ? "Surplus" : "Déficit",
      color: surplus ? TONE_COLOR.good : TONE_COLOR.bad,
    };
  }
  if (goal === "maintien") {
    return {
      net,
      label: surplus ? "Surplus" : "Déficit",
      color: TONE_COLOR.warn,
    };
  }
  return {
    net,
    label: surplus ? "Surplus" : "Déficit",
    color: surplus ? TONE_COLOR.bad : TONE_COLOR.good,
  };
}
