"use client";

import { useMemo, useState } from "react";
import { Minus, Plus, Trash2, X } from "lucide-react";
import { TagInput } from "@/components/parametres/TagInput";
import { ChipSelector } from "@/components/parametres/ChipSelector";
import {
  normalizeIngredientLines,
  parseIngredientQty,
  qtyLabel,
  qtyStep,
  setLineQuantity,
} from "@/lib/food-log";
import { WEEKDAYS, toggleWeekday } from "@/lib/sport-routine";
import { SLOT_TEMPLATE_KINDS } from "@/lib/meal-templates";
import type { Macros, SlotTemplate, SlotTemplateKind } from "@/lib/types";
import { cn } from "@/lib/utils";

export function MealTemplateSheet({
  template,
  accent,
  isNew,
  onClose,
  onSave,
  onDelete,
}: {
  template: SlotTemplate;
  accent: "coral" | "violet";
  isNew?: boolean;
  onClose: () => void;
  onSave: (next: SlotTemplate) => void;
  onDelete?: () => void;
}) {
  const [draft, setDraft] = useState<SlotTemplate>(() => {
    const next = normalizeIngredientLines(template.items);
    return { ...template, items: next.lines, macros: next.macros };
  });
  const canSave = useMemo(() => draft.name.trim().length > 0, [draft.name]);

  function applyItems(items: string[]) {
    const next = normalizeIngredientLines(items);
    setDraft((current) => ({ ...current, items: next.lines, macros: next.macros }));
  }

  function patchMacros(patch: Partial<Macros>) {
    setDraft((current) => ({ ...current, macros: { ...current.macros, ...patch } }));
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/30">
      <div className="max-h-[88vh] w-full max-w-[430px] overflow-y-auto rounded-t-[24px] bg-health-card p-4 pb-8 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[17px] font-semibold">
            {isNew ? "Nouveau modèle" : "Éditer le modèle"}
          </h3>
          <button type="button" onClick={onClose} className="rounded-full bg-health-bg p-1.5">
            <X size={16} />
          </button>
        </div>

        <p className="mb-1.5 text-[12px] font-medium text-health-muted">Créneau</p>
        <ChipSelector
          stacked
          value={draft.slot}
          options={SLOT_TEMPLATE_KINDS}
          onChange={(slot: SlotTemplateKind) =>
            setDraft((current) => ({
              ...current,
              slot,
              time: current.time,
            }))
          }
        />

        <label className="mt-3 block">
          <span className="text-[12px] font-medium text-health-muted">Nom</span>
          <input
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            placeholder="Ex. Skyr 150g + myrtilles"
            className="mt-1 w-full rounded-lg bg-health-bg px-2.5 py-2 text-[14px] outline-none"
          />
        </label>

        <p className="mb-1 mt-3 text-[12px] font-medium text-health-muted">Ingrédients</p>
        <div className="space-y-1.5">
          {draft.items.map((line, index) => (
            <IngredientQtyRow
              key={`${line}-${index}`}
              line={line}
              onQty={(qty) => {
                const next = [...draft.items];
                next[index] = setLineQuantity(line, qty);
                applyItems(next);
              }}
              onRemove={() => applyItems(draft.items.filter((_, i) => i !== index))}
            />
          ))}
        </div>
        <div className="mt-1.5">
          <TagInput
            tags={[]}
            onChange={(added) => applyItems([...draft.items, ...added])}
            placeholder="1 tranche de pain bûcheron tartiné de…"
            accent={accent}
            addLabel="+"
            commitOnComma={false}
          />
        </div>
        <p className="mt-1 text-[11px] leading-snug text-health-muted">
          Phrase ou un ingrédient. Puis − / + pour la quantité.
        </p>

        <p className="mb-1.5 mt-3 text-[12px] font-medium text-health-muted">Macros</p>
        <div className="grid grid-cols-4 gap-1.5">
          <MacroField
            label="kcal"
            value={draft.macros.calories}
            onChange={(calories) => patchMacros({ calories })}
          />
          <MacroField
            label="P"
            value={draft.macros.protein}
            onChange={(protein) => patchMacros({ protein })}
          />
          <MacroField
            label="G"
            value={draft.macros.carbs}
            onChange={(carbs) => patchMacros({ carbs })}
          />
          <MacroField
            label="L"
            value={draft.macros.fat}
            onChange={(fat) => patchMacros({ fat })}
          />
        </div>

        <p className="mb-1.5 mt-3 text-[12px] font-medium text-health-muted">Jours</p>
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((day) => {
            const active = draft.weekdays.includes(day.id);
            return (
              <button
                key={day.id}
                type="button"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    weekdays: toggleWeekday(current.weekdays, day.id),
                  }))
                }
                className={cn(
                  "rounded-full py-2 text-[11px] font-semibold",
                  active ? "bg-health-ink text-health-on-fill" : "bg-health-bg text-health-muted",
                )}
              >
                {day.label}
              </button>
            );
          })}
        </div>
        {draft.weekdays.length === 0 ? (
          <p className="mt-1.5 text-[11px] text-health-muted">
            Sans jour, le modèle n’apparaît pas dans Aujourd’hui.
          </p>
        ) : null}

        <button
          type="button"
          disabled={!canSave}
          onClick={() => {
            const next = normalizeIngredientLines(draft.items);
            onSave({ ...draft, name: draft.name.trim(), items: next.lines, macros: next.macros });
          }}
          className="mt-4 w-full rounded-card bg-health-ink py-3 text-[14px] font-semibold text-health-on-fill disabled:opacity-40"
        >
          Enregistrer
        </button>
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="mt-2 w-full rounded-card bg-health-bg py-2.5 text-[13px] font-semibold text-red-500"
          >
            Supprimer
          </button>
        ) : null}
      </div>
    </div>
  );
}

