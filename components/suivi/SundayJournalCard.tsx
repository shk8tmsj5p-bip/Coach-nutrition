"use client";

import { Card, SectionTitle } from "@/components/ui/Card";
import { FeelStickerRow } from "@/components/ui/FeelStickerRow";
import { FEEL_AXIS_HINTS, FEEL_AXIS_LABELS } from "@/lib/cat-feel";
import type { SundayJournalFields } from "@/lib/types";

export function SundayJournalCard({
  weekLabel,
  profileName,
  fields,
  saving,
  onChange,
  onSave,
  onOpenHistory,
}: {
  weekLabel: string;
  profileName: string;
  fields: SundayJournalFields;
  saving: boolean;
  onChange: (next: SundayJournalFields) => void;
  onSave: () => void;
  onOpenHistory: () => void;
}) {
  return (
    <>
      <SectionTitle
        action={
          <button type="button" onClick={onOpenHistory} className="text-[12px] font-semibold text-health-ink">
            Voir l&apos;historique des notes
          </button>
        }
      >
        Journal du dimanche
      </SectionTitle>
      <Card>
        <p className="text-[12px] text-health-muted">
          {profileName} · semaine du {weekLabel}
        </p>
        <label className="mt-3 block">
          <span className="text-[12px] font-medium text-health-muted">Humeur / ressenti</span>
          <textarea
            rows={2}
            value={fields.mood}
            onChange={(e) => onChange({ ...fields, mood: e.target.value })}
            className="mt-1 w-full resize-none rounded-2xl bg-health-bg px-3 py-2.5 text-[14px] leading-relaxed"
            placeholder="Comment s’est passée la semaine ?"
          />
        </label>
        <label className="mt-2 block">
          <span className="text-[12px] font-medium text-health-muted">Victoires</span>
          <textarea
            rows={2}
            value={fields.wins}
            onChange={(e) => onChange({ ...fields, wins: e.target.value })}
            className="mt-1 w-full resize-none rounded-2xl bg-health-bg px-3 py-2.5 text-[14px] leading-relaxed"
            placeholder="Ce qui a bien fonctionné"
          />
        </label>
        <label className="mt-2 block">
          <span className="text-[12px] font-medium text-health-muted">Freins</span>
          <textarea
            rows={2}
            value={fields.blockers}
            onChange={(e) => onChange({ ...fields, blockers: e.target.value })}
            className="mt-1 w-full resize-none rounded-2xl bg-health-bg px-3 py-2.5 text-[14px] leading-relaxed"
            placeholder="Points à lisser la semaine prochaine"
          />
        </label>
        <div className="mt-3 space-y-3 rounded-2xl bg-health-bg px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-health-muted">
            Comme Aujourd’hui
          </p>
          <FeelStickerRow
            axis="hunger"
            label={FEEL_AXIS_LABELS.hunger}
            hint={FEEL_AXIS_HINTS.hunger}
            value={fields.hunger}
            onChange={(hunger) => onChange({ ...fields, hunger })}
            surface="wash"
          />
          <FeelStickerRow
            axis="energy"
            label={FEEL_AXIS_LABELS.energy}
            hint={FEEL_AXIS_HINTS.energy}
            value={fields.energy}
            onChange={(energy) => onChange({ ...fields, energy })}
            surface="wash"
          />
          <FeelStickerRow
            axis="fatigue"
            label={FEEL_AXIS_LABELS.fatigue}
            hint={FEEL_AXIS_HINTS.fatigue}
            value={fields.fatigue}
            onChange={(fatigue) => onChange({ ...fields, fatigue })}
            surface="wash"
          />
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={onSave}
          className="mt-3 w-full rounded-card bg-health-bg py-2.5 text-[14px] font-semibold disabled:opacity-50"
        >
          {saving ? "Enregistrement…" : "Enregistrer le journal"}
        </button>
      </Card>
    </>
  );
}
