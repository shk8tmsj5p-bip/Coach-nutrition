import { generateGeminiFlash } from "@/lib/gemini/flash";
import type { Pesee } from "@/lib/types";
import { parseJournalNotes } from "@/lib/pesees";

export function journalsFromPesees(rows: Pesee[]) {
  return rows
    .filter((row) => row.journalNotes)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((row) => ({ date: row.date, notes: parseJournalNotes(row.journalNotes) }));
}

export async function callGeminiFlashText(prompt: string): Promise<string> {
  return generateGeminiFlash({ parts: [{ text: prompt }], temperature: 0.4 });
}
