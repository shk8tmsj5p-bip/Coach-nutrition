"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import type { Pesee, ProfileId } from "@/lib/types";
import type { RenphoOcrResult } from "@/lib/gemini/renpho";
import { todayISO } from "@/lib/dates";
import { cn } from "@/lib/utils";

export type RenphoDraft = {
  profileId: ProfileId;
  date: string;
  poids: string;
  masseGrasse: string;
  masseMusculaire: string;
  tourTaille: string;
};

function asField(value: number | null | undefined) {
  if (value == null) return "";
  return String(value).replace(".", ",");
}

function parseOptional(raw: string): number | null {
  const trimmed = raw.trim().replace(",", ".");
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function existingOn(rows: Pesee[], profileId: ProfileId, date: string) {
  return rows.find((row) => row.profileId === profileId && row.date === date);
}

export function draftFromOcr(
  extracted: RenphoOcrResult,
  fallbackProfile: ProfileId,
  rows: Pesee[],
  lockProfile: boolean,
): RenphoDraft {
  const profileId = lockProfile ? fallbackProfile : (extracted.profileGuess ?? fallbackProfile);
  const date = extracted.date ?? todayISO();
  const existing = existingOn(rows, profileId, date);
  return {
    profileId,
    date,
    poids: asField(extracted.poids ?? existing?.poids),
    masseGrasse: asField(extracted.masseGrasse ?? existing?.masseGrasse),
    masseMusculaire: asField(extracted.masseMusculaire ?? existing?.masseMusculaire),
    tourTaille: asField(extracted.tourTaille ?? existing?.tourTaille),
  };
}

export function rematchDraft(
  extracted: RenphoOcrResult,
  profileId: ProfileId,
  date: string,
  rows: Pesee[],
): RenphoDraft {
  const existing = existingOn(rows, profileId, date);
  return {
    profileId,
    date,
    poids: asField(extracted.poids ?? existing?.poids),
    masseGrasse: asField(extracted.masseGrasse ?? existing?.masseGrasse),
    masseMusculaire: asField(extracted.masseMusculaire ?? existing?.masseMusculaire),
    tourTaille: asField(extracted.tourTaille ?? existing?.tourTaille),
  };
}

export function RenphoReviewSheet({
  draft,
  extracted,
  rows,
  lockProfile,
  mock,
  warning,
  saving,
  onChange,
  onClose,
  onConfirm,
}: {
  draft: RenphoDraft;
  extracted: RenphoOcrResult;
  rows: Pesee[];
  lockProfile: boolean;
  mock?: boolean;
  warning?: string;
  saving: boolean;
  onChange: (next: RenphoDraft) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const profileLabel = draft.profileId === "alexis" ? "Alexis" : "Élodie";
  const filled = useMemo(
    () =>
      [draft.poids, draft.masseGrasse, draft.masseMusculaire, draft.tourTaille].filter(Boolean)
        .length,
    [draft],
  );

  function setProfile(profileId: ProfileId) {
    onChange(rematchDraft(extracted, profileId, draft.date, rows));
  }

  function setDate(date: string) {
    onChange(rematchDraft(extracted, draft.profileId, date, rows));
  }

  function confirm() {
    if (parseOptional(draft.poids) == null) {
      setError("Le poids est obligatoire.");
      return;
    }
    setError(null);
    onConfirm();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
      <div className="max-h-[90vh] w-full max-w-[430px] overflow-y-auto rounded-t-[24px] bg-white p-4 pb-8 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[17px] font-semibold">Vérifier la pesée</h3>
          <button type="button" onClick={onClose} className="rounded-full bg-health-bg p-1.5">
            <X size={16} />
          </button>
        </div>
        <p className="mb-1 text-[14px] font-semibold">
          Fiche {profileLabel} · {draft.date}
        </p>
        <p className="mb-3 text-[13px] leading-relaxed text-health-muted">
          OCR prérempli ({filled} champ{filled > 1 ? "s" : ""}). Rien n&apos;est écrit dans{" "}
          <span className="font-medium text-health-ink">pesees</span> tant que tu n&apos;as pas
          confirmé.
        </p>
        {mock && (
          <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
            Mode démo (Gemini indisponible)
            {warning ? ` · ${warning}` : ""}
          </p>
        )}

        <div className="mb-3 grid grid-cols-2 gap-1.5">
          {(["alexis", "elodie"] as const).map((id) => (
            <button
              key={id}
              type="button"
              disabled={lockProfile && id !== draft.profileId}
              onClick={() => setProfile(id)}
              className={cn(
                "rounded-full py-2 text-[13px] font-semibold disabled:opacity-40",
                draft.profileId === id ? "bg-health-ink text-white" : "bg-health-bg text-health-muted",
              )}
            >
              {id === "alexis" ? "Alexis" : "Élodie"}
            </button>
          ))}
        </div>

        <label className="mb-2 block text-[12px] font-medium text-health-muted">Date</label>
        <input
          type="date"
          value={draft.date}
          onChange={(e) => setDate(e.target.value)}
          className="mb-3 w-full rounded-card bg-health-bg px-3 py-2.5 text-[15px]"
        />

        <Field label="Poids (kg)" value={draft.poids} onChange={(poids) => onChange({ ...draft, poids })} />
        <Field
          label="Masse grasse (%)"
          value={draft.masseGrasse}
          onChange={(masseGrasse) => onChange({ ...draft, masseGrasse })}
        />
        <Field
          label="Masse musculaire (kg)"
          value={draft.masseMusculaire}
          onChange={(masseMusculaire) => onChange({ ...draft, masseMusculaire })}
        />
        <Field
          label="Tour de taille (cm)"
          value={draft.tourTaille}
          onChange={(tourTaille) => onChange({ ...draft, tourTaille })}
        />

        {error && <p className="mt-2 text-[13px] text-coral">{error}</p>}

        <button
          type="button"
          disabled={saving}
          onClick={confirm}
          className="mt-4 w-full rounded-card bg-health-ink py-3 text-[15px] font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Enregistrement…" : "Confirmer et enregistrer"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="mb-2 block">
      <span className="text-[12px] font-medium text-health-muted">{label}</span>
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-card bg-health-bg px-3 py-2.5 text-[15px] tabular-nums"
      />
    </label>
  );
}

export function parsedDraft(draft: RenphoDraft) {
  return {
    profileId: draft.profileId,
    date: draft.date,
    poids: parseOptional(draft.poids),
    masseGrasse: parseOptional(draft.masseGrasse),
    masseMusculaire: parseOptional(draft.masseMusculaire),
    tourTaille: parseOptional(draft.tourTaille),
  };
}
