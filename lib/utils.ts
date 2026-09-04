export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function formatKcal(value: number) {
  return `${Math.round(value).toLocaleString("fr-FR")} kcal`;
}

export function formatSteps(value: number) {
  return value.toLocaleString("fr-FR");
}

export function formatKm(value: number) {
  const digits = value >= 10 ? 1 : 2;
  return `${value.toFixed(digits).replace(".", ",")} km`;
}

export function formatMin(value: number) {
  return `${Math.round(value)} min`;
}

/** kcal actives hors séances, sans double-compter Apple Watch. */
export function passiveKcalFromMovement(activeEnergyKcal: number, workoutKcal: number) {
  return Math.max(0, Math.round(activeEnergyKcal - workoutKcal));
}

export function formatKg(value: number, digits = 1) {
  return `${value.toFixed(digits).replace(".", ",")} kg`;
}

export function percentOf(current: number, target: number) {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((current / target) * 100));
}

export function withinTolerance(current: number, target: number, tolerance = 0.05) {
  return Math.abs(current - target) / target <= tolerance;
}

export function movingAverage(values: number[], window: number) {
  if (values.length === 0) return [];
  return values.map((_, index) => {
    const start = Math.max(0, index - window + 1);
    const slice = values.slice(start, index + 1);
    return slice.reduce((sum, n) => sum + n, 0) / slice.length;
  });
}

export function mealTypeLabel(type: string) {
  switch (type) {
    case "petit-dejeuner":
      return "Petit-déjeuner";
    case "dejeuner":
      return "Déjeuner";
    case "diner":
      return "Dîner";
    case "collation":
      return "Collation";
    default:
      return type;
  }
}
