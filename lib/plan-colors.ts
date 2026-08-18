import type { AisleName } from "@/lib/shopping-from-plan";

export const RECIPE_TAG_TONES = [
  "bg-coral-soft text-coral-dark",
  "bg-violet-soft text-violet-dark",
  "bg-amber-100 text-amber-800",
  "bg-sky-100 text-sky-800",
  "bg-rose-100 text-rose-800",
  "bg-teal-100 text-teal-800",
] as const;

export function recipeTagClass(tag: string) {
  const n = Number(String(tag).replace(/\D/g, "")) || 1;
  return RECIPE_TAG_TONES[(n - 1) % RECIPE_TAG_TONES.length];
}

export const AISLE_STYLE: Record<
  AisleName,
  { header: string; dot: string; card: string; text: string; hex: string }
> = {
  "FRUITS & LÉGUMES": {
    header: "bg-emerald-50 text-emerald-800",
    dot: "bg-emerald-500",
    card: "border-emerald-100",
    text: "text-emerald-800",
    hex: "#10B981",
  },
  "FRAIS / RAYON BIO": {
    header: "bg-sky-50 text-sky-800",
    dot: "bg-sky-500",
    card: "border-sky-100",
    text: "text-sky-800",
    hex: "#0EA5E9",
  },
  "VIANDES & POISSONS": {
    header: "bg-rose-50 text-rose-800",
    dot: "bg-rose-500",
    card: "border-rose-100",
    text: "text-rose-800",
    hex: "#F43F5E",
  },
  BOULANGERIE: {
    header: "bg-amber-50 text-amber-900",
    dot: "bg-amber-500",
    card: "border-amber-100",
    text: "text-amber-900",
    hex: "#F59E0B",
  },
  "ÉPICERIE SALÉE": {
    header: "bg-orange-50 text-orange-800",
    dot: "bg-orange-400",
    card: "border-orange-100",
    text: "text-orange-800",
    hex: "#FB923C",
  },
  "ÉPICES & CONDIMENTS": {
    header: "bg-violet-soft text-violet-dark",
    dot: "bg-violet",
    card: "border-violet/20",
    text: "text-violet-dark",
    hex: "#6B7CFF",
  },
  SURGELÉS: {
    header: "bg-cyan-50 text-cyan-800",
    dot: "bg-cyan-500",
    card: "border-cyan-100",
    text: "text-cyan-800",
    hex: "#06B6D4",
  },
  AUTRE: {
    header: "bg-health-bg text-health-muted",
    dot: "bg-health-muted",
    card: "border-health-line",
    text: "text-health-muted",
    hex: "#8E8E93",
  },
};

export function aisleStyle(aisle: string) {
  return AISLE_STYLE[aisle as AisleName] ?? AISLE_STYLE.AUTRE;
}
