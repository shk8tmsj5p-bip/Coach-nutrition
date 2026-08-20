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
import { parseFoodTextLocal } from "@/lib/food-log";
import type { MealEntry, MealType } from "@/lib/types";
import { cn } from "@/lib/utils";

export type QuickLogMode = "text" | "barcode" | "photo";

function hasDessertSlot(type: MealType) {
  return type === "dejeuner" || type === "diner";
}

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
  const [dessertDraft, setDessertDraft] = useState("");
  const startedWithDessert = useMemo(
    () => parseMealItems(meal).some((item) => item.dessert),
    [meal],
  );
  const totals = useMemo(() => sumEditableMacros(items), [items]);
  const showDessert = hasDessertSlot(type);
  const platItems = showDessert ? items.filter((item) => !item.dessert) : items;
  const dessertItems = showDessert ? items.filter((item) => item.dessert) : [];

  function patch(id: string, next: EditableItem) {
    setItems((list) => list.map((row) => (row.id === id ? next : row)));
  }

  function remove(id: string) {
    setItems((list) => list.filter((row) => row.id !== id));
  }

  function addDessert() {
    const raw = dessertDraft.trim();
    if (!raw) return;
    const parsed = parseFoodTextLocal(raw);
    const extra = parsed.map((item, index) => ({
      ...item,
      id: `dessert-${Date.now()}-${index}`,
      carbs: item.carbs ?? 0,
      fat: item.fat ?? 0,
      dessert: true as const,
    }));
    if (!extra.length) return;
    setItems((list) => [...list, ...extra]);
    setDessertDraft("");
  }

  function commit() {
    onSave({
      ...meal,
      type,
      items: serializeItems(
        showDessert ? items : items.map((item) => ({ ...item, dessert: false })),
        {
          markEmptyDessert: showDessert && startedWithDessert,
        },
      ),
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

        <div className="max-h-[36vh] space-y-3 overflow-y-auto">
          {showDessert ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-health-muted">Plat</p>
          ) : null}
          {platItems.map((item) => (
            <ItemRow key={item.id} item={item} onChange={(next) => patch(item.id, next)} onRemove={() => remove(item.id)} />
          ))}
          {platItems.length === 0 && (
            <p className="py-2 text-center text-[13px] text-health-muted">
              {showDessert ? "Pas encore de plat — tu peux en ajouter ci-dessous." : "Tous les ingrédients ont été retirés."}
            </p>
          )}

          {showDessert ? (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-800 dark:text-amber-200">
                Dessert · Réglages
              </p>
              {dessertItems.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  dessert
                  onChange={(next) => patch(item.id, { ...next, dessert: true })}
                  onRemove={() => remove(item.id)}
                />
              ))}
              {dessertItems.length === 0 ? (
                <p className="mb-2 text-[12px] text-health-muted">Aucun dessert pour ce repas.</p>
              ) : null}
              <div className="mt-1.5 flex gap-1.5">
                <input
                  value={dessertDraft}
                  onChange={(e) => setDessertDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addDessert();
                    }
                  }}
                  placeholder="Ex. Skyr 150g"
                  className="min-w-0 flex-1 rounded-card bg-amber-50 px-3 py-2 text-[13px] outline-none dark:bg-amber-950/40"
                />
                <button
                  type="button"
                  onClick={addDessert}
                  disabled={!dessertDraft.trim()}
                  className="rounded-card bg-health-ink px-3 text-[12px] font-semibold text-white disabled:opacity-40"
                >
                  Ajouter
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-3">
          <p className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-health-muted">
            <Plus size={14} />
            Ajouter au plat
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

function ItemRow({
  item,
  dessert,
  onChange,
  onRemove,
}: {
  item: EditableItem;
  dessert?: boolean;
  onChange: (next: EditableItem) => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={cn(
        "mb-1.5 flex items-center gap-2 rounded-card p-3",
        dessert ? "bg-amber-50 dark:bg-amber-950/40" : "bg-health-bg",
      )}
    >
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
          onClick={() => onChange(scaleItem(item, item.grams - 10))}
        >
          −
        </button>
        <input
          value={item.grams}
          onChange={(e) => onChange(scaleItem(item, Number(e.target.value) || 1))}
          className="w-12 rounded-md bg-white text-center text-[13px] tabular-nums"
        />
        <span className="text-[11px] text-health-muted">g</span>
        <button
          type="button"
          className="h-8 w-8 rounded-full bg-white text-lg leading-none"
          onClick={() => onChange(scaleItem(item, item.grams + 10))}
        >
          +
        </button>
        <button type="button" className="ml-1 text-health-muted" onClick={onRemove}>
          <Trash2 size={16} />
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
