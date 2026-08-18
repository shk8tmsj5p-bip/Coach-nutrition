"use client";

import { Card, SectionTitle } from "@/components/ui/Card";
import type { SundayJournalFields } from "@/lib/types";
import { cn } from "@/lib/utils";

function ScoreRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[13px] font-medium">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={score}
            type="button"
            onClick={() => onChange(score)}
            className={cn(
              "h-8 w-8 rounded-full text-[12px] font-semibold",
              value === score ? "bg-health-ink text-white" : "bg-white text-health-muted",
            )}
          >
            {score}
          </button>
        ))}
      </div>
    </div>
  );
}

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
        <div className="mt-3 space-y-2 rounded-2xl bg-health-bg px-3 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-health-muted">
            Pour le coach (Gemini Flash)
          </p>
          <ScoreRow
            label="Faim"
            value={fields.hunger}
            onChange={(hunger) => onChange({ ...fields, hunger })}
          />
          <ScoreRow
            label="Énergie"
            value={fields.energy}
            onChange={(energy) => onChange({ ...fields, energy })}
          />
          <ScoreRow
            label="Fatigue"
            value={fields.fatigue}
            onChange={(fatigue) => onChange({ ...fields, fatigue })}
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
