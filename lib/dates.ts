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

export function startOfMonth(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function addMonthsISO(iso: string, months: number) {
  const d = new Date(`${startOfMonth(iso)}T12:00:00`);
  d.setMonth(d.getMonth() + months);
  return startOfMonth(todayISO(d));
}

export function lastDayOfMonth(iso: string) {
  const d = new Date(`${startOfMonth(iso)}T12:00:00`);
  d.setMonth(d.getMonth() + 1, 0);
  return todayISO(d);
}

export function formatMonthYear(iso: string) {
  const raw = new Date(`${startOfMonth(iso)}T12:00:00`).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/** Semaines (lundi → dimanche) qui touchent le mois. */
export function monthGridWeeks(monthIso: string) {
  const start = startOfMonth(monthIso);
  const end = lastDayOfMonth(monthIso);
  const weeks: string[][] = [];
  let cursor = mondayOf(start);
  while (weeks.length < 6) {
    weeks.push(Array.from({ length: 7 }, (_, index) => addDaysISO(cursor, index)));
    cursor = addDaysISO(cursor, 7);
    if (cursor > end) break;
  }
  return weeks;
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

export function formatShortDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function isIsoDate(value: string | undefined | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
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
