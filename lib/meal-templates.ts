import type { Json } from "@/lib/supabase/database.types";
import { isoWeekday, todayISO } from "@/lib/dates";
import { normalizeIngredientLines } from "@/lib/food-log";
import { storage } from "@/lib/storage";
import type {
  Macros,
  MealEntry,
  MealType,
  ProfileId,
  SlotTemplate,
  SlotTemplateKind,
  Weekday,
} from "@/lib/types";

export const SLOT_TEMPLATE_KINDS: { id: SlotTemplateKind; label: string }[] = [
  { id: "petit-dejeuner", label: "Petit-déj" },
  { id: "collation", label: "Collation" },
  { id: "dessert-midi", label: "Dessert midi" },
  { id: "dessert-soir", label: "Dessert soir" },
];

const KIND_IDS: SlotTemplateKind[] = SLOT_TEMPLATE_KINDS.map((item) => item.id);
const DESSERT_PREFIX = /^Dessert\s*[:·]\s*/i;
const ALL_DAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7];
const STORAGE_KEY = "meal-templates";

function asWeekdays(value: unknown): Weekday[] {
  if (!Array.isArray(value)) return [...ALL_DAYS];
  const days = value
    .map((item) => Number(item))
    .filter((item): item is Weekday => item >= 1 && item <= 7);
  return [...new Set(days)].sort((a, b) => a - b);
}

function asMacros(value: unknown): Macros {
  const rec = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const n = (key: string) => {
    const raw = rec[key];
    const num = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(num) ? Math.max(0, Math.round(num)) : 0;
  };
  return {
    calories: n("calories"),
    protein: n("protein"),
    carbs: n("carbs"),
    fat: n("fat"),
  };
}

function asItems(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseSlotTemplate(raw: unknown): SlotTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const slot = KIND_IDS.includes(rec.slot as SlotTemplateKind) ? (rec.slot as SlotTemplateKind) : null;
  if (!slot) return null;
  const name = typeof rec.name === "string" ? rec.name.trim() : "";
  const id = typeof rec.id === "string" && rec.id.trim() ? rec.id.trim() : `tpl-${slot}-${Math.random().toString(36).slice(2, 8)}`;
  const time = typeof rec.time === "string" ? rec.time.slice(0, 5) : undefined;
  return {
    id,
    slot,
    name,
    items: asItems(rec.items),
    macros: asMacros(rec.macros),
    weekdays: asWeekdays(rec.weekdays),
    time,
  };
}

export function parseMealTemplates(raw: unknown, profileId: ProfileId): SlotTemplate[] {
  if (raw == null || !Array.isArray(raw) || raw.length === 0) {
    return defaultMealTemplates(profileId);
  }
  const parsed = raw.map(parseSlotTemplate).filter((item): item is SlotTemplate => Boolean(item));
  return parsed.length ? parsed : defaultMealTemplates(profileId);
}

export function mealTemplatesToJson(templates: SlotTemplate[]): Json {
  return templates.map((item) => ({
    id: item.id,
    slot: item.slot,
    name: item.name,
    items: item.items,
    macros: {
      calories: item.macros.calories,
      protein: item.macros.protein,
      carbs: item.macros.carbs,
      fat: item.macros.fat,
    },
    weekdays: item.weekdays,
    time: item.time ?? null,
  }));
}

