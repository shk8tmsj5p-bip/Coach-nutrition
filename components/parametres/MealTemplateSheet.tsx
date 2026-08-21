"use client";

import { useMemo, useState } from "react";
import { Minus, Plus, Trash2, X } from "lucide-react";
import { TagInput } from "@/components/parametres/TagInput";
import { ChipSelector } from "@/components/parametres/ChipSelector";
import {
  formatDetectedLine,
  parseIngredientQty,
  parseLogLine,
  qtyStep,
  setLineQuantity,
} from "@/lib/food-log";
import { requestLogText } from "@/lib/gemini/client";
import { WEEKDAYS, toggleWeekday } from "@/lib/sport-routine";
import { SLOT_TEMPLATE_KINDS } from "@/lib/meal-templates";
import type { DetectedIngredient, DietType, Macros, SlotTemplate, SlotTemplateKind } from "@/lib/types";
import { cn } from "@/lib/utils";

type DraftLine = {
  line: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

function sumLines(items: DraftLine[]): Macros {
  return items.reduce(
    (acc, item) => ({
      calories: acc.calories + item.calories,
      protein: acc.protein + item.protein,
      carbs: acc.carbs + item.carbs,
      fat: acc.fat + item.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

function linesFromTemplate(template: SlotTemplate): DraftLine[] {
  const items = template.items.filter((line) => line.trim());
  if (!items.length) return [];
  const parsed = items.map((line) => parseLogLine(line));
  const totalG = parsed.reduce((sum, item) => sum + item.grams, 0);
  return parsed.map((item, index) => {
    const share = totalG > 0 ? item.grams / totalG : 1 / parsed.length;
    return {
      line: items[index],
      calories: Math.round(template.macros.calories * share),
      protein: Math.round(template.macros.protein * share),
      carbs: Math.round(template.macros.carbs * share),
      fat: Math.round(template.macros.fat * share),
    };
  });
}

function fromDetected(item: DetectedIngredient): DraftLine {
  return {
    line: formatDetectedLine(item),
    calories: item.calories,
    protein: item.protein,
    carbs: item.carbs ?? 0,
    fat: item.fat ?? 0,
  };
}

function scaleLine(item: DraftLine, qty: number): DraftLine {
  const parsed = parseLogLine(item.line);
  const nextLine = setLineQuantity(item.line, qty);
  const next = parseLogLine(nextLine);
  const ratio = parsed.grams > 0 ? next.grams / parsed.grams : 1;
  return {
    line: nextLine,
    calories: Math.max(0, Math.round(item.calories * ratio)),
    protein: Math.max(0, Math.round(item.protein * ratio)),
    carbs: Math.max(0, Math.round(item.carbs * ratio)),
    fat: Math.max(0, Math.round(item.fat * ratio)),
  };
}

export function MealTemplateSheet({
  template,
  accent,
  diet,
  isNew,
  onClose,
  onSave,
  onDelete,
}: {
  template: SlotTemplate;
  accent: "coral" | "violet";
  diet: DietType;
  isNew?: boolean;
  onClose: () => void;
  onSave: (next: SlotTemplate) => void;
  onDelete?: () => void;
}) {
  const [draft, setDraft] = useState<SlotTemplate>(template);
  const [lines, setLines] = useState<DraftLine[]>(() => linesFromTemplate(template));
  const [adding, setAdding] = useState(false);
  const canSave = useMemo(() => draft.name.trim().length > 0, [draft.name]);

  function commitLines(next: DraftLine[]) {
    setLines(next);
    setDraft((current) => ({
      ...current,
      items: next.map((item) => item.line),
      macros: sumLines(next),
    }));
  }

  async function addTexts(raws: string[]) {
    const extra = raws.map((raw) => raw.trim()).filter(Boolean);
    if (!extra.length || adding) return;
    setAdding(true);
    try {
      const detected: DetectedIngredient[] = [];
      for (const raw of extra) {
        detected.push(...(await requestLogText(raw, diet)));
      }
      if (!detected.length) return;
      commitLines([...lines, ...detected.map(fromDetected)]);
    } finally {
      setAdding(false);
    }
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
          {lines.map((item, index) => (
            <IngredientQtyRow
              key={`${item.line}-${index}`}
              line={item.line}
              onQty={(qty) => {
                const next = [...lines];
                next[index] = scaleLine(item, qty);
                commitLines(next);
              }}
              onRemove={() => commitLines(lines.filter((_, i) => i !== index))}
            />
          ))}
        </div>
        <div className={cn("mt-1.5", adding && "pointer-events-none opacity-50")}>
          <TagInput
            tags={[]}
            onChange={(added) => void addTexts(added)}
            placeholder="Café au lait végétal d'avoine"
            accent={accent}
            addLabel="+"
            commitOnComma={false}
          />
        </div>
        <p className="mt-1 text-[11px] leading-snug text-health-muted">
          {adding
            ? "Gemini estime les kcal d’après ta phrase…"
            : "L’IA estime les kcal à l’ajout. − / + change la quantité, le poids et les kcal suivent."}
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
          disabled={!canSave || adding}
          onClick={() => {
            onSave({
              ...draft,
              name: draft.name.trim(),
              items: lines.map((item) => item.line),
              macros: draft.macros,
            });
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
        className="w-[3.4rem] shrink-0 rounded-lg bg-health-card px-1 py-1 text-center text-[11px] font-semibold tabular-nums outline-none"
      />
      <span className="w-10 shrink-0 text-[10px] font-semibold text-health-muted">
        {parsed.unit === "tranche" ? "tr." : parsed.unit === "carreau" ? "car." : parsed.unit === "piece" ? "pce" : parsed.unit}
      </span>
      <span className="w-10 shrink-0 text-[10px] tabular-nums text-health-muted">
        {parsed.unit === "g" || parsed.unit === "ml" ? "" : `${parsed.grams}g`}
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
