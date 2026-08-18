import type { Pesee, ProfileId, SundayJournalFields } from "@/lib/types";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { PeseeRow } from "@/lib/supabase/database.types";
import { mergePesee, overlayPesees, parseJournalNotes, seedPesees, sortPesees } from "@/lib/pesees";
import { storage } from "@/lib/storage";

function storageKey(profileId: ProfileId) {
  return `pesees:${profileId}`;
}

function fromRow(row: PeseeRow): Pesee {
  return {
    id: row.id,
    profileId: row.profile_id,
    date: row.date,
    poids: row.poids == null ? null : Number(row.poids),
    masseGrasse: row.masse_grasse == null ? null : Number(row.masse_grasse),
    masseMusculaire: row.masse_musculaire == null ? null : Number(row.masse_musculaire),
    tourTaille: row.tour_taille == null ? null : Number(row.tour_taille),
    bmi: row.bmi == null ? null : Number(row.bmi),
    journalNotes: row.journal_notes,
  };
}

function toInsert(row: Pesee) {
  return {
    profile_id: row.profileId,
    date: row.date,
    poids: row.poids,
    masse_grasse: row.masseGrasse,
    masse_musculaire: row.masseMusculaire,
    tour_taille: row.tourTaille,
    bmi: row.bmi,
    journal_notes: row.journalNotes,
  };
}

export async function loadPesees(profileId: ProfileId): Promise<{
  rows: Pesee[];
  source: "supabase" | "local" | "seed";
}> {
  const local = storage.getJSON<Pesee[] | null>(storageKey(profileId), null);
  const supabase = createBrowserSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("pesees")
      .select("*")
      .eq("profile_id", profileId)
      .order("date", { ascending: true });
    if (!error && data) {
      const rows = data.map(fromRow);
      if (rows.length >= 14) {
        return { rows: sortPesees(rows), source: "supabase" };
      }
      if (rows.length > 0) {
        return { rows: overlayPesees(seedPesees(profileId), rows), source: "supabase" };
      }
    }
  }
  if (Array.isArray(local) && local.length > 0) {
    return { rows: sortPesees(local), source: "local" };
  }
  return { rows: seedPesees(profileId), source: "seed" };
}

export async function savePesee(patch: Pesee): Promise<{ row: Pesee; error: string | null }> {
  const local = storage.getJSON<Pesee[]>(storageKey(patch.profileId), []);
  const existing = local.find((row) => row.date === patch.date);
  const merged = mergePesee(existing, patch, patch.id || crypto.randomUUID());
  const nextLocal = sortPesees([...local.filter((row) => row.date !== patch.date), merged]);
  storage.setJSON(storageKey(patch.profileId), nextLocal);

  const supabase = createBrowserSupabaseClient();
  if (!supabase) return { row: merged, error: null };

  const { data, error } = await supabase
    .from("pesees")
    .upsert(toInsert(merged), { onConflict: "profile_id,date" })
    .select("*")
    .maybeSingle();

  if (error) return { row: merged, error: error.message };

  const saved = data ? fromRow(data) : merged;
  storage.setJSON(
    storageKey(patch.profileId),
    sortPesees([...nextLocal.filter((row) => row.date !== saved.date), saved]),
  );

  if (saved.poids != null) {
    await supabase.from("profils").update({ current_weight_kg: saved.poids }).eq("id", saved.profileId);
  }

  return { row: saved, error: null };
}

export async function loadJournalHistory(
  profileId: ProfileId,
  fallbackRows: Pesee[] = [],
): Promise<Array<{ date: string; notes: SundayJournalFields }>> {
  const localRows = [
    ...fallbackRows,
    ...(storage.getJSON<Pesee[]>(storageKey(profileId), []) ?? []),
  ];
  const byDate = new Map<string, { date: string; notes: SundayJournalFields }>();
  for (const row of localRows) {
    if (!row.journalNotes) continue;
    byDate.set(row.date, { date: row.date, notes: parseJournalNotes(row.journalNotes) });
  }

  const supabase = createBrowserSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("pesees")
      .select("date, journal_notes")
      .eq("profile_id", profileId)
      .not("journal_notes", "is", null)
      .order("date", { ascending: false });
    if (!error && data) {
      for (const row of data) {
        if (!row.journal_notes) continue;
        byDate.set(row.date, { date: row.date, notes: parseJournalNotes(row.journal_notes) });
      }
    }
  }

  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
}