export function defaultMealTemplates(profileId: ProfileId): SlotTemplate[] {
  if (profileId === "alexis") {
    return [
      {
        id: "alexis-pd",
        slot: "petit-dejeuner",
        name: "Overnight oats soja, myrtilles, graines de chia",
        items: ["Flocons d'avoine 60g", "Lait soja 200ml", "Chia 10g", "Myrtilles 80g"],
        macros: { calories: 420, protein: 24, carbs: 52, fat: 14 },
        weekdays: [...ALL_DAYS],
        time: "07:40",
      },
      {
        id: "alexis-col",
        slot: "collation",
        name: "Tofu soyeux vanille, cacao, whey vegan",
        items: ["Tofu soyeux vanille 150g", "Cacao 5g", "Whey vegan 10g"],
        macros: { calories: 190, protein: 22, carbs: 8, fat: 6 },
        weekdays: [...ALL_DAYS],
        time: "16:30",
      },
      {
        id: "alexis-dessert-midi",
        slot: "dessert-midi",
        name: "Yaourt soja, myrtilles",
        items: ["Yaourt soja nature 125g", "Myrtilles 40g"],
        macros: { calories: 100, protein: 5, carbs: 13, fat: 2 },
        weekdays: [...ALL_DAYS],
        time: "13:15",
      },
      {
        id: "alexis-dessert-soir",
        slot: "dessert-soir",
        name: "Chocolat noir",
        items: ["Chocolat noir 15g"],
        macros: { calories: 85, protein: 1, carbs: 6, fat: 6 },
        weekdays: [...ALL_DAYS],
        time: "20:30",
      },
    ];
  }
  return [
    {
      id: "elodie-pd",
      slot: "petit-dejeuner",
      name: "Skyr, granola maison, framboises",
      items: ["Skyr 200g", "Granola 30g", "Framboises 80g"],
      macros: { calories: 380, protein: 32, carbs: 38, fat: 10 },
      weekdays: [...ALL_DAYS],
      time: "07:55",
    },
    {
      id: "elodie-col",
      slot: "collation",
      name: "Fromage blanc 0% + fraises",
      items: ["Fromage blanc 0% 200g", "Fraises 80g"],
      macros: { calories: 140, protein: 18, carbs: 10, fat: 1 },
      weekdays: [...ALL_DAYS],
      time: "16:30",
    },
    {
      id: "elodie-dessert-midi",
      slot: "dessert-midi",
      name: "Skyr, framboises",
      items: ["Skyr 120g", "Framboises 40g"],
      macros: { calories: 95, protein: 14, carbs: 9, fat: 0 },
      weekdays: [...ALL_DAYS],
      time: "13:15",
    },
    {
      id: "elodie-dessert-soir",
      slot: "dessert-soir",
      name: "Chocolat noir",
      items: ["Chocolat noir 15g"],
      macros: { calories: 85, protein: 1, carbs: 6, fat: 6 },
      weekdays: [...ALL_DAYS],
      time: "20:30",
    },
  ];
}

function defaultTime(slot: SlotTemplateKind) {
  if (slot === "petit-dejeuner") return "08:00";
  if (slot === "dessert-midi") return "13:15";
  if (slot === "dessert-soir") return "20:30";
  return "16:30";
}

function defaultTemplateName(slot: SlotTemplateKind) {
  if (slot === "collation") return "Collation";
  if (slot === "dessert-midi") return "Dessert midi";
  if (slot === "dessert-soir") return "Dessert soir";
  return "Petit-déjeuner";
}

export function emptySlotTemplate(slot: SlotTemplateKind): SlotTemplate {
  return {
    id: `tpl-${slot}-${Date.now()}`,
    slot,
    name: "",
    items: [],
    macros: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    weekdays: [...ALL_DAYS],
    time: defaultTime(slot),
  };
}

export function isDessertSlot(slot: SlotTemplateKind) {
  return slot === "dessert-midi" || slot === "dessert-soir";
}

export function mealTypeForTemplate(slot: SlotTemplateKind): MealType {
  if (slot === "dessert-midi") return "dejeuner";
  if (slot === "dessert-soir") return "diner";
  return slot;
}

export function isDessertItemLine(line: string) {
  return DESSERT_PREFIX.test(line.trim());
}

export function stripDessertPrefix(line: string) {
  return line.replace(DESSERT_PREFIX, "").trim();
}

export function isEmptyDessertMarker(line: string) {
  if (!isDessertItemLine(line)) return false;
  const rest = stripDessertPrefix(line);
  return !rest || /^(—|-|–|aucun)$/i.test(rest);
}

export function dessertDisplayName(line: string) {
  return stripDessertPrefix(line);
}

export function splitMealItemLines(items: string[] | undefined) {
  const list = items ?? [];
  return {
    plat: list.filter((line) => !isDessertItemLine(line)),
    dessert: list.filter((line) => isDessertItemLine(line) && !isEmptyDessertMarker(line)),
  };
}

export function platLinesOf(items: string[] | undefined) {
  return (items ?? []).filter((line) => !isDessertItemLine(line));
}

export function dessertLinesOf(items: string[] | undefined) {
  return (items ?? []).filter((line) => isDessertItemLine(line));
}

export function appendPlatKeepingDessert(existing: string[] | undefined, incoming: string[]) {
  return [...platLinesOf(existing), ...incoming, ...dessertLinesOf(existing)];
}

