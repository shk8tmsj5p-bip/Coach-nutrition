import type { BatchSession, NumberedRecipe } from "@/lib/batch-from-plan";
import type { BatchStep, BatchStepIngredient, BatchStepRecipeBlock, RecipeIngredient } from "@/lib/types";
import { cookScale } from "@/lib/qty-scale";
import { isFluffLine, isStepSection, stepSectionLabel } from "@/lib/recipe-copy";
import {
  inferSpoonUnit,
  inferVisualUnit,
  scaleVisualQuantity,
  visualForIngredient,
} from "@/lib/visual-quantity";

function gramsOf(ing: RecipeIngredient, scale: number) {
  return Math.round((ing.gramsAlexis + ing.gramsElodie) * scale);
}

function visualOf(ing: RecipeIngredient, scale: number) {
  const grams = Math.max(ing.gramsAlexis, ing.gramsElodie);
  const base = visualForIngredient(ing.name, grams, ing.visualQuantity) || inferVisualUnit(ing.name, grams);
  const spoon = inferSpoonUnit(ing.name, gramsOf(ing, scale));
  return spoon || scaleVisualQuantity(base, scale) || `${gramsOf(ing, scale)}g`;
}

function prepOf(ing: RecipeIngredient) {
  const notes = (ing.notes ?? "").trim();
  if (!notes) return "";
  if (/pièce|botte|barquette|gousse|brin|cc|cs|tranche|cm\b/i.test(notes)) return "";
  return notes.replace(/\.$/, "");
}

export function isSauceIngredient(ing: RecipeIngredient) {
  return /sauce|vinaigrette|marinade|tahini|tahin|houmous|pesto|pistou|satay|nuoc|raifort/i.test(
    `${ing.name} ${ing.notes ?? ""}`,
  );
}

export function splitRecipeParts(meal: NumberedRecipe) {
  const proteins = meal.ingredients.filter((ing) => ing.role !== "shared");
  const shared = meal.ingredients.filter((ing) => ing.role === "shared");
  const sauce = shared.filter(isSauceIngredient);
  const base = shared.filter((ing) => !isSauceIngredient(ing));
  return { base, sauce, proteins, alexis: proteins.filter((ing) => ing.role === "alexis"), elodie: proteins.filter((ing) => ing.role === "elodie") };
}

/** « 2 courgettes, râpé fin » / « 1 cm gingembre » */
export function visualPhrase(ing: RecipeIngredient, scale: number) {
  const visual = visualOf(ing, scale);
  const prep = prepOf(ing);
  const name = ing.name;
  if (prep && /spaghetti|râpé|rape|lamelle|dés|cubes|émincé|emince/i.test(prep)) {
    return `${prep} (${visual} ${name.toLowerCase()})`;
  }
  if (prep) return `${visual} ${name.toLowerCase()} (${prep})`;
  return `${visual} ${name.toLowerCase()}`;
}

export function proseList(ings: RecipeIngredient[], scale: number) {
  const bits = ings.map((ing) => visualPhrase(ing, scale));
  if (bits.length === 0) return "";
  if (bits.length === 1) return bits[0];
  return `${bits.slice(0, -1).join(", ")} et ${bits[bits.length - 1]}`;
}

export function proteinQty(ing: RecipeIngredient, scale: number) {
  const g = Math.round((ing.role === "elodie" ? ing.gramsElodie : ing.gramsAlexis) * scale);
  const visual = visualOf(ing, scale);
  const prep = prepOf(ing);
  return `${g}g ${ing.name}${prep ? ` (${prep})` : visual && !visual.endsWith("g") ? ` · ${visual}` : ""}`;
}

