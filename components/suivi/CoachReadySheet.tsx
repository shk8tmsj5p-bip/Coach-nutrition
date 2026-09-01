"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { CatSticker } from "@/components/ui/CatSticker";
import { polaroidLines } from "@/lib/week-polaroid";
import type { CoachWeekPayload } from "@/lib/coach-payload";

export function CoachReadySheet({
  payload,
  saveError,
  onClose,
}: {
  payload: CoachWeekPayload;
  saveError: string | null;
  onClose: () => void;
}) {
  const lines = polaroidLines(payload.journal.notes);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
      <div className="max-h-[88vh] w-full max-w-[430px] overflow-y-auto rounded-t-[24px] bg-white p-4 pb-8 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[17px] font-semibold">Journal enregistré</h3>
          <button type="button" onClick={onClose} className="rounded-full bg-health-bg p-1.5">
            <X size={16} />
          </button>
        </div>

        <div className="mx-auto w-[88%] rotate-[-2deg] rounded-sm bg-white px-3 pb-4 pt-3 shadow-card ring-1 ring-health-line">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-health-muted">
              Semaine · {payload.profileName}
            </p>
            <CatSticker mood="ok" className="h-7 w-7 text-health-ink" />
          </div>
          <div className="mt-3 aspect-[4/3] rounded-sm bg-health-bg px-3 py-4">
            <p className="text-[16px] font-semibold leading-snug">{lines.line1}</p>
            <p className="mt-2 text-[14px] leading-relaxed text-health-muted">{lines.line2}</p>
            <p className="mt-3 text-[13px] font-medium">{lines.line3}</p>
          </div>
        </div>

        {saveError ? (
          <p className="mt-3 text-[12px] text-coral">Copie locale — {saveError}</p>
        ) : (
          <p className="mt-3 text-center text-[12px] text-health-muted">
            Notes du dimanche sauvegardées.
          </p>
        )}

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