export function withKeptDessert(
  existingItems: string[] | undefined,
  nextItems: string[],
  nextMacros: Macros,
): { items: string[]; macros: Macros } {
  const dessert = dessertLinesOf(existingItems);
  const visible = dessert.filter((line) => !isEmptyDessertMarker(line));
  return {
    items: [...platLinesOf(nextItems), ...dessert],
    macros: visible.length ? addMacros(nextMacros, macrosFromDessertLines(existingItems ?? [])) : nextMacros,
  };
}

export function withDessertPrefix(line: string) {
  const clean = stripDessertPrefix(line).trim();
  return clean ? `Dessert : ${clean}` : "";
}

export function dessertLinesFromTemplate(template: SlotTemplate): string[] {
  return template.items
    .map((line) => stripDessertPrefix(line))
    .filter(Boolean)
    .map((line) => `Dessert : ${line}`);
}

function addMacros(left: Macros, right: Macros): Macros {
  return {
    calories: left.calories + right.calories,
    protein: left.protein + right.protein,
    carbs: left.carbs + right.carbs,
    fat: left.fat + right.fat,
  };
}

function subMacros(left: Macros, right: Macros): Macros {
  return {
    calories: Math.max(0, left.calories - right.calories),
    protein: Math.max(0, left.protein - right.protein),
    carbs: Math.max(0, left.carbs - right.carbs),
    fat: Math.max(0, left.fat - right.fat),
  };
}

function macrosFromDessertLines(items: string[]): Macros {
  const names = items
    .filter((line) => isDessertItemLine(line) && !isEmptyDessertMarker(line))
    .map((line) => stripDessertPrefix(line));
  if (!names.length) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
  return normalizeIngredientLines(names).macros;
}

export function mergeDessertIntoMeal(
  meal: MealEntry,
  template: SlotTemplate,
  opts: { replace?: boolean } = {},
): MealEntry {
  const dessertLines = dessertLinesFromTemplate(template);
  const current = meal.items ?? [];
  const currentDessert = current.filter(isDessertItemLine);
  if (currentDessert.length > 0 && !opts.replace) return meal;

  const same =
    dessertLines.length === currentDessert.length &&
    dessertLines.every((line) => currentDessert.includes(line));
  if (same && !opts.replace) return meal;

  const baseItems = current.filter((line) => !isDessertItemLine(line));
  const baseMacros = currentDessert.some((line) => !isEmptyDessertMarker(line))
    ? subMacros(meal.macros, macrosFromDessertLines(current))
    : meal.macros;
  return {
    ...meal,
    items: [...baseItems, ...dessertLines],
    macros: dessertLines.length ? addMacros(baseMacros, template.macros) : baseMacros,
  };
}

export function templateForSlot(
  templates: SlotTemplate[],
  slot: SlotTemplateKind,
  weekday: Weekday,
): SlotTemplate | null {
  return templates.find((item) => item.slot === slot && item.weekdays.includes(weekday)) ?? null;
}

export function loadHouseholdMealTemplates(): Record<ProfileId, SlotTemplate[]> {
  const saved = storage.getJSON<Partial<Record<ProfileId, SlotTemplate[]>>>(STORAGE_KEY, {});
  return {
    alexis: parseMealTemplates(saved.alexis, "alexis"),
    elodie: parseMealTemplates(saved.elodie, "elodie"),
  };
}

export function saveHouseholdMealTemplatesLocal(next: Partial<Record<ProfileId, SlotTemplate[]>>) {
  const current = storage.getJSON<Partial<Record<ProfileId, SlotTemplate[]>>>(STORAGE_KEY, {});
  storage.setJSON(STORAGE_KEY, { ...current, ...next });
}

export function mealFromTemplate(
  profileId: ProfileId,
  template: SlotTemplate,
  id = `plan-${profileId}-${template.slot}`,
): MealEntry {
  const dessert = isDessertSlot(template.slot);
  return {
    id,
    name: template.name || defaultTemplateName(template.slot),
    type: mealTypeForTemplate(template.slot),
    time: template.time ?? "",
    macros: template.macros,
    profileId,
    source: "plan",
    items: dessert ? dessertLinesFromTemplate(template) : template.items,
    isSkipped: false,
  };
}

export function plannedSlotEntry(
  profileId: ProfileId,
  type: MealType,
  date = todayISO(),
): MealEntry | null {
  if (type !== "petit-dejeuner" && type !== "collation") return null;
  const template = templateForSlot(
    loadHouseholdMealTemplates()[profileId],
    type,
    isoWeekday(date),
  );
  return template ? mealFromTemplate(profileId, template) : null;
}