function sentences(lines: string[]) {
  return lines
    .filter((line) => !isFluffLine(line) && !isStepSection(line))
    .join(" ")
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function compactPasAPas(meal: NumberedRecipe) {
  const groups: { label: string; text: string }[] = [];
  let current = "Montage";
  const bucket: Record<string, string[]> = {};
  for (const line of meal.steps) {
    if (isStepSection(line)) {
      const label = stepSectionLabel(line);
      if (/airfryer/i.test(label)) current = "Protéines (Airfryer)";
      else if (/eau|plaque|féculent|cookeo|cuiseur/i.test(label)) current = "Féculents";
      else if (/thermomix/i.test(label)) current = "Sauce (TM)";
      else if (/assemblage|dressage|montage/i.test(label) && !/découpe/i.test(label)) current = "Assemblage";
      else if (/découpe|decoupe|kitchenaid/i.test(label)) current = "Découpes";
      else current = "Assemblage";
      continue;
    }
    if (isFluffLine(line)) continue;
    (bucket[current] ??= []).push(line);
  }
  const order = ["Sauce (TM)", "Protéines (Airfryer)", "Féculents", "Découpes", "Assemblage"];
  for (const label of order) {
    const text = sentences(bucket[label] ?? []).slice(0, label === "Découpes" ? 8 : 2).join(" ");
    if (text) groups.push({ label, text });
  }
  for (const [label, lines] of Object.entries(bucket)) {
    if (order.includes(label)) continue;
    const text = sentences(lines).slice(0, 2).join(" ");
    if (text) groups.push({ label, text });
  }
  return groups.slice(0, 5);
}

export function tmSetting(meal: NumberedRecipe) {
  const blob = meal.steps.join(" ");
  const hit = blob.match(/(\d+\s*sec\s*\/\s*v\d+)/i);
  return hit ? hit[1].replace(/\s+/g, " ") : "15 sec / V6";
}

export function airfryerSetting(meal: NumberedRecipe) {
  const blob = meal.steps.join(" ");
  const hit = blob.match(/(\d+\s*°c[^\d]{0,16}\d+\s*min|\d+\s*min[^\d]{0,16}\d+\s*°c)/i);
  return hit ? hit[1].replace(/\s+/g, " ") : "";
}

export function masterProteinLine(meal: NumberedRecipe) {
  const scale = cookScale(meal, "batch");
  const { alexis, elodie } = splitRecipeParts(meal);
  const left = alexis[0] ? proteinQty(alexis[0], scale) : "";
  const right = elodie[0] ? proteinQty(elodie[0], scale) : "";
  const pair = [left, right].filter(Boolean).join(" + ");
  const time = airfryerSetting(meal);
  return `[${meal.recipeNo}] : ${pair || meal.alexis.protein}${time ? `  ➔  ${time}` : ""}`;
}

export function masterStarchLine(meal: NumberedRecipe, blockAction?: string) {
  const scale = cookScale(meal, "batch");
  const starches = meal.ingredients.filter((ing) =>
    /quinoa|riz|lentille|sarrasin|orzo|penne|pâte|pate|nouille|soba|semoule|edamame/i.test(ing.name),
  );
  const qty = starches.length ? proseList(starches, scale) : "";
  const action = (blockAction ?? "").split(/(?<=[.!?])\s+/)[0] ?? "";
  return `[${meal.recipeNo}] : ${qty}${qty && action ? " — " : ""}${action}`.trim();
}

export function masterSauceCells(meal: NumberedRecipe) {
  const scale = cookScale(meal, "batch");
  const { sauce } = splitRecipeParts(meal);
  return {
    plat: `[${meal.recipeNo}]`,
    ingredients: sauce.length ? proseList(sauce, scale) : meal.sharedBase,
    setting: tmSetting(meal),
  };
}

export function qtyCaption(meal: NumberedRecipe) {
  return meal.servingsPerPerson === 2
    ? "Pour 2 pers. × 2 repas (4 assiettes)"
    : "1 repas / pers. · frais";
}

export function appliancesLine(meal: NumberedRecipe) {
  return meal.appliances.length ? meal.appliances.join(" + ") : "Couteau";
}

export function itemQuantityLine(ing: BatchStepIngredient) {
  return ing.quantity
    .replace(/\s*-\s*\[[^\]]+\]/, "")
    .replace(/\s*·\s*(Alexis|Élodie)\s*$/i, "")
    .trim();
}

export function groupedCellIngredients(ings: BatchStepIngredient[]) {
  const format = (ing: BatchStepIngredient) => {
    const qty = itemQuantityLine(ing);
    const split = qty.match(/^(.+?)\s*:\s*(.+)$/);
    return split ? `${split[1].trim()} ${split[2].trim()}` : qty;
  };
  const commun = ings.filter((ing) => !ing.who);
  const alexis = ings.filter((ing) => ing.who === "Alexis");
  const elodie = ings.filter((ing) => ing.who === "Élodie");
  const rows: { label: "Commun" | "Alexis" | "Élodie"; text: string }[] = [];
  if (commun.length) rows.push({ label: "Commun", text: commun.map(format).join(" · ") });
  if (alexis.length) rows.push({ label: "Alexis", text: alexis.map(format).join(" · ") });
  if (elodie.length) rows.push({ label: "Élodie", text: elodie.map(format).join(" · ") });
  return rows;
}

export function cellIngredients(ings: BatchStepIngredient[]) {
  return groupedCellIngredients(ings)
    .map((row) => `${row.label} : ${row.text}`)
    .join("\n");
}

export function cellSetting(block: BatchStepRecipeBlock) {
  const setting = (block.setting ?? "").trim();
  if (setting) return setting;
  const action = (block.action.split(/(?<=[.!?])\s+/)[0] ?? "").trim();
  if (/cuire |cuisson|trancher |tailler |émincer|râper /i.test(action)) return "";
  return action.length > 72 ? `${action.slice(0, 70)}…` : action;
}

export function shortCoverDays(coverLabel: string) {
  if (/frais/i.test(coverLabel)) return "frais";
  const days = [...coverLabel.matchAll(/Lun|Mar|Mer|Jeu|Ven|Sam|Dim/gi)].map((hit) => hit[0]);
  if (days.length > 0) return [...new Set(days)].join("+");
  return coverLabel.replace(/déjeuner|dîner/gi, "").replace(/\s+/g, " ").trim() || coverLabel;
}

export function splitMasterSteps(session: BatchSession) {
  const cook = session.steps.filter((step) => /^[12]$/.test(step.time));
  const rest = session.steps.filter((step) => !/^[12]$/.test(step.time) && step.time !== "W");
  const weekend = session.steps.find((step) => step.time === "W");
  return { cook, rest, weekend };
}

export function stepByKey(session: BatchSession, time: string): BatchStep | undefined {
  return session.steps.find((step) => step.time === time);
}
