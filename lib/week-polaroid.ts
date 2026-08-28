import type { SundayJournalFields } from "@/lib/types";

function clip(text: string, max: number) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

/** Trois lignes locales après le journal du dimanche — pas de Gemini. */
export function polaroidLines(notes: SundayJournalFields) {
  const wins = clip(notes.wins, 90);
  const mood = clip(notes.mood, 72);
  const line1 = wins || (mood ? mood : "Une semaine posée.");
  const line2 = wins && mood ? mood : wins ? "Le chat a bien suivi." : "On a tenu le fil.";
  const line3 = "On recommence lundi.";
  return { line1, line2, line3 };
}
