"use client";

import { useMemo, useState } from "react";
import { Camera, Plus, ScanBarcode, Sparkles, Trash2, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import {
  MEAL_TYPE_OPTIONS,
  parseMealItems,
  scaleItem,
  serializeItems,
  sumEditableMacros,
  type EditableItem,
} from "@/lib/meal-items";
import type { MealEntry, MealType } from "@/lib/types";
import { cn } from "@/lib/utils";

export type QuickLogMode = "text" | "barcode" | "photo";

export function EditMealSheet({
  meal,
  saving,
  onClose,
  onSave,
  onAdd,
}: {
  meal: MealEntry;
  saving: boolean;
  onClose: () => void;
  onSave: (next: MealEntry) => void;
  onAdd: (mode: QuickLogMode) => void;
}) {
  const [type, setType] = useState<MealType>(meal.type);
  const [items, setItems] = useState<EditableItem[]>(() => parseMealItems(meal));
  const totals = useMemo(() => sumEditableMacros(items), [items]);

  function commit() {
    onSave({
      ...meal,
      type,
      items: serializeItems(items),
      macros: {
        calories: Math.round(totals.calories),
        protein: Math.round(totals.protein),
        carbs: Math.round(totals.carbs),
        fat: Math.round(totals.fat),
      },
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
      <div className="w-full max-w-[430px] rounded-t-[24px] bg-white p-4 pb-8 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[17px] font-semibold">Modifier le repas</h3>
          <button type="button" onClick={onClose} className="rounded-full bg-health-bg p-1.5">
            <X size={16} />
          </button>
        </div>
        <p className="mb-3 text-[13px] leading-snug text-health-muted">{meal.name}</p>

        <p className="mb-2 text-[12px] font-medium text-health-muted">Type de repas</p>
        <div className="mb-4 grid grid-cols-2 gap-1.5">
          {MEAL_TYPE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setType(option.id)}
              className={cn(
                "rounded-full py-2 text-[12px] font-semibold",
                type === option.id ? "bg-health-ink text-white" : "bg-health-bg text-health-muted",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="max-h-[28vh] space-y-2 overflow-y-auto">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-2 rounded-card bg-health-bg p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium">{item.name}</p>
                <p className="text-[11px] text-health-muted">
                  {item.calories} kcal · {Math.round(item.protein)}g P
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="h-8 w-8 rounded-full bg-white text-lg leading-none"
                  onClick={() =>
                    setItems((list) =>
                      list.map((row) => (row.id === item.id ? scaleItem(row, item.grams - 10) : row)),
                    )
                  }
                >
                  −
                </button>
                <input
                  value={item.grams}
                  onChange={(e) => {
                    const grams = Number(e.target.value) || 1;
                    setItems((list) =>
                      list.map((row) => (row.id === item.id ? scaleItem(row, grams) : row)),
                    );
                  }}
                  className="w-12 rounded-md bg-white text-center text-[13px] tabular-nums"
                />
                <span className="text-[11px] text-health-muted">g</span>
                <button
                  type="button"
                  className="h-8 w-8 rounded-full bg-white text-lg leading-none"
                  onClick={() =>
                    setItems((list) =>
                      list.map((row) => (row.id === item.id ? scaleItem(row, item.grams + 10) : row)),
                    )
                  }
                >
                  +
                </button>
                <button
                  type="button"
                  className="ml-1 text-health-muted"
                  onClick={() => setItems((list) => list.filter((row) => row.id !== item.id))}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <p className="py-4 text-center text-[13px] text-health-muted">
              Tous les ingrédients ont été retirés.
            </p>
          )}
        </div>

        <div className="mt-3">
          <p className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-health-muted">
            <Plus size={14} />
            Ajouter
          </p>
          <div className="grid grid-cols-3 gap-2">
            <AddLogTile icon={Sparkles} label="Texte / IA" onClick={() => onAdd("text")} />
            <AddLogTile icon={ScanBarcode} label="Code-barres" onClick={() => onAdd("barcode")} />
            <AddLogTile icon={Camera} label="Photo" onClick={() => onAdd("photo")} />
          </div>
        </div>

        <Card className="mt-3 bg-health-bg shadow-none">
          <p className="text-[13px] font-semibold tabular-nums">
            {Math.round(totals.calories)} kcal · {Math.round(totals.protein)}g P ·{" "}
            {Math.round(totals.carbs)}g G · {Math.round(totals.fat)}g L
          </p>
        </Card>

        <button
          type="button"
          disabled={saving}
          onClick={commit}
          className="mt-3 w-full rounded-card bg-health-ink py-3 text-[15px] font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}

function AddLogTile({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Camera;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 rounded-card bg-health-bg py-2.5"
    >
      <Icon size={18} />
      <span className="text-[11px] font-semibold">{label}</span>
    </button>
  );
}
