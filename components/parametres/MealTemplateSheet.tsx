"use client";

import { useEffect, useMemo, useState } from "react";
import { Camera, Clock, ScanBarcode, Sparkles, X } from "lucide-react";
import { ChipSelector } from "@/components/parametres/ChipSelector";
import { LogSheet, type FoodLogMode } from "@/components/today/LogSheet";
import { QtyEditRow } from "@/components/today/QtyEditRow";
import { RecentsSheet } from "@/components/today/RecentsSheet";
import {
  applyTrustedNutrition,
  formatDetectedLine,
  macrosFromIngredients,
  parseFoodTextLocal,
  parseLogLine,
  scaleDetected,
  scaleDetectedKcal,
  scaleDetectedQty,
} from "@/lib/food-log";
import { requestLogText } from "@/lib/gemini/client";
import { todayISO } from "@/lib/dates";
import { recentFoodsFromMeals, recentFoodToDetected, type DatedMeal } from "@/lib/recent-foods";
import { SLOT_TEMPLATE_KINDS } from "@/lib/meal-templates";
import { WEEKDAYS, toggleWeekday } from "@/lib/sport-routine";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { fetchRecentLoggedMeals, fetchTodayMeals } from "@/lib/supabase/today-data";
import type {
  DetectedIngredient,
  DietType,
  Macros,
  MealType,
  ProfileId,
  SlotTemplate,
  SlotTemplateKind,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type DraftLine = DetectedIngredient;

function sumLines(items: DraftLine[]): Macros {
  return macrosFromIngredients(items);
}

function linesFromTemplate(template: SlotTemplate): DraftLine[] {
  const items = template.items.filter((line) => line.trim());
  if (!items.length) return [];
  return items.map((line, index) => {
    const parsed = parseLogLine(line);
    return applyTrustedNutrition({
      id: `${template.id}-${index}`,
      name: parsed.name,
      grams: parsed.grams,
      qty: parsed.qty,
      unit: parsed.unit,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    });
  });
}

function slotMealType(slot: SlotTemplateKind): MealType {
  return slot === "collation" ? "collation" : "petit-dejeuner";
}

export function MealTemplateSheet({
  template,
  profileId,
  accent,
  diet,
  isNew,
  onClose,
  onSave,
  onDelete,
}: {
  template: SlotTemplate;
  profileId: ProfileId;
  accent: "coral" | "violet";
  diet: DietType;
  isNew?: boolean;
  onClose: () => void;
  onSave: (next: SlotTemplate) => void;
  onDelete?: () => void;
}) {
  const [draft, setDraft] = useState<SlotTemplate>(template);
  const [lines, setLines] = useState<DraftLine[]>(() => linesFromTemplate(template));
  const [logMode, setLogMode] = useState<FoodLogMode | null>(null);
  const [textInput, setTextInput] = useState("");
  const [ingredients, setIngredients] = useState<DetectedIngredient[]>([]);
  const [recentsOpen, setRecentsOpen] = useState(false);
  const [recentMeals, setRecentMeals] = useState<DatedMeal[]>([]);
  const [busy, setBusy] = useState(false);
  const canSave = useMemo(() => draft.name.trim().length > 0, [draft.name]);
  const quickLog = draft.slot === "petit-dejeuner" || draft.slot === "collation";

  useEffect(() => {
    void (async () => {
      const supabase = createBrowserSupabaseClient();
      if (!supabase) return;
      const [today, recents] = await Promise.all([
        fetchTodayMeals(supabase, [profileId]),
        fetchRecentLoggedMeals(supabase, [profileId]),
      ]);
      setRecentMeals([
        ...(today.meals ?? []).map((meal) => ({ ...meal, date: todayISO() })),
        ...(recents.meals ?? []),
      ]);
    })();
  }, [profileId]);

  function commitLines(next: DraftLine[]) {
    setLines(next);
    setDraft((current) => ({
      ...current,
      items: next.map((item) => formatDetectedLine(item)),
      macros: sumLines(next),
    }));
  }

  function appendDetected(extra: DetectedIngredient[]) {
    if (!extra.length) return;
    commitLines([
      ...lines,
      ...extra.map((item, index) => ({ ...item, id: `${item.id}-${Date.now()}-${index}` })),
    ]);
  }

  function closeLog() {
    setLogMode(null);
    setRecentsOpen(false);
    setTextInput("");
    setIngredients([]);
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
        <div className="space-y-1">
          {lines.map((item) => (
            <QtyEditRow
              key={item.id}
              name={item.name}
              qty={item.qty ?? item.grams}
              unit={item.unit ?? "g"}
              grams={item.grams}
              calories={item.calories}
              detail={`${Math.round(item.protein)}g P`}
              onQty={(qty) =>
                commitLines(lines.map((row) => (row.id === item.id ? scaleDetectedQty(row, qty) : row)))
              }
              onGrams={(grams) =>
                commitLines(lines.map((row) => (row.id === item.id ? scaleDetected(row, grams) : row)))
              }
              onKcal={(kcal) =>
                commitLines(lines.map((row) => (row.id === item.id ? scaleDetectedKcal(row, kcal) : row)))
              }
              onRemove={() => commitLines(lines.filter((row) => row.id !== item.id))}
            />
          ))}
        </div>

        {quickLog ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <LogTile
              icon={Sparkles}
              label="Texte / IA"
              accent={accent}
              onClick={() => {
                setIngredients([]);
                setTextInput("");
                setLogMode("text");
              }}
            />
            <LogTile
              icon={ScanBarcode}
              label="Code-barres"
              accent={accent}
              onClick={() => setLogMode("barcode")}
            />
            <LogTile icon={Camera} label="Photo" accent={accent} onClick={() => setLogMode("photo")} />
            <LogTile icon={Clock} label="Récents" accent={accent} onClick={() => setRecentsOpen(true)} />
          </div>
        ) : (
          <QuickTextAdd
            diet={diet}
            onAdd={(extra) => appendDetected(extra)}
          />
        )}
        <p className="mt-1.5 text-[11px] leading-snug text-health-muted">
          Quantité, grammes ou kcal : l’un recalcule les autres.
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
            onSave({
              ...draft,
              name: draft.name.trim(),
              items: lines.map((item) => formatDetectedLine(item)),
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

      {logMode ? (
        <LogSheet
          mode={logMode}
          mealType={slotMealType(draft.slot)}
          profileId={profileId}
          confirmLabel="Ajouter au modèle"
          textInput={textInput}
          setTextInput={setTextInput}
          ingredients={ingredients}
          setIngredients={setIngredients}
          onClose={closeLog}
          onSaveText={() => {
            appendDetected(ingredients);
            closeLog();
          }}
          onSaveBarcode={(product, grams, macros) => {
            const line = {
              id: `barcode-${Date.now()}`,
              name: product.name,
              grams,
              qty: grams,
              unit: "g" as const,
              ...macros,
            };
            appendDetected([macros.calories > 0 ? line : applyTrustedNutrition(line)]);
            closeLog();
          }}
          onSavePhoto={() => {
            appendDetected(ingredients);
            closeLog();
          }}
        />
      ) : null}

      {recentsOpen ? (
        <RecentsSheet
          foods={recentFoodsFromMeals(recentMeals, profileId)}
          confirming={busy}
          onClose={() => setRecentsOpen(false)}
          onPick={(food) => {
            if (busy) return;
            setBusy(true);
            try {
              appendDetected([recentFoodToDetected(food)]);
              setRecentsOpen(false);
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}
    </div>
  );
}

function LogTile({
  icon: Icon,
  label,
  accent,
  onClick,
}: {
  icon: typeof Camera;
  label: string;
  accent: "coral" | "violet";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-card bg-health-bg py-2.5",
        accent === "coral" ? "text-coral-dark" : "text-violet-dark",
      )}
    >
      <Icon size={18} />
      <span className="text-[11px] font-semibold text-health-ink">{label}</span>
    </button>
  );
}

function QuickTextAdd({
  diet,
  onAdd,
}: {
  diet: DietType;
  onAdd: (items: DetectedIngredient[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);

  async function add() {
    const raw = draft.trim();
    if (!raw || adding) return;
    setAdding(true);
    try {
      const parsed = await requestLogText(raw, diet);
      onAdd(parsed.length ? parsed : parseFoodTextLocal(raw));
      setDraft("");
    } finally {
      setAdding(false);
    }
  }

  return (
    <form
      className="mt-1.5 flex gap-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        void add();
      }}
    >
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Ex. 1 carreau de chocolat"
        className="min-w-0 flex-1 rounded-lg bg-health-bg px-2.5 py-1.5 text-[13px] outline-none"
      />
      <button
        type="submit"
        disabled={adding || !draft.trim()}
        className="shrink-0 rounded-lg bg-health-bg px-2.5 py-1.5 text-[12px] font-semibold disabled:opacity-40"
      >
        {adding ? "…" : "+"}
      </button>
    </form>
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
