"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight, Camera, Clock, Plus, ScanBarcode, Sparkles, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import {
  MEAL_TYPE_OPTIONS,
  parseMealItems,
  scaleItem,
  scaleItemQty,
  scaleItemKcal,
  serializeItems,
  sumEditableMacros,
  type EditableItem,
} from "@/lib/meal-items";
import { QtyEditRow } from "@/components/today/QtyEditRow";
import { requestLogText } from "@/lib/gemini/client";
import type { MealEntry, MealType } from "@/lib/types";
import { cn, mealTypeLabel } from "@/lib/utils";
import { isFilledMeal, occupantOfSlot, slotTime } from "@/lib/meal-slot";

export type QuickLogMode = "text" | "barcode" | "photo" | "recent";

function hasDessertSlot(type: MealType) {
  return type === "dejeuner" || type === "diner";
}

export function EditMealSheet({
  meal,
  dayMeals,
  saving,
  onClose,
  onSave,
  onAdd,
  onSwapWeek,
}: {
  meal: MealEntry;
  dayMeals?: MealEntry[];
  saving: boolean;
  onClose: () => void;
  onSave: (next: MealEntry) => void;
  onAdd?: (mode: QuickLogMode) => void;
  onSwapWeek?: () => void;
}) {
  const [type, setType] = useState<MealType>(meal.type);
  const [items, setItems] = useState<EditableItem[]>(() => parseMealItems(meal));
  const [dessertDraft, setDessertDraft] = useState("");
  const [platDraft, setPlatDraft] = useState("");
  const [addingDessert, setAddingDessert] = useState(false);
  const [addingPlat, setAddingPlat] = useState(false);
  const diet = meal.profileId === "elodie" ? "omnivore" : "vegan";
  const startedWithDessert = useMemo(
    () => parseMealItems(meal).some((item) => item.dessert),
    [meal],
  );
  const totals = useMemo(() => sumEditableMacros(items), [items]);
  const showDessert = hasDessertSlot(type);
  const platItems = showDessert ? items.filter((item) => !item.dessert) : items;
  const dessertItems = showDessert ? items.filter((item) => item.dessert) : [];
  const occupant = occupantOfSlot(dayMeals ?? [], meal.profileId, type, meal.id, meal.date);
  const moving = type !== meal.type;

  function patch(id: string, next: EditableItem) {
    setItems((list) => list.map((row) => (row.id === id ? next : row)));
  }

  function remove(id: string) {
    setItems((list) => list.filter((row) => row.id !== id));
  }

  async function addLines(raw: string, dessert: boolean) {
    const parsed = await requestLogText(raw, diet);
    return parsed.map((item, index) => ({
      ...item,
      id: `${dessert ? "dessert" : "plat"}-${Date.now()}-${index}`,
      carbs: item.carbs ?? 0,
      fat: item.fat ?? 0,
      qty: item.qty ?? item.grams,
      unit: item.unit ?? "g",
      dessert,
    }));
  }

  async function addDessert() {
    const raw = dessertDraft.trim();
    if (!raw || addingDessert) return;
    setAddingDessert(true);
    try {
      const extra = await addLines(raw, true);
      if (!extra.length) return;
      setItems((list) => [...list, ...extra]);
      setDessertDraft("");
    } finally {
      setAddingDessert(false);
    }
  }

  async function addPlatText() {
    const raw = platDraft.trim();
    if (!raw || addingPlat) return;
    setAddingPlat(true);
    try {
      const extra = await addLines(raw, false);
      if (!extra.length) return;
      setItems((list) => {
        const desserts = list.filter((item) => item.dessert);
        const plat = list.filter((item) => !item.dessert);
        return [...plat, ...extra, ...desserts];
      });
      setPlatDraft("");
    } finally {
      setAddingPlat(false);
    }
  }

  function commit() {
    onSave({
      ...meal,
      type,
      time: slotTime(type),
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
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/30">
      <div className="flex max-h-[calc(100dvh-var(--safe-top)-12px)] w-full max-w-[430px] flex-col overflow-hidden rounded-t-[24px] bg-white shadow-card">
        <div className="min-h-0 overflow-y-auto p-4 pb-3">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[17px] font-semibold">Modifier le repas</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-health-bg"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>
        <p className="mb-3 text-[13px] leading-snug text-health-muted">{meal.name}</p>

        <p className="mb-2 text-[12px] font-medium text-health-muted">Type de repas</p>
        <div className="mb-3 grid grid-cols-2 gap-1.5">
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

        {onSwapWeek ? (
          <button
            type="button"
            onClick={onSwapWeek}
            className="mb-4 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-health-bg py-2.5 text-[13px] font-semibold"
          >
            <ArrowLeftRight size={14} />
            Échanger avec un plat de la semaine
          </button>
        ) : null}

        {moving ? (
          <p className="mb-3 text-[12px] leading-snug text-health-muted">
            {occupant && isFilledMeal(occupant)
              ? `Tu échanges avec « ${occupant.name} » — ce plat passera en ${mealTypeLabel(meal.type).toLowerCase()}.`
              : `Le créneau ${mealTypeLabel(meal.type).toLowerCase()} restera sauté (tu pourras y remettre un plat).`}
          </p>
        ) : null}

        <div className="space-y-1">
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
                      void addDessert();
                    }
                  }}
                  placeholder="Ex. 1 carreau de chocolat"
                  className="min-w-0 flex-1 rounded-card bg-amber-50 px-3 py-2 text-[13px] outline-none dark:bg-amber-950/40"
                />
                <button
                  type="button"
                  onClick={() => void addDessert()}
                  disabled={!dessertDraft.trim() || addingDessert}
                  className="rounded-card bg-health-ink px-3 text-[12px] font-semibold text-white disabled:opacity-40"
                >
                  {addingDessert ? "…" : "Ajouter"}
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
          {onAdd ? (
            <div className="grid grid-cols-2 gap-2">
              <AddLogTile icon={Sparkles} label="Texte / IA" onClick={() => onAdd("text")} />
              <AddLogTile icon={ScanBarcode} label="Code-barres" onClick={() => onAdd("barcode")} />
              <AddLogTile icon={Camera} label="Photo" onClick={() => onAdd("photo")} />
              <AddLogTile icon={Clock} label="Récents" onClick={() => onAdd("recent")} />
            </div>
          ) : (
            <div className="flex gap-1.5">
              <input
                value={platDraft}
                onChange={(e) => setPlatDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void addPlatText();
                  }
                }}
                placeholder="Ex. Skyr 150g"
                className="min-w-0 flex-1 rounded-card bg-health-bg px-3 py-2 text-[13px] outline-none"
              />
              <button
                type="button"
                onClick={() => void addPlatText()}
                disabled={!platDraft.trim() || addingPlat}
                className="rounded-card bg-health-ink px-3 text-[12px] font-semibold text-white disabled:opacity-40"
              >
                {addingPlat ? "…" : "Ajouter"}
              </button>
            </div>
          )}
        </div>
        </div>

        <div className="shrink-0 border-t border-health-line/80 bg-white px-4 pt-3 pb-[max(16px,var(--safe-bottom))]">
          <Card className="bg-health-bg shadow-none">
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
    <QtyEditRow
      name={item.name}
      qty={item.qty ?? item.grams}
      unit={item.unit ?? "g"}
      grams={item.grams}
      calories={item.calories}
      dessert={dessert}
      detail={`${Math.round(item.protein)}g P`}
      onQty={(qty) => onChange(scaleItemQty(item, qty))}
      onGrams={(grams) => onChange(scaleItem(item, grams))}
      onKcal={(kcal) => onChange(scaleItemKcal(item, kcal))}
      onRemove={onRemove}
    />
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
