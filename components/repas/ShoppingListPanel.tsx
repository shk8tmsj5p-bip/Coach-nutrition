"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { RecipeTag } from "@/components/repas/RecipeTag";
import { HoldTip } from "@/components/ui/HoldTip";
import { aisleStyle } from "@/lib/plan-colors";
import { storage } from "@/lib/storage";
import {
  AISLE_ORDER,
  groupShoppingItems,
  saveAisleOverride,
  shoppingItemsFromPlan,
  shoppingListPlainText,
  type AisleName,
} from "@/lib/shopping-from-plan";
import type { PlannedMeal, ShoppingListItem } from "@/lib/types";
import type { WeekLunchDessert } from "@/lib/week-dessert";
import { cn } from "@/lib/utils";

export function ShoppingListPanel({
  weekStart,
  plan,
  dessert,
}: {
  weekStart: string;
  plan: PlannedMeal[];
  dessert?: WeekLunchDessert | null;
}) {
  const [aisleRev, setAisleRev] = useState(0);
  const derived = useMemo(
    () =>
      shoppingItemsFromPlan(
        plan,
        dessert && dessert.weekdays.length
          ? [{ meal: dessert.meal, tag: "D", times: dessert.weekdays.length }]
          : [],
      ),
    [plan, dessert, aisleRev],
  );
  const [custom, setCustom] = useState<ShoppingListItem[]>([]);
  const [checked, setChecked] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [aisle, setAisle] = useState<AisleName>("AUTRE");

  useEffect(() => {
    setCustom(storage.getJSON<ShoppingListItem[]>(`shop-custom:${weekStart}`, []));
    setChecked(storage.getJSON<string[]>(`shop-checked:${weekStart}`, []));
  }, [weekStart, plan]);

  const items = useMemo(() => [...derived, ...custom], [derived, custom]);
  const groups = useMemo(() => groupShoppingItems(items), [items]);
  const remaining = items.filter((item) => !checked.includes(item.id)).length;

  function persistChecked(next: string[]) {
    setChecked(next);
    storage.setJSON(`shop-checked:${weekStart}`, next);
  }

  function persistCustom(next: ShoppingListItem[]) {
    setCustom(next);
    storage.setJSON(`shop-custom:${weekStart}`, next);
  }

  function toggle(id: string) {
    persistChecked(checked.includes(id) ? checked.filter((item) => item !== id) : [...checked, id]);
  }

  function recategorize(item: ShoppingListItem, nextAisle: AisleName) {
    if (nextAisle === item.aisle) return;
    saveAisleOverride(item.name, nextAisle);
    setAisleRev((n) => n + 1);
  }

  function addCustom() {
    const label = name.trim();
    if (!label) return;
    persistCustom([
      ...custom,
      {
        id: `custom-${Date.now()}`,
        name: label,
        aisle,
        quantityLabel: qty.trim(),
        gramsAlexis: 0,
        gramsElodie: 0,
        custom: true,
      },
    ]);
    setName("");
    setQty("");
  }

  async function copyNotes() {
    await navigator.clipboard.writeText(shoppingListPlainText(items));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => void copyNotes()}
        className="mb-3 flex w-full items-center justify-center gap-2 rounded-card bg-health-ink py-3 text-[14px] font-semibold text-white"
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
        {copied ? "Copié pour Apple Notes" : "Copier pour Apple Notes"}
      </button>
      <p className="mb-3 px-1 text-[12px] text-health-muted">
        {remaining} article{remaining > 1 ? "s" : ""} restant{remaining > 1 ? "s" : ""} · liste générée depuis
        la semaine. Dans Autre, choisis le rayon : il est retenu pour les prochaines listes.
      </p>

      <Card className="mb-3">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-health-muted">Ajouter</p>
        <div className="mt-2 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex. Citron vert"
            className="min-w-0 flex-1 rounded-xl bg-health-bg px-3 py-2 text-[14px] outline-none"
          />
          <input
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="4"
            className="w-16 rounded-xl bg-health-bg px-2 py-2 text-center text-[14px] outline-none"
          />
        </div>
        <div className="mt-2 flex gap-2">
          <select
            value={aisle}
            onChange={(e) => setAisle(e.target.value as AisleName)}
            className="min-w-0 flex-1 rounded-xl bg-health-bg px-3 py-2 text-[13px] outline-none"
          >
            {AISLE_ORDER.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={addCustom}
            className="flex items-center gap-1 rounded-xl bg-health-ink px-3 py-2 text-[13px] font-semibold text-white"
          >
            <Plus size={14} />
            OK
          </button>
        </div>
      </Card>

      {groups.map((group) => {
        const tone = aisleStyle(group.aisle);
        return (
        <div key={group.aisle}>
          <p
            className={cn(
              "mb-1 mt-2.5 rounded-lg px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
              tone.header,
            )}
          >
            {group.aisle}
          </p>
          <Card className={cn("border p-1", tone.card)}>
            {group.items.map((item) => {
              const on = checked.includes(item.id);
              const qty = (item.quantityLabel || item.name).replace(/\s*-\s*\[[^\]]+\]/, "").trim();
              const line = item.custom
                ? [item.name, item.quantityLabel].filter(Boolean).join(" ")
                : qty;
              const tags = item.planTags?.length ? item.planTags.join(", ") : "";
              const full = [line, tags ? `[${tags}]` : ""].filter(Boolean).join(" · ");
              return (
                <div key={item.id} className="flex items-center gap-1 rounded-lg px-1.5 py-1">
                  <button
                    type="button"
                    onClick={() => toggle(item.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border",
                        on ? "border-health-ink bg-health-ink text-white" : "border-health-muted/40 bg-white",
                      )}
                    >
                      {on && <Check size={10} strokeWidth={3} />}
                    </span>
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: tone.hex }} />
                    <HoldTip label={full} className={cn("text-[13px] font-medium", on && "opacity-40")}>
                      <span className={cn(on && "line-through")}>{line}</span>
                    </HoldTip>
                    {(item.planTags?.length ?? 0) > 0 && (
                      <span className={cn("flex shrink-0 gap-0.5", on && "opacity-40")}>
                        {item.planTags!.map((tag) => (
                          <RecipeTag key={tag} recipeNo={tag} compact />
                        ))}
                      </span>
                    )}
                  </button>
                  {item.aisle === "AUTRE" && !item.custom && (
                    <select
                      aria-label={`Rayon pour ${item.name}`}
                      defaultValue=""
                      onChange={(event) => {
                        const next = event.target.value as AisleName;
                        if (!next) return;
                        recategorize(item, next);
                      }}
                      className="max-w-[7.2rem] shrink-0 rounded-md bg-health-bg px-1 py-1 text-[10px] font-semibold text-health-muted outline-none"
                    >
                      <option value="" disabled>
                        Rayon
                      </option>
                      {AISLE_ORDER.filter((option) => option !== "AUTRE").map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              );
            })}
          </Card>
        </div>
        );
      })}
    </div>
  );
}
