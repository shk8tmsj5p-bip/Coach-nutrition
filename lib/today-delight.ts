import { todayISO } from "@/lib/dates";
import { storage } from "@/lib/storage";
import type { ProfileId } from "@/lib/types";

export type DelightLayer = "meals" | "session" | "journal";

export type DelightFlags = Partial<Record<DelightLayer, boolean>>;

const LAYERS: DelightLayer[] = ["meals", "session", "journal"];

function key(profileId: ProfileId, date: string) {
  return `today-delight:${profileId}:${date}`;
}

export function loadDelightFlags(profileId: ProfileId, date = todayISO()): DelightFlags {
  return storage.getJSON<DelightFlags>(key(profileId, date), {});
}

export function saveDelightFlags(profileId: ProfileId, flags: DelightFlags, date = todayISO()) {
  storage.setJSON(key(profileId, date), flags);
}

export function pendingDelightLayers(ready: Record<DelightLayer, boolean>, shown: DelightFlags) {
  return LAYERS.filter((layer) => ready[layer] && !shown[layer]);
}

export function markDelightShown(profileId: ProfileId, layers: DelightLayer[], date = todayISO()) {
  const current = loadDelightFlags(profileId, date);
  const next = { ...current };
  for (const layer of layers) next[layer] = true;
  saveDelightFlags(profileId, next, date);
  return next;
}

export function delightCopy(layers: DelightLayer[], who?: string) {
  const prefix = who ? `${who} · ` : "";
  const has = (layer: DelightLayer) => layers.includes(layer);
  if (has("meals") && has("session") && has("journal")) {
    return `${prefix}Journée complète. Le chat est fier.`;
  }
  if (has("meals") && has("session")) {
    return `${prefix}Les 4 repas · séance cochée.`;
  }
  if (has("meals") && has("journal")) {
    return `${prefix}Les 4 repas + le journal. Nickel.`;
  }
  if (has("session") && has("journal")) {
    return `${prefix}Séance + journal. Belle paire.`;
  }
  if (has("meals")) return `${prefix}Les 4 repas sont rangés.`;
  if (has("session")) return `${prefix}Séance cochée. Bien joué.`;
  if (has("journal")) return `${prefix}Journal noté. Merci.`;
  return `${prefix}Le chat est content.`;
}
