"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { MealTemplateSheet } from "@/components/parametres/MealTemplateSheet";
import { emptySlotTemplate } from "@/lib/meal-templates";
import { formatWeekdays } from "@/lib/sport-routine";
import type { ProfileId, SlotTemplate } from "@/lib/types";
import { cn, formatKcal } from "@/lib/utils";

export function MealTemplatesEditor({
  profileId,
  name,
  accent,
  templates,
  onChange,
}: {
  profileId: ProfileId;
  name: string;
  accent: "coral" | "violet";
  templates: SlotTemplate[];
  onChange: (next: SlotTemplate[]) => void;
}) {
  const [editing, setEditing] = useState<SlotTemplate | null>(null);
  const breakfasts = templates.filter((item) => item.slot === "petit-dejeuner");
  const snacks = templates.filter((item) => item.slot === "collation");
  const lunchDesserts = templates.filter((item) => item.slot === "dessert-midi");
  const dinnerDesserts = templates.filter((item) => item.slot === "dessert-soir");

  function upsert(next: SlotTemplate) {
    const exists = templates.some((item) => item.id === next.id);
    onChange(exists ? templates.map((item) => (item.id === next.id ? next : item)) : [...templates, next]);
    setEditing(null);
  }

  function remove(id: string) {
    onChange(templates.filter((item) => item.id !== id));
    setEditing(null);
  }

  return (
    <Card compact className={profileId === "elodie" ? "mt-1.5" : undefined}>
      <p
        className={cn(
          "text-[11px] font-semibold uppercase tracking-wide",
          accent === "coral" ? "text-coral-dark" : "text-violet-dark",
        )}
      >
        {name}
      </p>
      <Group
        title="Petit-déjeuner"
        templates={breakfasts}
        onEdit={setEditing}
        onDelete={(id) => remove(id)}
        onAdd={() => setEditing(emptySlotTemplate("petit-dejeuner"))}
      />
      <Group
        title="Collation"
        templates={snacks}
        onEdit={setEditing}
        onDelete={(id) => remove(id)}
        onAdd={() => setEditing(emptySlotTemplate("collation"))}
      />
      <Group
        title="Dessert midi"
        templates={lunchDesserts}
        onEdit={setEditing}
        onDelete={(id) => remove(id)}
        onAdd={() => setEditing(emptySlotTemplate("dessert-midi"))}
      />
      <Group
        title="Dessert soir"
        templates={dinnerDesserts}
        onEdit={setEditing}
        onDelete={(id) => remove(id)}
        onAdd={() => setEditing(emptySlotTemplate("dessert-soir"))}
      />
      {editing ? (
        <MealTemplateSheet
          template={editing}
          accent={accent}
          isNew={!templates.some((item) => item.id === editing.id)}
          onClose={() => setEditing(null)}
          onSave={upsert}
          onDelete={templates.some((item) => item.id === editing.id) ? () => remove(editing.id) : undefined}
        />
      ) : null}
    </Card>
  );
}

function Group({
  title,
  templates,
  onEdit,
  onDelete,
  onAdd,
}: {
  title: string;
  templates: SlotTemplate[];
  onEdit: (template: SlotTemplate) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold">{title}</p>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-0.5 rounded-full bg-health-bg px-2 py-0.5 text-[11px] font-semibold"
        >
          <Plus size={12} />
          Ajouter
        </button>
      </div>
      {templates.length === 0 ? (
        <p className="mt-1 text-[12px] text-health-muted">Aucun modèle.</p>
      ) : (
        <ul className="mt-1 space-y-1.5">
          {templates.map((item) => (
            <TemplateRow
              key={item.id}
              template={item}
              onEdit={() => onEdit(item)}
              onDelete={() => onDelete(item.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function TemplateRow({
  template,
  onEdit,
  onDelete,
}: {
  template: SlotTemplate;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const days = formatWeekdays(template.weekdays);
  return (
    <li className="rounded-xl bg-health-bg px-2.5 py-2">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold">{template.name || "Sans nom"}</p>
          <p className="mt-0.5 text-[11px] text-health-muted">
            {formatKcal(template.macros.calories)} · {template.macros.protein}g P
            {days ? ` · ${days}` : ""}
          </p>
          {template.items[0] ? (
            <p className="mt-0.5 truncate text-[11px] text-health-muted">{template.items[0]}</p>
          ) : null}
        </div>
        <button type="button" onClick={onEdit} className="rounded-full p-1 text-health-muted" aria-label="Éditer">
          <Pencil size={14} />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="rounded-full p-1 text-health-muted"
          aria-label="Supprimer"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </li>
  );
}
