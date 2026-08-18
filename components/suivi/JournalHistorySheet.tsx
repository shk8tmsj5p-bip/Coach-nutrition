"use client";

import { X } from "lucide-react";
import { formatWeekRange, mondayOf } from "@/lib/dates";
import type { SundayJournalFields } from "@/lib/types";

export function JournalHistorySheet({
  profileName,
  entries,
  loading,
  onClose,
}: {
  profileName: string;
  entries: Array<{ date: string; notes: SundayJournalFields }>;
  loading?: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
      <div className="max-h-[88vh] w-full max-w-[430px] overflow-y-auto rounded-t-[24px] bg-white p-4 pb-8 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[17px] font-semibold">Historique des notes</h3>
          <button type="button" onClick={onClose} className="rounded-full bg-health-bg p-1.5">
            <X size={16} />
          </button>
        </div>
        <p className="mb-3 text-[13px] text-health-muted">{profileName} · plus récentes d’abord</p>
        {loading ? (
          <p className="text-[13px] text-health-muted">Chargement de l’historique…</p>
        ) : entries.length === 0 ? (
          <p className="text-[13px] text-health-muted">Pas encore de journal enregistré.</p>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <div key={entry.date} className="rounded-2xl bg-health-bg px-3 py-3">
                <p className="text-[12px] font-semibold text-health-muted">
                  Semaine du {formatWeekRange(mondayOf(entry.date))}
                </p>
                {entry.notes.mood && (
                  <p className="mt-1.5 text-[14px] leading-relaxed">{entry.notes.mood}</p>
                )}
                {entry.notes.wins && (
                  <p className="mt-1 text-[13px] text-health-muted">+ {entry.notes.wins}</p>
                )}
                {entry.notes.blockers && (
                  <p className="mt-1 text-[13px] text-health-muted">△ {entry.notes.blockers}</p>
                )}
                <p className="mt-2 text-[11px] font-medium text-health-muted">
                  Faim {entry.notes.hunger}/5 · Énergie {entry.notes.energy}/5 · Fatigue{" "}
                  {entry.notes.fatigue}/5
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
