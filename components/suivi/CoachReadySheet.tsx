"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { coachWeightTrend, type CoachWeekPayload } from "@/lib/coach-payload";
import { formatSportRoutine } from "@/lib/sport-routine";
import { formatKg } from "@/lib/utils";

export function CoachReadySheet({
  payload,
  saveError,
  onClose,
}: {
  payload: CoachWeekPayload;
  saveError: string | null;
  onClose: () => void;
}) {
  const trend = coachWeightTrend(payload);
  const last = trend[trend.length - 1];
  const notes = payload.journal.notes;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
      <div className="max-h-[88vh] w-full max-w-[430px] overflow-y-auto rounded-t-[24px] bg-white p-4 pb-8 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[17px] font-semibold">Journal enregistré</h3>
          <button type="button" onClick={onClose} className="rounded-full bg-health-bg p-1.5">
            <X size={16} />
          </button>
        </div>
        <p className="text-[14px] leading-relaxed text-health-muted">
          Notes du dimanche sauvegardées dans <span className="font-medium text-health-ink">pesees.journal_notes</span>
          {saveError ? " (copie locale — Supabase a renvoyé une erreur)." : " · profil " + payload.profileName}.
        </p>
        {saveError && <p className="mt-2 text-[12px] text-coral">{saveError}</p>}

        <div className="mt-3 rounded-2xl bg-health-bg px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-health-muted">
            Payload coach · Tab 4
          </p>
          <p className="mt-1 text-[13px] leading-relaxed">
            Contexte 7 j prêt pour Gemini Flash. Ouvre Métabolisme & Coaching pour lancer l’analyse.
          </p>
          <ul className="mt-2 space-y-1 text-[13px] text-health-muted">
            <li>
              Tendance 7 j · {trend.length} pts
              {last ? ` · ${formatKg(last.value)}` : ""}
              {payload.latestMa7 != null ? ` · moy. 7 j ${formatKg(payload.latestMa7)}` : ""}
              {payload.plateau ? " · plateau" : ""}
            </li>
            <li>
              Journal · faim {notes.hunger}/5 · énergie {notes.energy}/5 · fatigue {notes.fatigue}/5
            </li>
            <li>Routine · {formatSportRoutine(payload.sportRoutine)}</li>
          </ul>
        </div>

        <Link
          href="/metabolique"
          onClick={onClose}
          className="mt-4 flex w-full items-center justify-center rounded-card bg-health-ink py-3 text-[15px] font-semibold text-white"
        >
          Analyser dans Métabolisme
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 w-full rounded-card bg-health-bg py-3 text-[14px] font-semibold"
        >
          Plus tard
        </button>
      </div>
    </div>
  );
}
