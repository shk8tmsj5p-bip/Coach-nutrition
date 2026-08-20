import type { SupabaseClient } from "@supabase/supabase-js";
import { addDaysISO, todayISO } from "@/lib/dates";
import {
  clearLocalFeel,
  emptyFeel,
  hasFeelScore,
  loadLocalFeel,
  mergeFeel,
  mergeFeelPayload,
  parseFeelFromRow,
  saveLocalFeel,
  stripFeelFromPayload,
  type DailyFeelEntry,
  type DailyFeelScores,
} from "@/lib/daily-feel";
import type { Database } from "@/lib/supabase/database.types";
import type { ProfileId } from "@/lib/types";

export async function upsertDailyFeel(
  supabase: SupabaseClient<Database> | null,
  profileId: ProfileId,
  date: string,
  scores: DailyFeelScores,
) {
  const fromLocal = mergeFeel(loadLocalFeel(profileId, date) ?? emptyFeel(), scores);
  saveLocalFeel(profileId, date, fromLocal);
  if (!supabase) return null;

  const existing = await supabase
    .from("logs_sante")
    .select("id, hunger, energy, payload, fasting")
    .eq("profile_id", profileId)
    .eq("date", date)
    .eq("kind", "checkin")
    .limit(1)
    .maybeSingle();

  const fromDb = existing.data ? parseFeelFromRow(existing.data) : emptyFeel();
  const merged = mergeFeel(fromDb, fromLocal);
  saveLocalFeel(profileId, date, merged);
  const payload = mergeFeelPayload(existing.data?.payload ?? {}, merged);
  const patch = {
    hunger: merged.hunger,
    energy: merged.energy,
    payload,
    source: "manual" as const,
  };

  if (existing.data?.id) {
    const updated = await supabase.from("logs_sante").update(patch).eq("id", existing.data.id);
    return updated.error?.message ?? null;
  }

  const inserted = await supabase.from("logs_sante").insert({
    profile_id: profileId,
    date,
    kind: "checkin",
    ...patch,
  });
  return inserted.error?.message ?? null;
}

export async function clearDailyFeel(
  supabase: SupabaseClient<Database> | null,
  profileId: ProfileId,
  date: string,
) {
  clearLocalFeel(profileId, date);
  if (!supabase) return null;

  const existing = await supabase
    .from("logs_sante")
    .select("id, payload")
    .eq("profile_id", profileId)
    .eq("date", date)
    .eq("kind", "checkin")
    .limit(1)
    .maybeSingle();

  if (!existing.data?.id) return existing.error?.message ?? null;

  const updated = await supabase
    .from("logs_sante")
    .update({
      hunger: null,
      energy: null,
      payload: stripFeelFromPayload(existing.data.payload),
    })
    .eq("id", existing.data.id);

  return updated.error?.message ?? null;
}

export async function fetchDailyFeels(
  supabase: SupabaseClient<Database> | null,
  profileIds: ProfileId[],
  from: string,
  to: string,
): Promise<DailyFeelEntry[]> {
  const out: DailyFeelEntry[] = [];
  const seen = new Set<string>();

  if (supabase) {
    const { data } = await supabase
      .from("logs_sante")
      .select("profile_id, date, hunger, energy, payload")
      .eq("kind", "checkin")
      .in("profile_id", profileIds)
      .gte("date", from)
      .lte("date", to);

    for (const row of data ?? []) {
      const scores = parseFeelFromRow(row);
      const local = loadLocalFeel(row.profile_id, row.date);
      const merged = mergeFeel(scores, local);
      if (!hasFeelScore(merged)) continue;
      const key = `${row.profile_id}:${row.date}`;
      seen.add(key);
      out.push({ ...merged, date: row.date, profileId: row.profile_id });
    }
  }

  let cursor = from;
  while (cursor <= to) {
    for (const id of profileIds) {
      const key = `${id}:${cursor}`;
      if (seen.has(key)) continue;
      const local = loadLocalFeel(id, cursor);
      if (local && hasFeelScore(local)) {
        out.push({ ...local, date: cursor, profileId: id });
      }
    }
    if (cursor === to) break;
    cursor = addDaysISO(cursor, 1);
  }

  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchTodayFeels(
  supabase: SupabaseClient<Database> | null,
  profileIds: ProfileId[],
  date = todayISO(),
): Promise<Record<ProfileId, DailyFeelScores>> {
  const result: Record<ProfileId, DailyFeelScores> = {
    alexis: emptyFeel(),
    elodie: emptyFeel(),
  };
  const rows = await fetchDailyFeels(supabase, profileIds, date, date);
  for (const row of rows) {
    result[row.profileId] = {
      hunger: row.hunger,
      energy: row.energy,
      fatigue: row.fatigue,
      validated: row.validated,
    };
  }
  for (const id of profileIds) {
    const local = loadLocalFeel(id, date);
    if (local) result[id] = mergeFeel(result[id], local);
  }
  return result;
}

export function last7DaysRange(today = todayISO()) {
  return { from: addDaysISO(today, -6), to: today };
}