function IngredientQtyRow({
  line,
  onQty,
  onRemove,
}: {
  line: string;
  onQty: (qty: number) => void;
  onRemove: () => void;
}) {
  const parsed = parseIngredientQty(line);
  const step = qtyStep(parsed.unit);

  return (
    <div className="flex items-center gap-1.5 rounded-xl bg-health-bg px-2 py-1.5">
      <p className="min-w-0 flex-1 truncate text-[13px] font-medium">{parsed.name}</p>
      <button
        type="button"
        aria-label="Moins"
        onClick={() => onQty(parsed.qty - step)}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-health-card text-health-ink"
      >
        <Minus size={12} />
      </button>
      <input
        inputMode="numeric"
        aria-label={`Quantité ${parsed.name}`}
        value={parsed.qty}
        onChange={(event) => {
          const next = Number(event.target.value.replace(/[^\d]/g, ""));
          if (Number.isFinite(next) && next > 0) onQty(next);
        }}
        className="w-[4.6rem] shrink-0 rounded-lg bg-health-card px-1 py-1 text-center text-[11px] font-semibold tabular-nums outline-none"
      />
      <span className="sr-only">{qtyLabel(parsed.qty, parsed.unit)}</span>
      <span className="w-10 shrink-0 text-[10px] font-semibold text-health-muted">
        {parsed.unit === "tranche" ? "tr." : parsed.unit}
      </span>
      <button
        type="button"
        aria-label="Plus"
        onClick={() => onQty(parsed.qty + step)}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-health-card text-health-ink"
      >
        <Plus size={12} />
      </button>
      <button
        type="button"
        aria-label={`Retirer ${parsed.name}`}
        onClick={onRemove}
        className="shrink-0 p-1 text-health-muted"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function MacroField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-health-muted">
        {label}
      </span>
      <input
        inputMode="numeric"
        value={value || ""}
        onChange={(event) => {
          const next = Number(event.target.value.replace(/[^\d]/g, ""));
          onChange(Number.isFinite(next) ? next : 0);
        }}
        className="mt-0.5 w-full rounded-lg bg-health-bg px-2 py-1.5 text-center text-[13px] tabular-nums outline-none"
      />
    </label>
  );
}
