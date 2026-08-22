const TZ = "Europe/Paris";

export function todayISO(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(date);
}

export function yesterdayISO() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return todayISO(d);
}

export function addDaysISO(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return todayISO(d);
}

export function mondayOf(iso = todayISO()) {
  const d = new Date(`${iso}T12:00:00`);
  const weekday = d.getDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  return addDaysISO(iso, diff);
}

export function formatWeekRange(weekStart: string) {
  const end = addDaysISO(weekStart, 6);
  const startDate = new Date(`${weekStart}T12:00:00`);
  const endDate = new Date(`${end}T12:00:00`);
  const startDay = startDate.getDate();
  const endLabel = endDate.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  if (startDate.getMonth() === endDate.getMonth()) {
    return `${startDay} – ${endLabel}`;
  }
  const startLabel = startDate.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
  return `${startLabel} – ${endLabel}`;
}

export function formatLongDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** 1 = lundi … 7 = dimanche */
export function isoWeekday(iso = todayISO()): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  const day = new Date(`${iso}T12:00:00`).getDay();
  return (day === 0 ? 7 : day) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

/** Heure 0–23 à Paris (conseils matin / midi / soir). */
export function parisHour(date = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: TZ,
      hour: "numeric",
      hourCycle: "h23",
    }).format(date),
  );
  return Number.isFinite(hour) ? hour : date.getHours();
}

export function dayPeriod(hour = parisHour()): "matin" | "midi" | "soir" {
  if (hour < 11) return "matin";
  if (hour < 16) return "midi";
  return "soir";
}
