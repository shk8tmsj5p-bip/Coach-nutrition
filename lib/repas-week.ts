import { isIsoDate, mondayOf, todayISO } from "@/lib/dates";
import { storage } from "@/lib/storage";

const KEY = "repas-week-start";

export function loadRepasWeekStart() {
  const raw = storage.get(KEY);
  if (isIsoDate(raw)) return mondayOf(raw);
  return mondayOf(todayISO());
}

export function persistRepasWeekStart(weekStart: string) {
  storage.set(KEY, mondayOf(weekStart));
}